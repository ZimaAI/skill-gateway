import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { unzip } from '../src/zip.js';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.from(entry.content, 'utf8');
    const method = entry.method || 0;
    const content = method === 8 ? deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt32LE(crc32(content), 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    localParts.push(local, content);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length + content.length;
  }

  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, eocd]);
}

test('unzip reads stored entries and skips directory records', () => {
  const zip = storedZip([
    { name: 'tdd-main/', content: '' },
    { name: 'tdd-main/SKILL.md', content: '---\nname: tdd\ndescription: test first\n---\n' },
    { name: 'tdd-main/examples/flow.md', content: '# flow' },
  ]);
  const files = unzip(zip);
  assert.deepEqual(files.map((file) => file.path), ['tdd-main/SKILL.md', 'tdd-main/examples/flow.md']);
  assert.match(files[0].content, /name: tdd/);
});

test('unzip reads deflated entries', () => {
  const zip = storedZip([
    { name: 'tdd-main/SKILL.md', content: '---\nname: tdd\ndescription: test first\n---\n', method: 8 },
  ]);
  const files = unzip(zip);
  assert.equal(files.length, 1);
  assert.match(files[0].content, /name: tdd/);
});

test('unzip rejects a missing end record', () => {
  assert.throws(() => unzip(Buffer.from('not a zip')), /End of Central Directory/);
});
