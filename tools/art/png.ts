import { deflateSync } from 'node:zlib';

/** RGBA image buffer with simple pixel helpers. */
export class Image {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8Array(width * height * 4);
  }

  set(x: number, y: number, rgba: readonly [number, number, number, number]): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const a = rgba[3] / 255;
    if (a >= 1) {
      this.data.set(rgba, i);
      return;
    }
    // Alpha-blend over what is already there.
    const da = this.data[i + 3]! / 255;
    const outA = a + da * (1 - a);
    for (let c = 0; c < 3; c++) {
      const v = outA === 0 ? 0 : (rgba[c]! * a + this.data[i + c]! * da * (1 - a)) / outA;
      this.data[i + c] = Math.round(v);
    }
    this.data[i + 3] = Math.round(outA * 255);
  }

  get(x: number, y: number): [number, number, number, number] {
    const i = (y * this.width + x) * 4;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!, this.data[i + 3]!];
  }

  /** Copies `src` scaled by an integer factor (nearest neighbour) to (dx, dy). */
  blit(src: Image, dx: number, dy: number, scale = 1): void {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const px = src.get(x, y);
        if (px[3] === 0) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) this.set(dx + x * scale + sx, dy + y * scale + sy, px);
        }
      }
    }
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, payload: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePng(img: Image): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(img.width, 0);
  header.writeUInt32BE(img.height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((img.width * 4 + 1) * img.height);
  for (let y = 0; y < img.height; y++) {
    raw[y * (img.width * 4 + 1)] = 0;
    Buffer.from(img.data.buffer, y * img.width * 4, img.width * 4).copy(
      raw,
      y * (img.width * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ]);
}
