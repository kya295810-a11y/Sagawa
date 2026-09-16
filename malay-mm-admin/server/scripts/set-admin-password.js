#!/usr/bin/env node

'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Writable } = require('stream');

const ENV_PATH = path.resolve(__dirname, '..', '..', '.env');
const BCRYPT_COST = 12;

function validatePasswordPolicy(password) {
  if (password.length < 12) return 'Password must be at least 12 characters long.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/\d/.test(password)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character.';
  return '';
}

function createSecretPrompt() {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  output.isTTY = true;
  output.columns = process.stdout.columns || 80;

  const terminal = readline.createInterface({ input: process.stdin, output, terminal: true });
  return async (label) => {
    process.stdout.write(label);
    muted = true;
    try {
      return await new Promise((resolve) => terminal.question('', resolve));
    } finally {
      muted = false;
      process.stdout.write('\n');
    }
  };
}

function replaceEnvValue(envContents, name, value) {
  const linePattern = new RegExp(`^(\\s*(?:export\\s+)?${name}\\s*=).*$`, 'gm');
  const matches = [...envContents.matchAll(linePattern)];
  if (matches.length > 1) {
    throw new Error(`${name} appears more than once in the local .env file. Resolve duplicates first.`);
  }
  if (matches.length === 1) return envContents.replace(linePattern, (_match, prefix) => `${prefix}${value}`);
  return `${envContents}${envContents.endsWith('\n') ? '' : '\n'}${name}=${value}\n`;
}

function writeAtomically(filePath, contents) {
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tempPath, contents, { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(tempPath, 0o600);
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Run this command interactively in a terminal; passwords are not accepted from command-line arguments or environment variables.');
  }

  let stat;
  try {
    stat = fs.lstatSync(ENV_PATH);
  } catch {
    throw new Error(`Local .env file not found at ${ENV_PATH}. Create it from .env.example first.`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Local .env path must be a regular file.');

  const askSecret = createSecretPrompt();
  const password = await askSecret('New admin password: ');
  const confirmation = await askSecret('Confirm new admin password: ');
  if (password !== confirmation) throw new Error('Password confirmation does not match.');

  const policyError = validatePasswordPolicy(password);
  if (policyError) throw new Error(policyError);

  const current = fs.readFileSync(ENV_PATH, 'utf8');
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  let next = replaceEnvValue(current, 'ADMIN_PASSWORD_HASH', passwordHash);
  const existingSessionSecret = String(dotenv.parse(current).SESSION_SECRET || '').trim();
  if (existingSessionSecret.length < 32) {
    next = replaceEnvValue(next, 'SESSION_SECRET', crypto.randomBytes(48).toString('base64url'));
  }
  writeAtomically(ENV_PATH, next);
  console.log('Admin password hash updated successfully. Session configuration is ready.');
}

main().catch((error) => {
  console.error(`Admin password was not changed: ${error.message}`);
  process.exitCode = 1;
});
