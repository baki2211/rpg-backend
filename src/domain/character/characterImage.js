// Character portraits are stored as URLs under /uploads/ (served from the uploads directory).
// A character without its own picture points at the shared placeholder, which is never deleted.

const UPLOADS_URL_PREFIX = '/uploads/';

export const CHARACTER_PLACEHOLDER_IMAGE_URL = '/uploads/placeholder.jpg';

// Shared files in uploads/ that characters may point at but never own.
const SHARED_UPLOAD_FILES = new Set(['placeholder.jpg', 'map-placeholder.jpg']);

/**
 * URL to store for a file the upload middleware saved in the uploads directory.
 * @param {string} fileName - The saved file's name (no directory)
 * @returns {string}
 */
export function characterImageUrlFor(fileName) {
  return `${UPLOADS_URL_PREFIX}${fileName}`;
}

/**
 * The file in the uploads directory that belongs to this stored image URL and may be deleted
 * when the character's image changes, or null when there is nothing of the character's own to
 * delete: no URL, the shared placeholder, a URL outside /uploads/, or anything that would leave
 * the uploads directory (sub-paths, `..`).
 * @param {string|null|undefined} imageUrl - The character's stored imageUrl
 * @returns {string|null} A plain file name inside the uploads directory
 */
function ownedImageFileName(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith(UPLOADS_URL_PREFIX)) return null;

  const fileName = imageUrl.slice(UPLOADS_URL_PREFIX.length);
  const isPlainFileName = fileName !== '' && fileName !== '.' && fileName !== '..' && !/[/\\\0]/.test(fileName);

  return isPlainFileName && !SHARED_UPLOAD_FILES.has(fileName) ? fileName : null;
}

/**
 * The file to delete after a character's image changed away from `previousUrl`, or null when
 * nothing may be deleted: the URL owns no file (see ownedImageFileName), or another character
 * or a map still points at the same URL.
 * @param {string|null|undefined} previousUrl - The character's imageUrl before the change
 * @param {boolean} stillReferenced - Whether any other row still stores `previousUrl`
 * @returns {string|null} A plain file name inside the uploads directory
 */
export function imageFileToDelete(previousUrl, stillReferenced) {
  return stillReferenced ? null : ownedImageFileName(previousUrl);
}
