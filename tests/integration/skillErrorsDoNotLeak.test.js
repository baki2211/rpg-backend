import http from 'http';
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import WebSocket from 'ws';
import { createApp } from '../../src/app.js';
import { setupWebSocketServer } from '../../src/websockets/ChatWebSocket.js';
import { createUpgradeHandler } from '../../src/websockets/upgradeHandler.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import {
  TEST_PASSWORD, makeUser, makeCharacter, makeLocation, makeSession, makeCombatRound, makeSkill, giveSkill,
} from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

// L43: an unexpected failure while computing a skill or resolving its target used to reach the client
// as "Skill calculation failed: <error text>" or "Failed to resolve target: <driver text>".

// A skill row whose scalingStats jsonb is an object instead of an array: computing its output throws
// a TypeError inside the server, which stands in for any unexpected failure.
const BROKEN_SCALING_STATS = { might: 1 };

async function makePlayerWithBrokenSkill({ inRound }) {
  const player = await makeUser();
  const location = await makeLocation();
  const round = inRound
    ? await makeCombatRound({ location, createdBy: await makeUser({ role: 'master' }), session: await makeSession({ location }) })
    : null;
  const character = await makeCharacter({ user: player });
  const skill = await makeSkill({ target: 'self', scalingStats: BROKEN_SCALING_STATS });
  await giveSkill(character, skill);
  return { player, location, round, character, skill };
}

/**
 * The chat WebSocket server wired the way src/index.js wires it, on a free port.
 * `connect(player, locationId)` opens a socket with the player's session cookie and resolves once the
 * server handles its messages.
 */
async function startChatServer() {
  const chatWS = setupWebSocketServer();
  const server = http.createServer(app);
  server.on('upgrade', createUpgradeHandler({ chatWS, jwtSecret: process.env.JWT_SECRET }));
  await new Promise((resolve) => server.listen(0, resolve));

  return {
    connect: async (player, locationId) => {
      const token = await sessionCookie(player);
      const socket = new WebSocket(`ws://localhost:${server.address().port}/ws/chat?locationId=${locationId}`, {
        headers: { Cookie: `token=${encodeURIComponent(token)}` },
      });
      await untilChatConnections(chatWS, 1);
      return socket;
    },
    stop: async () => {
      chatWS.cleanup();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

// The `token` cookie from a real login (support/auth.js keeps it inside its agent)
async function sessionCookie({ username }) {
  const response = await request(app).post('/api/auth/login').send({ username, password: TEST_PASSWORD });
  const cookie = response.headers['set-cookie'].find((line) => line.startsWith('token='));
  return decodeURIComponent(cookie.split(';')[0].slice('token='.length));
}

// The server registers its message handler right after it counts the connection
async function untilChatConnections(chatWS, count) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (chatWS.getConnectionCount() === count) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`The chat server never reached ${count} connection(s)`);
}

function nextErrorReply(socket) {
  return new Promise((resolve) => {
    socket.on('message', (data) => {
      const payload = JSON.parse(data.toString());
      if (payload.error) resolve(payload);
    });
  });
}

describe('unexpected failures while using a skill', () => {
  it('a combat action whose output cannot be computed is a generic server error and nothing is recorded', async () => {
    const { player, round, character, skill } = await makePlayerWithBrokenSkill({ inRound: true });
    const client = await logIn(app, player);

    const response = await client.post(`/api/combat/rounds/${round.id}/actions`, { skillId: skill.id });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Internal Server Error' });
    expect(await query(`SELECT id FROM combat_actions`)).toEqual([]);
    const [{ uses }] = await query(`SELECT uses FROM character_skills WHERE "characterId" = $1`, [character.id]);
    expect(uses).toBe(0);
  });

  it('a chat skill launch whose output cannot be computed is a generic server error and no message is posted', async () => {
    const { player, location, skill } = await makePlayerWithBrokenSkill({ inRound: false });
    const client = await logIn(app, player);

    const response = await client.post(`/api/chat/skills/${skill.id}`, { locationId: location.id });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Internal Server Error' });
    expect(await query(`SELECT id FROM chat_messages`)).toEqual([]);
  });

  it('a chat skill aimed at a malformed user id gets the generic chat error and nothing is recorded', async () => {
    const player = await makeUser();
    const location = await makeLocation();
    await makeCombatRound({ location, createdBy: await makeUser({ role: 'master' }), session: await makeSession({ location }) });
    const character = await makeCharacter({ user: player });
    const strike = await makeSkill({ target: 'other' });
    await giveSkill(character, strike);
    const chat = await startChatServer();
    const socket = await chat.connect(player, location.id);
    const reply = nextErrorReply(socket);

    socket.send(JSON.stringify({ message: 'Strike!', skill: { id: strike.id, selectedTarget: { userId: 'not-a-number' } } }));

    expect(await reply).toEqual({ error: 'Message could not be sent' });
    socket.close();
    await chat.stop();
    expect(await query(`SELECT id FROM combat_actions`)).toEqual([]);
    expect(await query(`SELECT id FROM chat_messages`)).toEqual([]);
  });
});
