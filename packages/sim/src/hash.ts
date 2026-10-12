/** Incremental 32-bit FNV-1a hash over integers and strings. */
export class Hasher {
  private h = 0x811c9dc5;

  int(n: number): this {
    const lo = n >>> 0;
    const hi = Math.floor(n / 0x100000000) | 0;
    this.word(lo);
    this.word(hi);
    return this;
  }

  str(s: string): this {
    this.int(s.length);
    for (let i = 0; i < s.length; i++) this.word(s.charCodeAt(i));
    return this;
  }

  hex(): string {
    return (this.h >>> 0).toString(16).padStart(8, '0');
  }

  private word(w: number): void {
    for (let shift = 0; shift < 32; shift += 8) {
      this.h ^= (w >>> shift) & 0xff;
      this.h = Math.imul(this.h, 0x01000193);
    }
  }
}

export function hashString(s: string): string {
  return new Hasher().str(s).hex();
}
