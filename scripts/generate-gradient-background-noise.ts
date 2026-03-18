import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const OUTPUT_PATH = resolve(
  process.cwd(),
  "assets/textures/gradient-background-noise.png"
);

// Output / repeat configuration
const OUTPUT_SIZE = 512;
const SEED = 30260500;
const SEAMLESS_WRAP_ENABLED = true;

// Fine paper tooth
const BASE_GRAIN_INTENSITY = 0.4;
const BASE_GRAIN_SCALE = 1.25;

// Larger cloudy variation to avoid flat TV static
const LOW_FREQUENCY_INTENSITY = 0.5;
const LOW_FREQUENCY_SCALE = 100;

// High-pass shaping to reduce local hot-spots while keeping fine tooth
const HIGH_PASS_RADIUS = 6;
const HIGH_PASS_STRENGTH = 0.92;
const HIGH_PASS_MIX = 0.88;
const TARGET_MEAN = 0.24;
const TARGET_VARIANCE = 0.08;

// Tonal shaping
const BLUR_RADIUS = 0;
const CONTRAST = 1.04;
const BRIGHTNESS_BIAS = -0.06;
const ALPHA_CURVE = 1.14;
const FLECK_INTENSITY = 0.01;

type NoiseField = {
  cellCount: number;
  values: Float32Array;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const lerp = (start: number, end: number, t: number) =>
  start + (end - start) * t;

const fade = (t: number) => t * t * (3 - 2 * t);

const mulberry32 = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const createNoiseField = (cellCount: number, seed: number): NoiseField => {
  const values = new Float32Array(cellCount * cellCount);
  const random = mulberry32(seed);

  for (let index = 0; index < values.length; index += 1) {
    values[index] = random();
  }

  return { cellCount, values };
};

const getNoiseValue = (field: NoiseField, x: number, y: number) => {
  const wrappedX = ((x % field.cellCount) + field.cellCount) % field.cellCount;
  const wrappedY = ((y % field.cellCount) + field.cellCount) % field.cellCount;
  return field.values[wrappedY * field.cellCount + wrappedX];
};

const sampleNoiseField = (
  field: NoiseField,
  x: number,
  y: number,
  size: number
) => {
  const scaledX = (x / size) * field.cellCount;
  const scaledY = (y / size) * field.cellCount;
  const x0 = Math.floor(scaledX);
  const y0 = Math.floor(scaledY);
  const tx = fade(scaledX - x0);
  const ty = fade(scaledY - y0);

  const topLeft = getNoiseValue(field, x0, y0);
  const topRight = getNoiseValue(field, x0 + 1, y0);
  const bottomLeft = getNoiseValue(field, x0, y0 + 1);
  const bottomRight = getNoiseValue(field, x0 + 1, y0 + 1);

  return lerp(
    lerp(topLeft, topRight, tx),
    lerp(bottomLeft, bottomRight, tx),
    ty
  );
};

const createWrappedBlur = (
  source: Float32Array,
  size: number,
  radius: number
) => {
  if (radius <= 0) {
    return source;
  }

  const horizontal = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  const kernelWidth = radius * 2 + 1;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let sum = 0;

      for (let offset = -radius; offset <= radius; offset += 1) {
        const sampleX = (x + offset + size) % size;
        sum += source[y * size + sampleX];
      }

      horizontal[y * size + x] = sum / kernelWidth;
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let sum = 0;

      for (let offset = -radius; offset <= radius; offset += 1) {
        const sampleY = (y + offset + size) % size;
        sum += horizontal[sampleY * size + x];
      }

      output[y * size + x] = sum / kernelWidth;
    }
  }

  return output;
};

const normalizeField = (
  source: Float32Array,
  targetMean: number,
  targetVariance: number
) => {
  let sum = 0;

  for (let index = 0; index < source.length; index += 1) {
    sum += source[index];
  }

  const mean = sum / source.length;
  let varianceSum = 0;

  for (let index = 0; index < source.length; index += 1) {
    const centered = source[index] - mean;
    varianceSum += centered * centered;
  }

  const stdDev = Math.sqrt(varianceSum / source.length) || 1;
  const output = new Float32Array(source.length);

  for (let index = 0; index < source.length; index += 1) {
    const centered = (source[index] - mean) / stdDev;
    output[index] = centered * targetVariance + targetMean;
  }

  return output;
};

