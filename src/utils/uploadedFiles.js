import fs from 'fs/promises';
import path from 'path';

// The directory the upload middleware writes to (multer's 'uploads/', relative to the working directory).
const UPLOADS_DIR = path.resolve('uploads');

/**
 * Delete a file from the uploads directory. A file that is already gone counts as deleted.
 * @param {string} fileName - A plain file name inside the uploads directory (see domain/character/characterImage.js)
 */
export async function deleteUploadedFile(fileName) {
  const filePath = path.resolve(UPLOADS_DIR, fileName);
  if (path.dirname(filePath) !== UPLOADS_DIR) {
    throw new Error(`Refusing to delete a file outside the uploads directory: ${fileName}`);
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
