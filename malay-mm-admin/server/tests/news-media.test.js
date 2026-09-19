const assert = require('node:assert/strict');
const test = require('node:test');

const {
  IMAGE_LIMIT_BYTES,
  VIDEO_LIMIT_BYTES,
  validateUploadMetadata,
} = require('../news-media');

test('accepts a supported video below the 100 MB limit', () => {
  assert.doesNotThrow(() => validateUploadMetadata({
    fieldname: 'video',
    mimetype: 'video/mp4',
    originalname: 'update.mp4',
    size: VIDEO_LIMIT_BYTES - 1,
  }));
});

test('rejects a video above the 100 MB limit with HTTP 413 semantics', () => {
  assert.throws(
    () => validateUploadMetadata({
      fieldname: 'video',
      mimetype: 'video/mp4',
      originalname: 'too-large.mp4',
      size: VIDEO_LIMIT_BYTES + 1,
    }),
    (error) => error.statusCode === 413 && /100 MB/.test(error.message),
  );
});

test('enforces image limits and rejects MIME/extension mismatches', () => {
  assert.throws(() => validateUploadMetadata({
    fieldname: 'thumbnail',
    mimetype: 'image/png',
    originalname: 'spoofed.jpg',
    size: IMAGE_LIMIT_BYTES,
  }), /valid JPEG, PNG, or WebP image/);
});
