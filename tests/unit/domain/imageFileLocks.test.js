import { describe, it, expect } from 'vitest';
import { imageFilesToLock } from '../../../src/domain/character/imageFileLocks.js';

describe('which uploaded files an image change locks, and in which order', () => {
  it.each([
    ['a replaced upload and its new upload', ['/uploads/200-new.png', '/uploads/100-old.jpg'], ['100-old.jpg', '200-new.png']],
    ['an upload replaced by the placeholder', ['/uploads/100-old.jpg', '/uploads/placeholder.jpg'], ['100-old.jpg']],
    ['the same upload on both sides', ['/uploads/100-old.jpg', '/uploads/100-old.jpg'], ['100-old.jpg']],
    ['no image replaced by a new upload', [null, '/uploads/200-new.png'], ['200-new.png']],
    ['the map placeholder replaced by an external URL', ['/uploads/map-placeholder.jpg', 'https://example.com/map.png'], []],
    ['a path that climbs out of uploads', ['/uploads/../.env', undefined], []],
  ])('%s', (_name, imageUrls, expected) => {
    const fileNames = imageFilesToLock(imageUrls);

    expect(fileNames).toEqual(expected);
  });
});
