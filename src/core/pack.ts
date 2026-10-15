/** Compacta texto para caber num link: deflate + base64 seguro para URL. */

function toB64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(data: Uint8Array, t: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(t);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function pack(text: string): Promise<string> {
  return toB64Url(await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw')));
}

/** null se o texto estiver corrompido. */
export async function unpack(code: string): Promise<string | null> {
  try {
    return new TextDecoder().decode(await pipe(fromB64Url(code), new DecompressionStream('deflate-raw')));
  } catch {
    return null;
  }
}
