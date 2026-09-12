import NotificationCampaign from '../models/NotificationCampaign.model.js';
import NotificationDelivery from '../models/NotificationDelivery.model.js';
import DeviceToken from '../models/DeviceToken.model.js';
import { sendPushBatch } from './fcm.service.js';
import logger from '../config/logger.js';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000];
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
const TRANSIENT_CODES = new Set([
  'messaging/internal-error',
  'messaging/server-unavailable',
  'messaging/quota-exceeded',
  'messaging/unknown-error',
]);

const claimDeliveries = async (limit, campaignIds) => {
  const claimed = [];
  for (let index = 0; index < limit; index += 1) {
    const now = new Date();
    const filter = {
      ...(campaignIds?.length ? { campaignId: { $in: campaignIds } } : {}),
        attemptCount: { $lt: MAX_ATTEMPTS },
        $or: [
          { status: { $in: ['pending', 'retry_scheduled'] }, nextAttemptAt: { $lte: now } },
          { status: 'processing', lockedUntil: { $lte: now } },
        ],
      };
    const delivery = await NotificationDelivery.findOneAndUpdate(
      filter,
      {
        $set: {
          status: 'processing',
          lockedAt: now,
          lockedUntil: new Date(now.getTime() + 2 * 60_000),
        },
        $inc: { attemptCount: 1 },
      },
      { returnDocument: 'after', sort: { nextAttemptAt: 1 } }
    ).lean();
    if (!delivery) break;
    claimed.push(delivery);
  }
  return claimed;
};

const refreshCampaignTotals = async (campaignId) => {
  const rows = await NotificationDelivery.aggregate([
    { $match: { campaignId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(rows.map((row) => [row._id, row.count]));
  const deliveredCount = counts.delivered || 0;
  const failedCount = (counts.failed || 0) + (counts.invalid_token || 0);
  const pendingCount = (counts.pending || 0) + (counts.retry_scheduled || 0) + (counts.processing || 0);
  const campaign = await NotificationCampaign.findById(campaignId).select('status scheduledAt');
  if (!campaign || campaign.status === 'cancelled') return;

  let status;
  if (pendingCount > 0) status = campaign.scheduledAt > new Date() ? 'scheduled' : counts.processing ? 'processing' : 'queued';
  else if (deliveredCount > 0 && failedCount > 0) status = 'partially_failed';
  else if (deliveredCount > 0) status = 'completed';
  else status = 'failed';

  await NotificationCampaign.findByIdAndUpdate(campaignId, {
    $set: { status, deliveredCount, failedCount, pendingCount },
  });
};

const recordResult = async (delivery, result) => {
  if (result.success) {
    await Promise.all([
      NotificationDelivery.findByIdAndUpdate(delivery._id, {
        $set: {
          status: 'delivered',
          providerMessageId: result.messageId,
          deliveredAt: new Date(),
          lockedAt: null,
          lockedUntil: null,
        },
        $unset: { lastErrorCode: 1, lastErrorMessage: 1, failureKind: 1 },
      }),
      DeviceToken.findByIdAndUpdate(delivery.deviceTokenId, {
        $set: { lastSuccessfulDeliveryAt: new Date(), consecutiveFailureCount: 0 },
      }),
    ]);
    return;
  }

  const errorCode = result.errorCode || 'messaging/unknown-error';
  const invalidToken = INVALID_TOKEN_CODES.has(errorCode);
  const transient = TRANSIENT_CODES.has(errorCode);
  const canRetry = transient && delivery.attemptCount < MAX_ATTEMPTS;
  const failureKind = invalidToken ? 'invalid_token' : transient ? 'transient' : 'permanent';
  const status = invalidToken ? 'invalid_token' : canRetry ? 'retry_scheduled' : 'failed';
  const retryDelay = RETRY_DELAYS_MS[Math.max(0, delivery.attemptCount - 1)] || RETRY_DELAYS_MS.at(-1);

  await NotificationDelivery.findByIdAndUpdate(delivery._id, {
    $set: {
      status,
      failureKind,
      lastErrorCode: errorCode,
      lastErrorMessage: result.errorMessage || 'Push provider rejected the delivery',
      nextAttemptAt: canRetry ? new Date(Date.now() + retryDelay) : delivery.nextAttemptAt,
      lockedAt: null,
      lockedUntil: null,
    },
  });

  if (invalidToken) {
    await DeviceToken.findByIdAndUpdate(delivery.deviceTokenId, {
      $set: { enabled: false, disabledAt: new Date(), disabledReason: errorCode },
      $inc: { consecutiveFailureCount: 1 },
    });
  } else {
    await DeviceToken.findByIdAndUpdate(delivery.deviceTokenId, { $inc: { consecutiveFailureCount: 1 } });
  }
};

const runNotificationWorker = async ({ sendBatch = sendPushBatch, campaignIds: onlyCampaignIds } = {}) => {
  const configuredBatchSize = Number.parseInt(process.env.NOTIFICATION_BATCH_SIZE || '100', 10);
  const batchSize = Math.min(500, Math.max(1, configuredBatchSize || 100));
  const deliveries = await claimDeliveries(batchSize, onlyCampaignIds);
  if (deliveries.length === 0) return { claimed: 0, delivered: 0, failed: 0 };

  const campaignIds = [...new Set(deliveries.map((delivery) => String(delivery.campaignId)))];
  const campaigns = await NotificationCampaign.find({ _id: { $in: campaignIds }, status: { $ne: 'cancelled' } }).lean();
  const campaignMap = new Map(campaigns.map((campaign) => [String(campaign._id), campaign]));
  let delivered = 0;
  let failed = 0;

  for (const campaignId of campaignIds) {
    const campaign = campaignMap.get(campaignId);
    const campaignDeliveries = deliveries.filter((delivery) => String(delivery.campaignId) === campaignId);
    if (!campaign) {
      await NotificationDelivery.updateMany(
        { _id: { $in: campaignDeliveries.map((delivery) => delivery._id) } },
        { $set: { status: 'cancelled', lockedAt: null, lockedUntil: null } }
      );
      continue;
    }

    let results;
    try {
      results = await sendBatch({
        tokens: campaignDeliveries.map((delivery) => delivery.token),
        title: campaign.title,
        body: campaign.body,
        data: {
          type: campaign.sourceType || 'custom',
          campaignId,
          destination: campaign.destination,
          ...(campaign.entityType ? { entityType: campaign.entityType } : {}),
          ...(campaign.entityId ? { entityId: String(campaign.entityId) } : {}),
        },
      });
    } catch (err) {
      logger.warn('Notification campaign batch failed', { campaignId, error: err.message });
      results = campaignDeliveries.map(() => ({ success: false, errorCode: 'messaging/server-unavailable', errorMessage: err.message }));
    }

    for (let index = 0; index < campaignDeliveries.length; index += 1) {
      const result = results[index] || { success: false, errorCode: 'messaging/unknown-error' };
      await recordResult(campaignDeliveries[index], result);
      if (result.success) delivered += 1;
      else failed += 1;
    }
    await refreshCampaignTotals(campaign._id);
  }

  return { claimed: deliveries.length, delivered, failed };
};

export { MAX_ATTEMPTS, runNotificationWorker, refreshCampaignTotals };
export default { runNotificationWorker, refreshCampaignTotals };
