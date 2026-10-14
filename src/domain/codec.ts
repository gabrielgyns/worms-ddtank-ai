/** Codificação compacta da máscara do terreno: run-length + varint + base64. */

export function encodeMask(mask: Uint8Array): string {
  const out: number[] = [];
  const push = (n: number) => {
    while (n >= 0x80) {
      out.push((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    out.push(n);
  };
  // corridas alternadas começando por 0 (ar)
  let cur = 0;
  let run = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === cur) run++;
    else {
      push(run);
      cur = mask[i];
      run = 1;
    }
  }
  push(run);
  return toBase64(Uint8Array.from(out));
}

export function decodeMask(data: string, into: Uint8Array): void {
  const bytes = fromBase64(data);
  let i = 0;
  let pos = 0;
  let cur = 0;
  while (i < bytes.length) {
    let n = 0;
    let shift = 0;
    let b: number;
    do {
      b = bytes[i++];
      n |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    into.fill(cur, pos, pos + n);
    pos += n;
    cur ^= 1;
  }
}

function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
