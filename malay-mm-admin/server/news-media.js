const path = require('path');

const IMAGE_LIMIT_BYTES = 10 * 1024 * 1024;
const VIDEO_LIMIT_BYTES = 100 * 1024 * 1024;

const fieldRules = {
  image: {
    kind: 'image',
    limit: IMAGE_LIMIT_BYTES,
    mimeExtensions: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
  },
  thumbnail: {
    kind: 'thumbnail',
    limit: IMAGE_LIMIT_BYTES,
    mimeExtensions: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
  },
  video: {
    kind: 'video',
    limit: VIDEO_LIMIT_BYTES,
    mimeExtensions: {
      'video/mp4': ['.mp4', '.m4v'],
      'video/quicktime': ['.mov'],
      'video/webm': ['.webm'],
    },
  },
};

function uploadError(message, statusCode = 422) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateUploadMetadata(file) {
  const rule = fieldRules[file?.fieldname];
  if (!rule) throw uploadError('Unexpected upload field.');

  const extension = path.extname(path.basename(file.originalname || '')).toLowerCase();
  const allowedExtensions = rule.mimeExtensions[file.mimetype];
  if (!allowedExtensions || !allowedExtensions.includes(extension)) {
    const expected = rule.kind === 'video' ? 'MP4, MOV, or WebM video' : 'JPEG, PNG, or WebP image';
    throw uploadError(`${file.fieldname} must be a valid ${expected}.`);
  }

  if (Number(file.size) > rule.limit) {
    const limitLabel = rule.kind === 'video' ? '100 MB' : '10 MB';
    throw uploadError(`${file.fieldname} must be ${limitLabel} or smaller.`, 413);
  }

  return { extension: allowedExtensions[0], rule };
}

function fileMatchesSignature(filePath, mimetype, fs) {
  const header = Buffer.alloc(16);
  const descriptor = fs.openSync(filePath, 'r');
  try {
    fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }

  if (mimetype === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (mimetype === 'image/png') {
    return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimetype === 'image/webp') {
    return header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mimetype === 'video/webm') {
    return header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  if (mimetype === 'video/mp4' || mimetype === 'video/quicktime') {
    return header.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  return false;
}

module.exports = {
  IMAGE_LIMIT_BYTES,
  VIDEO_LIMIT_BYTES,
  fieldRules,
  fileMatchesSignature,
  validateUploadMetadata,
};
