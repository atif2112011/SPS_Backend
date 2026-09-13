import multer from 'multer';
import ERROR_CODES from '../constants/errorCodes.js';
import { CONTENT_ATTACHMENT_MIME_TYPES, MAX_CONTENT_ATTACHMENTS, MAX_FILE_SIZE, MAX_REPORT_ATTACHMENTS } from '../constants/uploads.js';

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

const handleUpload = (multerMiddleware, maxFiles = MAX_CONTENT_ATTACHMENTS) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      const e = new Error('File size exceeds 5MB limit');
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
  MAX_CONTENT_ATTACHMENTS,
  CONTENT_ATTACHMENT_MIME_TYPES,
};
export default { uploadImages, uploadFiles, uploadSingle, uploadContentAttachments, handleUpload };
