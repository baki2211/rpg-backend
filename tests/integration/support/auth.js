import request from 'supertest';

/**
 * Log in through POST /api/auth/login, the way the SPA does, and return a client that
 * sends the `token` cookie on every request and echoes the `csrfToken` cookie in the
 * X-CSRF-Token header on mutating requests. Responses are `{ status, headers, body }` with the JSON parsed.
 * `upload(url, field, filePath, fields)` sends a multipart POST, the way the SPA uploads images:
 * the file under `field` plus plain text `fields`.
 * @param {import('express').Express} app - From createApp()
 * @param {{ username: string, password: string }} credentials
 */
export async function logIn(app, { username, password }) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ username, password });
  if (response.status !== 200) {
    throw new Error(`Login as ${username} failed: ${response.status} ${JSON.stringify(response.body)}`);
  }

  const csrfToken = cookieValue(response, 'csrfToken');

  return {
    get: async (url) => withJsonBody(await agent.get(url)),
    post: async (url, body = {}) => withJsonBody(await agent.post(url).set('X-CSRF-Token', csrfToken).send(body)),
    put: async (url, body = {}) => withJsonBody(await agent.put(url).set('X-CSRF-Token', csrfToken).send(body)),
    delete: async (url) => withJsonBody(await agent.delete(url).set('X-CSRF-Token', csrfToken)),
    upload: async (url, field, filePath, fields = {}) => {
      const multipart = agent.post(url).set('X-CSRF-Token', csrfToken);
      for (const [name, value] of Object.entries(fields)) multipart.field(name, String(value));
      return withJsonBody(await multipart.attach(field, filePath));
    },
  };
}

function withJsonBody(response) {
  return { status: response.status, headers: response.headers, body: response.body };
}

function cookieValue(response, name) {
  const cookie = (response.headers['set-cookie'] ?? []).find((line) => line.startsWith(`${name}=`));
  if (!cookie) {
    throw new Error(`Login response did not set the ${name} cookie`);
  }
  return decodeURIComponent(cookie.split(';')[0].slice(name.length + 1));
}
