import fs from 'fs/promises';
import path from 'path';
import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { Map as GameMap } from '../models/mapModel.js';
import { characterImageUrlFor, imageFileToDelete } from '../domain/character/characterImage.js';
import { imageFilesToLock } from '../domain/character/imageFileLocks.js';
import { XACT_LOCK_NAMESPACES, lockNameUntilCommit } from './advisoryLock.js';
import { logger } from './logger.js';

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

/**
 * Lock the uploaded files behind these image URLs until the transaction ends (see
 * domain/character/imageFileLocks.js). Every imageUrl writer calls this with the previous and the new
 * URL, after its row locks, so a reference check and the delete that follows it are serialized
 * against writes that start pointing at the same file.
 * @param {import('typeorm').EntityManager} manager - A transaction's manager
 * @param {Array<string|null|undefined>} imageUrls
 */
export async function lockImageFiles(manager, imageUrls) {
  for (const fileName of imageFilesToLock(imageUrls)) {
    await lockNameUntilCommit(manager, XACT_LOCK_NAMESPACES.UPLOADED_FILE, fileName);
  }
}

/**
 * Whether any character (NPCs included) or map still stores this image URL. A null URL is never
 * referenced: TypeORM would not match it as IS NULL.
 * @param {import('typeorm').EntityManager} manager
 * @param {string|null|undefined} imageUrl
 * @returns {Promise<boolean>}
 */
export async function isImageUrlReferenced(manager, imageUrl) {
  if (imageUrl == null) return false;
  return await manager.existsBy(Character, { imageUrl }) || await manager.existsBy(GameMap, { imageUrl });
}

/**
 * Delete an uploaded image file that a committed change stopped pointing at. Under the file's lock,
 * the references are checked again and the file is removed only if no row uses it, so a write that
 * started pointing at it in the meantime keeps it. Never throws: a failed delete leaves an orphan
 * file, never a dangling URL, and never fails a request whose change is already saved.
 * @param {string|null} fileName - A plain file name inside the uploads directory, or null for nothing to do
 */
export async function deleteImageFileIfUnreferenced(fileName) {
  if (!fileName) return;
  const imageUrl = characterImageUrlFor(fileName);
  try {
    await AppDataSource.transaction(async (manager) => {
      await lockImageFiles(manager, [imageUrl]);
      const fileToDelete = imageFileToDelete(imageUrl, await isImageUrlReferenced(manager, imageUrl));
      if (fileToDelete) await deleteUploadedFile(fileToDelete);
    });
  } catch (error) {
    logger.warn('Orphan image file left behind', { fileName, error: error.message });
  }
}
