/**
 * Codificação compacta da máscara do terreno: pares (valor, comprimento da
 * corrida em varint) + base64. Aceita qualquer valor por pixel
 * (0 = ar, 1 = terra, 2 = metal).
 */

export function encodeMask(mask: Uint8Array): string {
  const out: number[] = [];
  const push = (n: number) => {
    while (n >= 0x80) {
      out.push((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    out.push(n);
  };
  let i = 0;
  while (i < mask.length) {
    const v = mask[i];
    let run = 1;
    while (i + run < mask.length && mask[i + run] === v) run++;
    out.push(v);
    push(run);
    i += run;
  }
  return toBase64(Uint8Array.from(out));
}

export function decodeMask(data: string, into: Uint8Array): void {
  const bytes = fromBase64(data);
  let i = 0;
  let pos = 0;
  while (i < bytes.length) {
    const v = bytes[i++];
    let n = 0;
    let shift = 0;
    let b: number;
    do {
      b = bytes[i++];
      n |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    into.fill(v, pos, pos + n);
    pos += n;
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
