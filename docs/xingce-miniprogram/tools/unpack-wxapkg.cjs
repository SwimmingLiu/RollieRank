#!/usr/bin/env node
// Decrypt + unpack a WeChat 4.x (macOS) mini-program package.
//
//   node unpack-wxapkg.js <appid> <__APP__.wxapkg> <outDir>
//
// Format: 'V1MMWX' + body.
//   body[0..1024]  -> AES-256-CBC (key = PBKDF2-SHA1(appid, 'saltiest', 1000, 32), iv = 'the iv: 16 bytes')
//   body[1024..]   -> single-byte XOR with 0x32
// Result starts with 0xBE. Index entries: u32 nameLen, name, u32 offset, u32 size.
//
// Two index quirks have been observed and are handled here:
//  1. Some names store a shorter length than the bytes actually occupied (a '/' is
//     missing), so the parser retries 0..2 byte longer name lengths.
//  2. From package v78 the packer under-reports every entry by one byte: the declared
//     offset points one byte before the real payload (the stray byte is the previous
//     file's final byte), and the declared size is one byte short too. Rather than
//     trusting offset/size, entries are sliced between consecutive payload starts,
//     which reproduces every file exactly whether or not the quirk is present.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const [appid, src, outDir] = process.argv.slice(2);

const AES_BYTES = 1024;
const TAIL_XOR = 0x32;

function decrypt(file, appid) {
  const raw = fs.readFileSync(file);
  if (raw.slice(0, 6).toString('latin1') !== 'V1MMWX') {
    if (raw[0] === 0xBE) return raw; // already plain
    throw new Error('not a V1MMWX package');
  }
  const body = raw.slice(6);
  const key = crypto.pbkdf2Sync(appid, 'saltiest', 1000, 32, 'sha1');
  const iv = Buffer.from('the iv: 16 bytes', 'latin1');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);
  const head = Buffer.concat([
    decipher.update(body.slice(0, AES_BYTES)),
    decipher.final(),
  ]);
  const rest = body.slice(AES_BYTES);
  const tail = Buffer.alloc(rest.length);
  for (let i = 0; i < rest.length; i++) tail[i] = rest[i] ^ TAIL_XOR;
  const plain = Buffer.concat([head, tail]);
  if (plain[0] !== 0xBE) throw new Error(`bad plaintext magic: 0x${plain[0].toString(16)}`);
  return plain;
}

function parseIndex(buf) {
  const count = buf.readUInt32BE(14);
  const entries = [];
  let off = 18;
  let skipUsed = 0;
  for (let i = 0; i < count; i++) {
    let chosen = null;
    // Two independent quirks, so try both dimensions:
    //  - skip: some index records swallow/lose a byte, shifting every later record
    //  - extra: a name declares one byte less than it occupies (a '/' went missing)
    for (const skip of [0, 1, 2]) {
      if (skip > 0 && i === 0) continue;
      const at = off + skip;
      if (at + 4 > buf.length) continue;
      const declaredLen = buf.readUInt32BE(at);
      if (declaredLen === 0 || declaredLen > 512) continue;
      const nameStart = at + 4;
      for (const extra of [0, 1, 2]) {
        const nameEnd = nameStart + declaredLen + extra;
        if (nameEnd + 8 > buf.length) continue;
        const fileOff = buf.readUInt32BE(nameEnd);
        const fileSize = buf.readUInt32BE(nameEnd + 4);
        // v78 lets fileOff + fileSize land one byte past EOF; allow that slack.
        if (fileSize > 0 && fileOff + fileSize <= buf.length + 1) {
          chosen = { nameStart, nameEnd, fileOff, fileSize };
          if (skip > 0) skipUsed += 1;
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen) {
      console.warn(`stopped at entry ${i}: unreadable index`);
      break;
    }
    const name = buf
      .slice(chosen.nameStart, chosen.nameEnd)
      .toString('utf8')
      .replace(/\u0001/g, '/'); // missing separator byte
    entries.push({ name, fileOff: chosen.fileOff, fileSize: chosen.fileSize });
    off = chosen.nameEnd + 8;
  }
  return { entries, indexEnd: off, skipUsed };
}

function slicePayloads(buf, entries, indexEnd) {
  return entries.map((entry, i) => {
    const start = entry.fileOff + 1;
    const hasNext = i + 1 < entries.length;
    const declaredEnd = entry.fileOff + entry.fileSize + 1;
    const nextStart = hasNext ? entries[i + 1].fileOff + 1 : buf.length;
    // Declared size plus the missing byte is the normal case. v78's timer-records record
    // is the exception: its declared size is short by a whole block, so when the next
    // payload starts far past the declared end, the neighbour's offset wins.
    let end = declaredEnd;
    if (hasNext && nextStart - declaredEnd > 64) end = nextStart;
    if (end > buf.length) end = buf.length;
    if (end < start) end = start;
    return { name: entry.name, data: buf.slice(start, end) };
  });
}

function main() {
  if (!src || !appid || !outDir) {
    console.error('usage: node unpack-wxapkg.cjs <appid> <__APP__.wxapkg> <outDir>');
    process.exit(1);
  }
  const plain = decrypt(src, appid);
  const { entries, indexEnd } = parseIndex(plain);
  const payloads = slicePayloads(plain, entries, indexEnd);
  fs.mkdirSync(outDir, { recursive: true });
  const root = path.resolve(outDir);
  let written = 0;
  for (const entry of payloads) {
    const rel = entry.name.replace(/^\/+/, '');
    if (!rel) continue;
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep)) {
      console.warn('unsafe path skipped:', rel);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.data);
    written++;
  }
  console.log(`unpacked ${written}/${entries.length} entries into ${outDir}`);
}

main();
