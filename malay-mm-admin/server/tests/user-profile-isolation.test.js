const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const schema = `sagawa_profile_test_${process.pid}_${Date.now()}`;
const quotedSchema = `"${schema}"`;
const setupPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'sagawa',
  user: process.env.DB_USER || 'kyawsanlin',
  password: process.env.DB_PASSWORD || '',
});

let apiBase;
let server;
let applicationPool;
const uploadedPaths = [];

async function request(pathname, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Tests below assert JSON only where expected.
  }
  return { response, body };
}

test.before(async () => {
  await setupPool.query(`CREATE SCHEMA ${quotedSchema}`);
  const client = await setupPool.connect();
  try {
    await client.query(`SET search_path TO ${quotedSchema}`);
    await client.query(`
      CREATE TABLE profiles (
        id bigserial PRIMARY KEY,
        name text,
        phone_number text,
        address text,
        profile_image text,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    const migrationFiles = fs
      .readdirSync(path.join(__dirname, '..', 'migrations'))
      .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
      .sort();
    for (const migrationFile of migrationFiles) {
      const migration = fs
        .readFileSync(path.join(__dirname, '..', 'migrations', migrationFile), 'utf8')
        .replace(/^BEGIN;\s*/i, '')
        .replace(/\s*COMMIT;\s*$/i, '');
      await client.query(migration);
    }
  } finally {
    client.release();
  }

  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const app = require('../server');
  applicationPool = require('../db');
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  apiBase = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  for (const uploadPath of uploadedPaths) {
    try {
      fs.unlinkSync(uploadPath);
    } catch {
      // Best-effort test cleanup.
    }
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (applicationPool) await applicationPool.end();
  await setupPool.query(`DROP SCHEMA ${quotedSchema} CASCADE`);
  await setupPool.end();
});

test('profiles remain isolated and server ignores client-supplied user IDs', async () => {
  const { registerUser } = require('../user-auth');
  const register = async (email) =>
    registerUser(email, 'ValidPass123!', 30, email.split('@')[0]);

  const alice = await register('alice.integration@example.com');
  const bob = await register('bob.integration@example.com');

  const unauthenticated = await request('/api/profile');
  assert.equal(unauthenticated.response.status, 401);

  const saveProfile = (token, body) => request('/api/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal((await saveProfile(alice.accessToken, {
    userId: bob.user.id,
    name: 'Alice', age: 31, gender: 'female', location: 'Yangon',
  })).response.status, 200);
  assert.equal((await saveProfile(bob.accessToken, {
    userId: alice.user.id,
    name: 'Bob', age: 35, gender: 'male', location: 'Mandalay',
  })).response.status, 200);

  const getProfile = (token) => request('/api/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal((await getProfile(alice.accessToken)).body.data.name, 'Alice');
  assert.equal((await getProfile(bob.accessToken)).body.data.name, 'Bob');

  await saveProfile(alice.accessToken, {
    userId: bob.user.id,
    name: 'Alice Updated', age: 32, gender: 'female', location: '',
  });
  assert.equal((await getProfile(alice.accessToken)).body.data.name, 'Alice Updated');
  assert.equal((await getProfile(bob.accessToken)).body.data.name, 'Bob');

  const login = async (email) => request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'ValidPass123!' }),
  });
  const aliceLogin = await login('alice.integration@example.com');
  const bobLogin = await login('bob.integration@example.com');
  assert.equal(aliceLogin.response.status, 200);
  assert.equal(aliceLogin.body.data.profileCompleted, true);
  assert.equal((await getProfile(aliceLogin.body.data.accessToken)).body.data.name, 'Alice Updated');
  assert.equal(bobLogin.response.status, 200);
  assert.equal(bobLogin.body.data.profileCompleted, true);
  assert.equal((await getProfile(bobLogin.body.data.accessToken)).body.data.name, 'Bob');

  let latestAlice = aliceLogin.body.data;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const nextLogin = await login('alice.integration@example.com');
    assert.equal(nextLogin.response.status, 200);
    latestAlice = nextLogin.body.data;
  }
  const sessionCount = await applicationPool.query(
    'SELECT COUNT(*)::int AS count FROM user_sessions WHERE user_id = $1',
    [alice.user.id],
  );
  assert.ok(sessionCount.rows[0].count <= 5);

  const form = new FormData();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  form.append('image', new Blob([png], { type: 'image/png' }), '../unsafe-name.png');
  const imageResult = await request('/api/profile/image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${latestAlice.accessToken}` },
    body: form,
  });
  assert.equal(imageResult.response.status, 200);
  assert.equal(imageResult.body.data.profileImage, '/api/profile/image');
  assert.equal((await request('/api/profile/image', {
    headers: { Authorization: `Bearer ${latestAlice.accessToken}` },
  })).response.status, 200);
  assert.equal((await request('/api/profile/image', {
    headers: { Authorization: `Bearer ${bob.accessToken}` },
  })).response.status, 404);
  assert.equal((await getProfile(bob.accessToken)).body.data.profileImage, '');
  const uploadedFile = fs.readdirSync(path.join(__dirname, '..', 'uploads', 'profile'))
    .find((file) => /^profile-[0-9a-f-]+\.png$/.test(file));
  if (uploadedFile) uploadedPaths.push(path.join(__dirname, '..', 'uploads', 'profile', uploadedFile));

  const malformed = new FormData();
  malformed.append('image', new Blob([Buffer.from('not an image')], { type: 'image/png' }), 'avatar.png');
  assert.equal((await request('/api/profile/image', {
    method: 'POST', headers: { Authorization: `Bearer ${bob.accessToken}` }, body: malformed,
  })).response.status, 422);

  const oversized = new FormData();
  oversized.append('image', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png');
  assert.equal((await request('/api/profile/image', {
    method: 'POST', headers: { Authorization: `Bearer ${bob.accessToken}` }, body: oversized,
  })).response.status, 413);

  assert.equal((await saveProfile(bob.accessToken, {
    name: '', age: 'not-a-number', gender: 'other', location: '',
  })).response.status, 400);

  assert.equal((await request('/api/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${bob.accessToken}`, 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
    body: JSON.stringify({ name: 'Mallory', age: 30, gender: 'female', location: '' }),
  })).response.status, 403);

  const duplicate = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Duplicate Alice',
      age: 30,
      email: 'ALICE.integration@example.com',
      password: 'ValidPass123!',
    }),
  });
  assert.equal(duplicate.response.status, 409);

  const logout = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${latestAlice.accessToken}` },
  });
  assert.equal(logout.response.status, 200);
  assert.equal((await getProfile(latestAlice.accessToken)).response.status, 401);

  const refresh = await request('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: bob.refreshToken }),
  });
  assert.equal(refresh.response.status, 200);
  assert.equal((await getProfile(bob.accessToken)).response.status, 401);
  assert.equal((await getProfile(refresh.body.data.accessToken)).body.data.name, 'Bob');
});

test('mobile password reset codes are expiring, one-time, and revoke existing sessions', async () => {
  const { registerUser, requestMobilePasswordReset, resetMobilePassword } = require('../user-auth');
  // A mobile account may intentionally use the same email as the separate admin account.
  const email = String(process.env.ADMIN_EMAIL).trim().toLowerCase();
  const originalPassword = 'OriginalPass123!';
  const nextPassword = 'UpdatedPass456!';

  await registerUser(email, originalPassword, 30, 'Admin Mobile Test');

  const reset = await requestMobilePasswordReset(email);
  assert.match(reset.code, /^\d{6}$/);
  const wrongCode = reset.code === '000000' ? '999999' : '000000';
  assert.equal(await resetMobilePassword(email, wrongCode, nextPassword), false);
  assert.equal(await resetMobilePassword(email, reset.code, nextPassword), true);
  assert.equal(await resetMobilePassword(email, reset.code, originalPassword), false);

  const oldLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: originalPassword }),
  });
  assert.equal(oldLogin.response.status, 401);

  const nextLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: nextPassword, accountType: 'mobile' }),
  });
  assert.equal(nextLogin.response.status, 200);
});
