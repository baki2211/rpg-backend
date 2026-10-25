import { imageFileToDelete } from './characterImage.js';

// Every write of an imageUrl and every delete of an uploaded image file holds a lock on each file
// name involved, so a reference check and the delete that follows it can't interleave with a write
// that starts pointing at the same file.

/**
 * The uploads/ file names to lock for a change that involves these image URLs, in lock order
 * (sorted, no duplicates) so two transactions never wait on each other in a cycle. URLs that own
 * no file (null, the shared placeholders, paths outside uploads/) need no lock and are left out.
 * @param {Array<string|null|undefined>} imageUrls - e.g. the previous and the new imageUrl
 * @returns {string[]} Plain file names inside the uploads directory
 */
export function imageFilesToLock(imageUrls) {
  // With nothing else referencing it, the file a URL would free is exactly the file it owns.
  const ownedFileNames = imageUrls.map((url) => imageFileToDelete(url, false)).filter(Boolean);
  return [...new Set(ownedFileNames)].sort();
}
