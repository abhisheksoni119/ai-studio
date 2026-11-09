// mp3duration.mjs — read an MP3's true length without ffmpeg or any dependency.
//
// Why this exists: on Windows, ffprobe is usually not on the PATH, and the
// probe through Remotion's bundled compositor can fail too. prepare.mjs then
// fell back to ESTIMATING the length from syllable count, which ran ~6% long
// on a real narration — leaving several seconds of captions with no voice
// behind them. Audio length must come from the audio.
//
// Handles: ID3v2 tags, Xing/Info and VBRI headers (VBR), constant bitrate,
// and as a last resort walks every frame.

import fs from 'fs';

// [MPEG version][layer] -> bitrate table index
const BITRATES = {
  // MPEG 1
  '1-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0],
  '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],
  '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  // MPEG 2 / 2.5
  '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
  '2-2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
  '2-3': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};

const SAMPLE_RATES = {
  1:   [44100, 48000, 32000, 0], // MPEG 1
  2:   [22050, 24000, 16000, 0], // MPEG 2
  2.5: [11025, 12000, 8000, 0],  // MPEG 2.5
};

/** Samples per frame, by MPEG version and layer. */
function samplesPerFrame(version, layer) {
  if (layer === 1) return 384;
  if (layer === 2) return 1152;
  return version === 1 ? 1152 : 576; // layer 3
}

/** Parse a 4-byte frame header. Returns null if these bytes are not a header. */
function parseHeader(buf, i) {
  if (i + 4 > buf.length) return null;
  if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) return null;

  const versionBits = (buf[i + 1] >> 3) & 0x03;
  if (versionBits === 1) return null; // reserved
  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;

  const layerBits = (buf[i + 1] >> 1) & 0x03;
  if (layerBits === 0) return null; // reserved
  const layer = 4 - layerBits;

  const bitrateIndex = (buf[i + 2] >> 4) & 0x0f;
  if (bitrateIndex === 0 || bitrateIndex === 15) return null; // free / bad

  const rateIndex = (buf[i + 2] >> 2) & 0x03;
  if (rateIndex === 3) return null;

  const table = BITRATES[`${version === 1 ? 1 : 2}-${layer}`];
  if (!table) return null;

  const bitrate = table[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[version][rateIndex];
  if (!bitrate || !sampleRate) return null;

  const padding = (buf[i + 2] >> 1) & 0x01;
  const spf = samplesPerFrame(version, layer);
  const frameLength = layer === 1
    ? Math.floor((12 * bitrate / sampleRate + padding) * 4)
    : Math.floor((spf / 8) * bitrate / sampleRate + padding);

  if (frameLength < 4) return null;

  const channelMode = (buf[i + 3] >> 6) & 0x03;
  return {version, layer, bitrate, sampleRate, frameLength, spf, channelMode};
}

/** Size of an ID3v2 tag at the start of the file, or 0. */
function id3Size(buf) {
  if (buf.length < 10) return 0;
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return 0; // "ID3"
  // syncsafe integer: 7 bits per byte
  const size = (buf[6] & 0x7f) * 2097152 + (buf[7] & 0x7f) * 16384 + (buf[8] & 0x7f) * 128 + (buf[9] & 0x7f);
  const footer = (buf[5] & 0x10) ? 10 : 0;
  return 10 + size + footer;
}

/** Frame count declared by a Xing/Info or VBRI header, if present. */
function vbrFrameCount(buf, frameStart, h) {
  // Xing/Info sits after the side information, whose length depends on the mode.
  const sideInfo = h.version === 1
    ? (h.channelMode === 3 ? 17 : 32)
    : (h.channelMode === 3 ? 9 : 17);
  const xing = frameStart + 4 + sideInfo;

  if (xing + 12 <= buf.length) {
    const tag = buf.toString('ascii', xing, xing + 4);
    if (tag === 'Xing' || tag === 'Info') {
      const flags = buf.readUInt32BE(xing + 4);
      if (flags & 0x01) return buf.readUInt32BE(xing + 8);
    }
  }

  // VBRI always sits 32 bytes after the header.
  const vbri = frameStart + 4 + 32;
  if (vbri + 26 <= buf.length && buf.toString('ascii', vbri, vbri + 4) === 'VBRI') {
    return buf.readUInt32BE(vbri + 14);
  }
  return 0;
}

/**
 * Duration of an MP3 file in seconds, or null if it cannot be read.
 * @param {string} filepath
 */
export function mp3Duration(filepath) {
  let buf;
  try {
    buf = fs.readFileSync(filepath);
  } catch {
    return null;
  }
  if (buf.length < 128) return null;

  // Find the first real frame, skipping any ID3v2 tag and junk.
  let start = id3Size(buf);
  let header = null;
  const limit = Math.min(buf.length - 4, start + 200000);
  for (let i = start; i < limit; i++) {
    const h = parseHeader(buf, i);
    if (!h) continue;
    // Confirm with the next frame, so a stray 0xFF does not fool us.
    const next = parseHeader(buf, i + h.frameLength);
    if (next || i + h.frameLength >= buf.length - 4) {
      header = h;
      start = i;
      break;
    }
  }
  if (!header) return null;

  // 1. VBR header gives an exact frame count.
  const frames = vbrFrameCount(buf, start, header);
  if (frames > 0) {
    return (frames * header.spf) / header.sampleRate;
  }

  // 2. Walk the frames. Exact for VBR and CBR alike, and fast enough:
  //    a 2-minute narration is a few thousand frames.
  let pos = start;
  let count = 0;
  let samples = 0;
  let bitrateSum = 0;
  while (pos + 4 <= buf.length) {
    const h = parseHeader(buf, pos);
    if (!h) {
      // Lost sync: scan forward for the next plausible header.
      let next = -1;
      for (let i = pos + 1; i < Math.min(buf.length - 4, pos + 8192); i++) {
        if (parseHeader(buf, i)) { next = i; break; }
      }
      if (next < 0) break;
      pos = next;
      continue;
    }
    count += 1;
    samples += h.spf;
    bitrateSum += h.bitrate;
    pos += h.frameLength;
  }

  if (count > 0 && samples > 0) return samples / header.sampleRate;

  // 3. Nothing parsed: fall back to constant-bitrate arithmetic.
  const audioBytes = buf.length - start;
  return bitrateSum > 0
    ? (audioBytes * 8) / (bitrateSum / Math.max(1, count))
    : (audioBytes * 8) / header.bitrate;
}
