/**
 * Minimal ZIP reader sufficient for skill uploads.
 *
 * Supports uncompressed (method 0) and deflate (method 8) entries, including a
 * single top-level wrapper folder. Zip64 and encrypted entries are rejected
 * with a clear error rather than parsed incorrectly.
 */

import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MIN_EOCD = 22;
const MAX_COMMENT = 0xffff;

function readU16(buffer, offset) {
  return buffer.readUInt16LE(offset);
}
function readU32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function findEocd(buffer) {
  const tailStart = Math.max(0, buffer.length - MIN_EOCD - MAX_COMMENT);
  for (let offset = buffer.length - MIN_EOCD; offset >= tailStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      const commentLength = readU16(buffer, offset + 20);
      if (offset + MIN_EOCD + commentLength === buffer.length) {
        return offset;
      }
    }
  }
  throw new Error('ZIP 文件缺少 End of Central Directory 记录。');
}

function parseCentralDirectory(buffer, eocdOffset) {
  const count = readU16(buffer, eocdOffset + 10);
  let offset = readU32(buffer, eocdOffset + 16);
  const entries = [];

  for (let index = 0; index < count; index += 1) {
    if (readU32(buffer, offset) !== CENTRAL_SIGNATURE) {
      throw new Error(`ZIP 中央目录条目 ${index} 损坏。`);
    }
    const flags = readU16(buffer, offset + 8);
    const method = readU16(buffer, offset + 10);
    const compressedSize = readU32(buffer, offset + 20);
    const nameLength = readU16(buffer, offset + 28);
    const extraLength = readU16(buffer, offset + 30);
    const commentLength = readU16(buffer, offset + 32);
    const localOffset = readU32(buffer, offset + 42);
    const nameBytes = buffer.subarray(offset + 46, offset + 46 + nameLength);
    const name = nameBytes.toString('utf8');

    if (flags & 0x1) {
      throw new Error(`ZIP 加密条目不受支持：${name}`);
    }
    if (method !== 0 && method !== 8) {
      throw new Error(`ZIP 压缩方式 ${method} 不受支持：${name}`);
    }

    entries.push({
      name,
      method,
      compressedSize,
      localOffset,
      flags,
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readLocalData(buffer, entry) {
  const offset = entry.localOffset;
  if (readU32(buffer, offset) !== LOCAL_SIGNATURE) {
    throw new Error(`ZIP 本地文件头损坏：${entry.name}`);
  }
  const nameLength = readU16(buffer, offset + 26);
  const extraLength = readU16(buffer, offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  const compressed = buffer.subarray(dataStart, dataEnd);

  if (entry.method === 0) return Buffer.from(compressed);
  return inflateRawSync(compressed);
}

/**
 * @param {Uint8Array|ArrayBuffer|Buffer} data
 * @returns {Array<{path: string, content: string}>}
 */
export function unzip(data) {
  const buffer = Buffer.isBuffer(data)
    ? data
    : Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
  if (!buffer.length) throw new Error('ZIP 文件为空。');

  const eocdOffset = findEocd(buffer);
  const entries = parseCentralDirectory(buffer, eocdOffset);
  const files = [];

  for (const entry of entries) {
    if (entry.name.endsWith('/')) continue;
    const content = readLocalData(buffer, entry);
    files.push({ path: entry.name, content: content.toString('utf8') });
  }
  return files;
}
