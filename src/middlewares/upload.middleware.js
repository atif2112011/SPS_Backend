import multer from 'multer';
import { PassThrough } from 'node:stream';
import ERROR_CODES from '../constants/errorCodes.js';
import { CONTENT_ATTACHMENT_MIME_TYPES, MAX_CONTENT_ATTACHMENTS, MAX_FILE_SIZE, MAX_REPORT_ATTACHMENTS, MAX_UPLOAD_BODY_BYTES } from '../constants/uploads.js';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('File type not allowed. Allowed: JPEG, PNG, GIF, WebP, PDF');
    err.statusCode = 400;
    err.errorCode = ERROR_CODES.VALIDATION_ERROR;
    cb(err, false);
  }
};

const contentAttachmentFilter = (req, file, cb) => {
  if (CONTENT_ATTACHMENT_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('File type not allowed. Allowed: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX, TXT');
    err.statusCode = 400;
    err.errorCode = ERROR_CODES.VALIDATION_ERROR;
    cb(err, false);
  }
};

const limits = { fileSize: MAX_FILE_SIZE };

const uploadImages = multer({ storage, fileFilter, limits }).array('images', 5);
const uploadFiles = multer({ storage, fileFilter, limits: { ...limits, files: MAX_REPORT_ATTACHMENTS } }).array('files', MAX_REPORT_ATTACHMENTS);
const uploadSingle = multer({ storage, fileFilter, limits }).single('image');
const uploadContentAttachments = multer({
  storage,
  fileFilter: contentAttachmentFilter,
  limits: { ...limits, files: MAX_CONTENT_ATTACHMENTS },
}).array('images', MAX_CONTENT_ATTACHMENTS);

const runMulter = (multerMiddleware, req, res, callback) => {
  const contentType = String(req.headers?.['content-type'] || '');
  const hasFirebaseRawBody = Buffer.isBuffer(req.rawBody)
    && contentType.toLowerCase().startsWith('multipart/form-data');

  if (!hasFirebaseRawBody) {
    multerMiddleware(req, res, callback);
    return;
  }

  // Cloud Functions materializes the request stream as rawBody before the
  // Express handler runs. Replay those bytes through a stream for Multer.
  const uploadRequest = new PassThrough();
  uploadRequest.headers = req.headers;
  uploadRequest.method = req.method;
  uploadRequest.url = req.url;
  uploadRequest.originalUrl = req.originalUrl;

  multerMiddleware(uploadRequest, res, (err) => {
    req.body = uploadRequest.body;
    req.file = uploadRequest.file;
    req.files = uploadRequest.files;
    callback(err);
  });
  uploadRequest.end(req.rawBody);
};

const handleUpload = (multerMiddleware, maxFiles = MAX_CONTENT_ATTACHMENTS) => (req, res, next) => {
  runMulter(multerMiddleware, req, res, (err) => {
    if (!err) {
      const totalBytes = (req.files || []).reduce((total, file) => total + (file.size || file.buffer?.length || 0), 0);
      if (totalBytes > MAX_UPLOAD_BODY_BYTES) {
        const e = new Error('Combined attachment size exceeds the 4 MB upload limit');
        e.statusCode = 400;
        e.errorCode = ERROR_CODES.VALIDATION_ERROR;
        return next(e);
      }
      return next();
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      const e = new Error('File size exceeds 4 MB limit');
      e.statusCode = 400;
      e.errorCode = ERROR_CODES.VALIDATION_ERROR;
      return next(e);
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      const e = new Error(`A maximum of ${maxFiles} attachments is allowed`);
      e.statusCode = 400;
      e.errorCode = ERROR_CODES.VALIDATION_ERROR;
      return next(e);
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const e = new Error(['images', 'files'].includes(err.field)
        ? `A maximum of ${maxFiles} attachments is allowed`
        : 'Unexpected file field');
      e.statusCode = 400;
      e.errorCode = ERROR_CODES.VALIDATION_ERROR;
      return next(e);
    }
    if (err.statusCode) return next(err);
    const e = new Error(err.message || 'File upload error');
    e.statusCode = 400;
    e.errorCode = ERROR_CODES.VALIDATION_ERROR;
    return next(e);
  });
};

export {
  uploadImages,
  uploadFiles,
  uploadSingle,
  uploadContentAttachments,
  handleUpload,
  MAX_FILE_SIZE,
  MAX_UPLOAD_BODY_BYTES,
  MAX_CONTENT_ATTACHMENTS,
  CONTENT_ATTACHMENT_MIME_TYPES,
};
export default { uploadImages, uploadFiles, uploadSingle, uploadContentAttachments, handleUpload };
