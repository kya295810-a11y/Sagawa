const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

function getConfig() {
  const cfg = {
    accountId: String(process.env.R2_ACCOUNT_ID || '').trim(),
    accessKeyId: String(process.env.R2_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: String(process.env.R2_SECRET_ACCESS_KEY || '').trim(),
    bucket: String(process.env.R2_BUCKET_NAME || '').trim(),
    publicUrl: String(process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, ''),
  };
  if (Object.values(cfg).some((value) => !value)) throw new Error('R2 media storage is not fully configured.');
  return cfg;
}
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (key, value, encoding) => crypto.createHmac('sha256', key).update(value).digest(encoding);
const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

async function request(method, key, body = Buffer.alloc(0), contentType = '') {
  const cfg = getConfig();
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const payloadHash = hash(body);
  const uri = `/${encodeURIComponent(cfg.bucket)}/${encodeKey(key)}`;
  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (contentType) headers['content-type'] = contentType;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name]}\n`).join('');
  const canonicalRequest = [method, uri, '', canonicalHeaders, names.join(';'), payloadHash].join('\n');
  const scope = `${date}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, hash(canonicalRequest)].join('\n');
  const kDate = hmac(Buffer.from(`AWS4${cfg.secretAccessKey}`), date);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign, 'hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  const response = await fetch(`https://${host}${uri}`, { method, headers, body: method === 'DELETE' ? undefined : body });
  if (!response.ok) throw new Error(`R2 ${method} failed (${response.status}).`);
}

async function uploadFile(file, folder) {
  if (!file?.path) return '';
  const cfg = getConfig();
  const extension = path.extname(file.filename || file.originalname || '').toLowerCase();
  const key = `${folder}/${crypto.randomUUID()}${extension}`;
  const body = await fs.readFile(file.path);
  await request('PUT', key, body, file.mimetype || 'application/octet-stream');
  await fs.unlink(file.path).catch(() => {});
  return `${cfg.publicUrl}/${encodeKey(key)}`;
}

function keyFromPublicUrl(value) {
  const cfg = getConfig();
  const prefix = `${cfg.publicUrl}/`;
  if (!String(value || '').startsWith(prefix)) return null;
  const key = String(value).slice(prefix.length);
  if (!key || key.includes('..')) return null;
  return decodeURIComponent(key);
}

async function deleteFile(value) {
  const key = keyFromPublicUrl(value);
  if (!key) return false;
  await request('DELETE', key);
  return true;
}

module.exports = { uploadFile, deleteFile };
