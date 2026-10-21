import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyIdToken } from '../worker/summary-worker.js';

const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256' };
const jwks = { keys: [jwk] };
const NOW = 1_800_000_000;

async function mint(over = {}, key = privateKey) {
  const h = enc({ alg: 'RS256', kid: 'k1' });
  const p = enc({ aud: 'proj', iss: 'https://securetoken.google.com/proj', sub: 'u1', iat: NOW - 10, exp: NOW + 3000, email: 'a@b.c', email_verified: true, ...over });
  const sig = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${h}.${p}`))).toString('base64url');
  return `${h}.${p}.${sig}`;
}

test('geçerli token kabul edilir', async () => {
  assert.equal((await verifyIdToken(await mint(), 'proj', jwks, NOW)).email, 'a@b.c');
});
test('süresi dolmuş, yanlış proje, doğrulanmamış e-posta reddedilir', async () => {
  await assert.rejects(verifyIdToken(await mint({ exp: NOW - 1 }), 'proj', jwks, NOW));
  await assert.rejects(verifyIdToken(await mint({ aud: 'baska', iss: 'https://securetoken.google.com/baska' }), 'proj', jwks, NOW));
  await assert.rejects(verifyIdToken(await mint({ email_verified: false }), 'proj', jwks, NOW));
});
test('başka anahtarla imzalanmış token reddedilir', async () => {
  const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  await assert.rejects(verifyIdToken(await mint({}, other.privateKey), 'proj', jwks, NOW));
});
test('bozuk token reddedilir', async () => {
  await assert.rejects(verifyIdToken('abc', 'proj', jwks, NOW));
});
