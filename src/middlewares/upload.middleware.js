const multer = require('multer');
const ERROR_CODES = require('../constants/errorCodes');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

const limits = { fileSize: MAX_FILE_SIZE };

const uploadImages = multer({ storage, fileFilter, limits }).array('images', 5);
const uploadFiles = multer({ storage, fileFilter, limits }).array('files', 3);
const uploadSingle = multer({ storage, fileFilter, limits }).single('image');

const handleUpload = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      const e = new Error('File size exceeds 5MB limit');
      e.statusCode = 400;
      e.errorCode = ERROR_CODES.VALIDATION_ERROR;
      return next(e);
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const e = new Error('Unexpected file field');
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

module.exports = { uploadImages, uploadFiles, uploadSingle, handleUpload };
