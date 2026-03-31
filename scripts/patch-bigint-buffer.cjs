/**
 * Patch bigint-buffer to use pure JS implementation instead of vulnerable native C++ addon.
 *
 * Vulnerability: GHSA-3gc7-fjrx-p6mg — Buffer Overflow via toBigIntLE()
 * The native C++ binding is vulnerable. The library's own pure-JS fallback is safe.
 * This patch replaces the compiled output to always use the JS codepath.
 *
 * See: https://github.com/nicolo-ribaudo/tc39-bigint-buffer/issues/1
 */

const fs = require('fs');
const path = require('path');

const BIGINT_BUFFER_DIR = path.join(__dirname, '..', 'node_modules', 'bigint-buffer');

if (!fs.existsSync(BIGINT_BUFFER_DIR)) {
  console.log('bigint-buffer not found — skipping patch');
  process.exit(0);
}

// Pure JS implementation — same logic as bigint-buffer's own browser/fallback path,
// but we force it unconditionally so the vulnerable native addon is never loaded.
const SAFE_IMPLEMENTATION = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBigIntLE = toBigIntLE;
exports.toBigIntBE = toBigIntBE;
exports.toBufferLE = toBufferLE;
exports.toBufferBE = toBufferBE;

/**
 * Convert a little-endian buffer into a BigInt.
 * @param {Buffer} buf The little-endian buffer to convert.
 * @returns {bigint} A BigInt with the little-endian representation of buf.
 */
function toBigIntLE(buf) {
  const reversed = Buffer.from(buf);
  reversed.reverse();
  const hex = reversed.toString('hex');
  if (hex.length === 0) {
    return BigInt(0);
  }
  return BigInt('0x' + hex);
}

/**
 * Convert a big-endian buffer into a BigInt.
 * @param {Buffer} buf The big-endian buffer to convert.
 * @returns {bigint} A BigInt with the big-endian representation of buf.
 */
function toBigIntBE(buf) {
  const hex = buf.toString('hex');
  if (hex.length === 0) {
    return BigInt(0);
  }
  return BigInt('0x' + hex);
}

/**
 * Convert a BigInt to a little-endian buffer.
 * @param {bigint} num The BigInt to convert.
 * @param {number} width The number of bytes that the resulting buffer should be.
 * @returns {Buffer} A little-endian buffer representation of num.
 */
function toBufferLE(num, width) {
  const hex = num.toString(16);
  const buffer = Buffer.from(hex.padStart(width * 2, '0').slice(0, width * 2), 'hex');
  buffer.reverse();
  return buffer;
}

/**
 * Convert a BigInt to a big-endian buffer.
 * @param {bigint} num The BigInt to convert.
 * @param {number} width The number of bytes that the resulting buffer should be.
 * @returns {Buffer} A big-endian buffer representation of num.
 */
function toBufferBE(num, width) {
  const hex = num.toString(16);
  return Buffer.from(hex.padStart(width * 2, '0').slice(0, width * 2), 'hex');
}
`;

// Find all possible entry points for bigint-buffer
const targets = [
  path.join(BIGINT_BUFFER_DIR, 'dist', 'node.js'),
  path.join(BIGINT_BUFFER_DIR, 'dist', 'browser.js'),
  path.join(BIGINT_BUFFER_DIR, 'dist', 'index.js'),
];

let patched = 0;
for (const target of targets) {
  if (fs.existsSync(target)) {
    fs.writeFileSync(target, SAFE_IMPLEMENTATION);
    patched++;
  }
}

// Also patch the main entry if it points to a different file
const pkg = JSON.parse(fs.readFileSync(path.join(BIGINT_BUFFER_DIR, 'package.json'), 'utf8'));
const mainEntry = path.join(BIGINT_BUFFER_DIR, pkg.main || 'index.js');
if (fs.existsSync(mainEntry) && !targets.includes(mainEntry)) {
  fs.writeFileSync(mainEntry, SAFE_IMPLEMENTATION);
  patched++;
}

if (patched > 0) {
  console.log(`Patched ${patched} bigint-buffer file(s) — native C++ addon disabled, using safe pure-JS`);
} else {
  console.warn('bigint-buffer: no files found to patch');
}
