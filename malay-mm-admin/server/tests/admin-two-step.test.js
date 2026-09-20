const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createVerificationState,
  hasVerificationState,
  invalidateVerificationState,
  validateVerificationCode,
} = require('../auth');

test('admin verification code is valid once and then consumed', () => {
  const verification = createVerificationState();

  assert.equal(hasVerificationState(verification.stateId, 'admin-login'), true);

  const first = validateVerificationCode(
    verification.stateId,
    verification.code,
    'admin-login',
  );

  assert.deepEqual(first, { valid: true });
  assert.equal(hasVerificationState(verification.stateId, 'admin-login'), false);

  const reused = validateVerificationCode(
    verification.stateId,
    verification.code,
    'admin-login',
  );

  assert.equal(reused.valid, false);
});

test('admin verification rejects an incorrect code without authenticating', () => {
  const verification = createVerificationState();
  const wrongCode = verification.code === '000000' ? '000001' : '000000';

  const result = validateVerificationCode(
    verification.stateId,
    wrongCode,
    'admin-login',
  );

  assert.equal(result.valid, false);
  assert.equal(hasVerificationState(verification.stateId, 'admin-login'), true);

  invalidateVerificationState(verification.stateId);
});

test('resend flow can invalidate an older verification challenge', () => {
  const first = createVerificationState();

  assert.equal(invalidateVerificationState(first.stateId), true);
  assert.equal(hasVerificationState(first.stateId, 'admin-login'), false);

  const second = createVerificationState();
  assert.equal(hasVerificationState(second.stateId, 'admin-login'), true);

  invalidateVerificationState(second.stateId);
});
