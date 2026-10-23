import { describe, it, expect } from 'vitest';
import { imageFileToDelete } from '../../../src/domain/character/characterImage.js';

describe('which uploaded file a character image owns, when no other row uses it', () => {
  it.each([
    ['an uploaded portrait', '/uploads/1700000000-42-hero.jpg', '1700000000-42-hero.jpg'],
    ['an uploaded portrait with spaces and dots in the name', '/uploads/my hero.v2.png', 'my hero.v2.png'],
  ])('%s is the character\'s own file to delete', (_name, imageUrl, expected) => {
    const result = imageFileToDelete(imageUrl, false);

    expect(result).toBe(expected);
  });

  it.each([
    ['the shared placeholder', '/uploads/placeholder.jpg'],
    ['the shared map placeholder', '/uploads/map-placeholder.jpg'],
    ['a path that climbs out of uploads', '/uploads/../.env'],
    ['a path into a sub-directory', '/uploads/nested/hero.jpg'],
    ['a backslash path', '/uploads/..\\.env'],
    ['the uploads directory itself', '/uploads/'],
    ['a parent directory reference', '/uploads/..'],
    ['a bare file name without the uploads prefix', 'placeholder.png'],
    ['an absolute path elsewhere on disk', '/etc/passwd'],
    ['an external URL', 'https://example.com/uploads/hero.jpg'],
    ['no image', null],
    ['an unset image', undefined],
  ])('%s is not a file to delete', (_name, imageUrl) => {
    const result = imageFileToDelete(imageUrl, false);

    expect(result).toBeNull();
  });
});

describe('which file to delete after a character image changes', () => {
  it.each([
    ['an own upload no other row uses', '/uploads/1700000000-42-hero.jpg', false, '1700000000-42-hero.jpg'],
    ['an own upload another character or map still uses', '/uploads/1700000000-42-hero.jpg', true, null],
    ['the shared placeholder', '/uploads/placeholder.jpg', false, null],
    ['a path that climbs out of uploads', '/uploads/../.env', false, null],
    ['no previous image', null, false, null],
  ])('%s', (_name, previousUrl, stillReferenced, expected) => {
    const result = imageFileToDelete(previousUrl, stillReferenced);

    expect(result).toBe(expected);
  });
});
