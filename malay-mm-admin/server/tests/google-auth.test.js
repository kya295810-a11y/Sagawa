const test = require('node:test');
const assert = require('node:assert/strict');

const googleAuth = require('../google-auth');

test('authorized Google parties include the backend Web client', () => {
  const previous = process.env.GOOGLE_ANDROID_CLIENT_IDS;
  delete process.env.GOOGLE_ANDROID_CLIENT_IDS;

  try {
    assert.equal(googleAuth.__test.authorizedPartyMatches('web-client', 'web-client'), true);
    assert.equal(googleAuth.__test.authorizedPartyMatches('other-client', 'web-client'), false);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_ANDROID_CLIENT_IDS;
    else process.env.GOOGLE_ANDROID_CLIENT_IDS = previous;
  }
});

test('authorized Google parties accept only configured Android clients', () => {
  const previous = process.env.GOOGLE_ANDROID_CLIENT_IDS;
  process.env.GOOGLE_ANDROID_CLIENT_IDS = ' android-debug , android-release ';

  try {
    assert.equal(googleAuth.__test.authorizedPartyMatches('android-debug', 'web-client'), true);
    assert.equal(googleAuth.__test.authorizedPartyMatches('android-release', 'web-client'), true);
    assert.equal(googleAuth.__test.authorizedPartyMatches('android-unknown', 'web-client'), false);
    assert.equal(googleAuth.__test.authorizedPartyMatches(null, 'web-client'), true);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_ANDROID_CLIENT_IDS;
    else process.env.GOOGLE_ANDROID_CLIENT_IDS = previous;
  }
});
