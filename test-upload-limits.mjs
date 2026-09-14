import express from 'express';
import { MAX_REPORT_ATTACHMENTS } from './src/constants/uploads.js';
import { handleUpload, uploadContentAttachments, uploadFiles } from './src/middlewares/upload.middleware.js';

const app = express();
app.post('/upload', handleUpload(uploadContentAttachments), (req, res) => res.json({ count: req.files.length }));
app.post('/report-upload', handleUpload(uploadFiles, MAX_REPORT_ATTACHMENTS), (req, res) => res.json({ count: req.files.length }));
app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));

const server = await new Promise((resolve) => {
  const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
});
const { port } = server.address();

async function upload(files, path = '/upload', field = 'images') {
  const form = new FormData();
  files.forEach(({ name, type, bytes }) => form.append(field, new Blob([bytes], { type }), name));
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', body: form });
  return { status: response.status, body: await response.json() };
}

try {
  const valid = await upload([{ name: 'worksheet.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: 'test' }]);
  if (valid.status !== 200 || valid.body.count !== 1) throw new Error('Valid attachment was rejected');

  const tooMany = await upload(Array.from({ length: 6 }, (_, index) => ({ name: `${index}.pdf`, type: 'application/pdf', bytes: 'test' })));
  if (tooMany.status !== 400 || !tooMany.body.message.includes('maximum of 5')) throw new Error('File-count limit was not enforced');

  const tooLarge = await upload([{ name: 'large.pdf', type: 'application/pdf', bytes: new Uint8Array((4 * 1024 * 1024) + 1) }]);
  if (tooLarge.status !== 400 || !tooLarge.body.message.includes('4 MB')) throw new Error('File-size limit was not enforced');

  const tooLargeCombined = await upload([
    { name: 'part-1.pdf', type: 'application/pdf', bytes: new Uint8Array(2.1 * 1024 * 1024) },
    { name: 'part-2.pdf', type: 'application/pdf', bytes: new Uint8Array(2.1 * 1024 * 1024) },
  ]);
  if (tooLargeCombined.status !== 400 || !tooLargeCombined.body.message.includes('Combined')) throw new Error('Combined request limit was not enforced');

  const invalid = await upload([{ name: 'archive.zip', type: 'application/zip', bytes: 'test' }]);
  if (invalid.status !== 400 || !invalid.body.message.includes('File type not allowed')) throw new Error('File-type limit was not enforced');

  const validReport = await upload(Array.from({ length: 3 }, (_, index) => ({ name: `report-${index}.pdf`, type: 'application/pdf', bytes: 'test' })), '/report-upload', 'files');
  if (validReport.status !== 200 || validReport.body.count !== 3) throw new Error('Valid report attachments were rejected');

  const tooManyReportFiles = await upload(Array.from({ length: 4 }, (_, index) => ({ name: `report-${index}.pdf`, type: 'application/pdf', bytes: 'test' })), '/report-upload', 'files');
  if (tooManyReportFiles.status !== 400 || !tooManyReportFiles.body.message.includes('maximum of 3')) throw new Error('Report attachment count limit was not enforced');

  console.log('Upload limits passed: type, 4 MB request-safe size, combined payload, 5 content attachments, and 3 report attachments.');
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