const createTextureData = () => {
  const baseField = createNoiseField(
    Math.max(2, Math.round(OUTPUT_SIZE / BASE_GRAIN_SCALE)),
    SEED
  );
  const detailField = createNoiseField(
    Math.max(2, Math.round((OUTPUT_SIZE / BASE_GRAIN_SCALE) * 1.8)),
    SEED + 1
  );
  const lowField = createNoiseField(
    Math.max(2, Math.round(OUTPUT_SIZE / LOW_FREQUENCY_SCALE)),
    SEED + 2
  );

  const values = new Float32Array(OUTPUT_SIZE * OUTPUT_SIZE);

  for (let y = 0; y < OUTPUT_SIZE; y += 1) {
    for (let x = 0; x < OUTPUT_SIZE; x += 1) {
      const sampleX = SEAMLESS_WRAP_ENABLED ? x : x + 0.5;
      const sampleY = SEAMLESS_WRAP_ENABLED ? y : y + 0.5;
      const base = sampleNoiseField(baseField, sampleX, sampleY, OUTPUT_SIZE);
      const detail = sampleNoiseField(
        detailField,
        sampleX,
        sampleY,
        OUTPUT_SIZE
      );
      const low = sampleNoiseField(lowField, sampleX, sampleY, OUTPUT_SIZE);

      const grain =
        BASE_GRAIN_INTENSITY *
        (base * 0.44 + detail * 0.56 + Math.abs(base - detail) * 0.22);
      const lowVariation = LOW_FREQUENCY_INTENSITY * (low * 0.9 + 0.1);
      const flecks = Math.max(0, detail - 0.72) * FLECK_INTENSITY;

      values[y * OUTPUT_SIZE + x] = grain * 0.84 + lowVariation * 0.16 + flecks;
    }
  }

  const localAverage = createWrappedBlur(values, OUTPUT_SIZE, HIGH_PASS_RADIUS);
  const highPassed = new Float32Array(values.length);

  for (let index = 0; index < values.length; index += 1) {
    const detail = values[index] - localAverage[index] * HIGH_PASS_STRENGTH;
    highPassed[index] = lerp(values[index], detail + 0.5, HIGH_PASS_MIX);
  }

  const normalized = normalizeField(highPassed, TARGET_MEAN, TARGET_VARIANCE);
  const blurred = createWrappedBlur(normalized, OUTPUT_SIZE, BLUR_RADIUS);

  for (let index = 0; index < blurred.length; index += 1) {
    const contrasted =
      (blurred[index] - 0.5) * CONTRAST + 0.5 + BRIGHTNESS_BIAS;
    blurred[index] = clamp01(contrasted) ** ALPHA_CURVE;
  }

  return blurred;
};

const createCrc32Table = () => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      if ((value & 1) === 1) {
        value = 0xedb88320 ^ (value >>> 1);
      } else {
        value >>>= 1;
      }
    }

    table[index] = value >>> 0;
  }

  return table;
};

const CRC32_TABLE = createCrc32Table();

const crc32 = (buffer: Buffer) => {
  let crc = 0xffffffff;

  for (let index = 0; index < buffer.length; index += 1) {
    crc =
      CRC32_TABLE[(crc ^ buffer[index]) & 0xff] ^ ((crc >>> 8) & 0x00ffffff);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const createChunk = (type: string, data: Buffer) => {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
};

const createPngBuffer = (alphaData: Float32Array, size: number) => {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowStride = size * 4 + 1;
  const raw = Buffer.alloc(rowStride * size);

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * rowStride;
    raw[rowStart] = 0;

    for (let x = 0; x < size; x += 1) {
      const pixelIndex = y * size + x;
      const dataStart = rowStart + 1 + x * 4;
      raw[dataStart] = 0;
      raw[dataStart + 1] = 0;
      raw[dataStart + 2] = 0;
      raw[dataStart + 3] = Math.round(clamp01(alphaData[pixelIndex]) * 255);
    }
  }

  const compressed = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", compressed),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
};

const textureData = createTextureData();
const pngBuffer = createPngBuffer(textureData, OUTPUT_SIZE);

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, pngBuffer);

console.log(`Generated ${OUTPUT_PATH}`);
