import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter } from './support/factories.js';

const app = createApp();

const UPLOADS_DIR = path.resolve('uploads');
const PLACEHOLDER_FILE = path.join(UPLOADS_DIR, 'placeholder.jpg');
// Every file these tests put in uploads/ ends with this, so they can all be removed again.
const TEST_FILE_MARKER = 'c1-image-test';
// A file next to uploads/ (the project root) that a traversal attempt would hit.
const OUTSIDE_FILE_NAME = `outside-${TEST_FILE_MARKER}.txt`;
const OUTSIDE_FILE = path.join(path.dirname(UPLOADS_DIR), OUTSIDE_FILE_NAME);

const removeTestUploads = () => {
  for (const name of fs.readdirSync(UPLOADS_DIR).filter((file) => file.includes(TEST_FILE_MARKER))) {
    fs.rmSync(path.join(UPLOADS_DIR, name), { force: true });
  }
  fs.rmSync(OUTSIDE_FILE, { force: true });
};

// uploads/ is the real upload directory and is tracked by git: clean before (leftovers of an
// aborted run) and after every test, so no test file stays behind.
beforeEach(removeTestUploads);
afterEach(removeTestUploads);

function makePortraitToUpload() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'c1-portrait-'));
  const filePath = path.join(directory, `${TEST_FILE_MARKER}.png`);
  fs.writeFileSync(filePath, Buffer.from('89504e470d0a1a0a', 'hex'));
  return filePath;
}

const readImageUrl = async (characterId) => {
  const [row] = await query('SELECT "imageUrl" FROM characters WHERE id = $1', [characterId]);
  return row.imageUrl;
};

describe('character portrait upload and removal', () => {
  it('a new upload deletes the previous portrait file, and removing it restores the placeholder and deletes the file', async () => {
    const player = await makeUser();
    const previousFile = `old-${TEST_FILE_MARKER}.jpg`;
    fs.writeFileSync(path.join(UPLOADS_DIR, previousFile), 'old portrait');
    const character = await makeCharacter({ user: player, imageUrl: `/uploads/${previousFile}` });
    const client = await logIn(app, player);

    const uploaded = await client.upload(`/api/characters/${character.id}/image`, 'image', makePortraitToUpload());
    const uploadedUrl = await readImageUrl(character.id);
    const uploadedFileExisted = fs.existsSync(path.join(UPLOADS_DIR, path.basename(uploadedUrl)));
    const removed = await client.delete(`/api/characters/${character.id}/image`);

    expect(uploaded.status).toBe(200);
    expect(uploaded.body.imageUrl).toBe(uploadedUrl);
    expect(uploadedUrl).toMatch(new RegExp(`^/uploads/[^/]+-${TEST_FILE_MARKER}\\.png$`));
    expect(uploadedFileExisted).toBe(true);
    expect(fs.existsSync(path.join(UPLOADS_DIR, previousFile))).toBe(false);
    expect(removed.status).toBe(204);
    expect(await readImageUrl(character.id)).toBe('/uploads/placeholder.jpg');
    expect(fs.existsSync(path.join(UPLOADS_DIR, path.basename(uploadedUrl)))).toBe(false);
    expect(fs.existsSync(PLACEHOLDER_FILE)).toBe(true);
  });

  it('removing a portrait another character still uses keeps the file for that character', async () => {
    const player = await makeUser();
    const sharedFile = `shared-${TEST_FILE_MARKER}.jpg`;
    fs.writeFileSync(path.join(UPLOADS_DIR, sharedFile), 'shared portrait');
    const character = await makeCharacter({ user: player, imageUrl: `/uploads/${sharedFile}` });
    const otherCharacter = await makeCharacter({ isNPC: true, imageUrl: `/uploads/${sharedFile}` });
    const client = await logIn(app, player);

    const response = await client.delete(`/api/characters/${character.id}/image`);

    expect(response.status).toBe(204);
    expect(await readImageUrl(character.id)).toBe('/uploads/placeholder.jpg');
    expect(await readImageUrl(otherCharacter.id)).toBe(`/uploads/${sharedFile}`);
    expect(fs.existsSync(path.join(UPLOADS_DIR, sharedFile))).toBe(true);
  });

  it('removing a portrait whose file is already gone still resets the image to the placeholder', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, imageUrl: `/uploads/missing-${TEST_FILE_MARKER}.jpg` });
    const client = await logIn(app, player);

    const response = await client.delete(`/api/characters/${character.id}/image`);

    expect(response.status).toBe(204);
    expect(await readImageUrl(character.id)).toBe('/uploads/placeholder.jpg');
  });

  it('a stored path that climbs out of uploads is reset without deleting anything outside uploads', async () => {
    const player = await makeUser();
    fs.writeFileSync(OUTSIDE_FILE, 'must survive');
    const character = await makeCharacter({ user: player, imageUrl: `/uploads/../${OUTSIDE_FILE_NAME}` });
    const client = await logIn(app, player);

    const response = await client.delete(`/api/characters/${character.id}/image`);

    expect(response.status).toBe(204);
    expect(fs.existsSync(OUTSIDE_FILE)).toBe(true);
    expect(await readImageUrl(character.id)).toBe('/uploads/placeholder.jpg');
  });

  it("another player's character image can be neither removed nor replaced, and the rejected upload leaves no file", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const ownedFile = `owned-${TEST_FILE_MARKER}.jpg`;
    fs.writeFileSync(path.join(UPLOADS_DIR, ownedFile), 'owner portrait');
    const character = await makeCharacter({ user: owner, imageUrl: `/uploads/${ownedFile}` });
    const client = await logIn(app, intruder);

    const removed = await client.delete(`/api/characters/${character.id}/image`);
    const uploaded = await client.upload(`/api/characters/${character.id}/image`, 'image', makePortraitToUpload());

    expect(removed.status).toBe(404);
    expect(uploaded.status).toBe(404);
    expect(await readImageUrl(character.id)).toBe(`/uploads/${ownedFile}`);
    expect(fs.readdirSync(UPLOADS_DIR).filter((file) => file.includes(TEST_FILE_MARKER))).toEqual([ownedFile]);
  });
});
