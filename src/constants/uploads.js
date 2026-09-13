const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_CONTENT_ATTACHMENTS = 5;
const MAX_REPORT_ATTACHMENTS = 3;
const CONTENT_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export { MAX_FILE_SIZE, MAX_CONTENT_ATTACHMENTS, MAX_REPORT_ATTACHMENTS, CONTENT_ATTACHMENT_MIME_TYPES };
export default { MAX_FILE_SIZE, MAX_CONTENT_ATTACHMENTS, MAX_REPORT_ATTACHMENTS, CONTENT_ATTACHMENT_MIME_TYPES };
