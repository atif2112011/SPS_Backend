import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { getStorage } from '../config/firebase.js';
import ERROR_CODES from '../constants/errorCodes.js';

const sanitizeFilename = (name) => {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const sanitized = base.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  return `${sanitized}${ext}`;
};

const uploadFile = async (buffer, originalName, mimeType, folder) => {
  try {
    const bucket = getStorage();
    const filename = `${uuidv4()}-${sanitizeFilename(originalName)}`;
    const filePath = `${folder}/${filename}`;
    const file = bucket.file(filePath);
    await file.save(buffer, { metadata: { contentType: mimeType } });
    await file.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    return { url, path: filePath, size: buffer.length, mimeType, originalName };
  } catch (err) {
    const error = new Error('File upload failed: ' + err.message);
    error.statusCode = 500;
    error.errorCode = ERROR_CODES.UPLOAD_FAILED;
    throw error;
  }
};

const deleteFile = async (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    const error = new Error('A valid storage path is required');
    error.statusCode = 400;
    error.errorCode = ERROR_CODES.VALIDATION_ERROR;
    throw error;
  }
  try {
    const bucket = getStorage();
    await bucket.file(filePath).delete({ ignoreNotFound: true });
  } catch (err) {
    const error = new Error('File removal failed: ' + err.message);
    error.statusCode = 500;
    error.errorCode = ERROR_CODES.UPLOAD_FAILED;
    throw error;
  }
};

export { deleteFile, uploadFile };
export default { deleteFile, uploadFile };
