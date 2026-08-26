/**
 * Encodeur PNG minimal (RGBA 8 bits, non entrelacé).
 *
 * Écrit à la main plutôt qu'apporté par une dépendance : on n'a besoin que
 * d'écrire des images RGBA sans perte, le format le permet en une cinquantaine
 * de lignes, et cela garde la génération d'assets reproductible sans binaire
 * natif à installer.
 */
import { deflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Table CRC-32 du PNG (polynôme 0xEDB88320), calculée une fois. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** @param rgba Pixels en RGBA, 4 octets par pixel, ligne par ligne. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (rgba.length !== width * height * 4) {
    throw new Error(`taille de tampon invalide : ${rgba.length} pour ${width}×${height}`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); /* profondeur : 8 bits par canal */
  ihdr.writeUInt8(6, 9); /* type couleur : 6 = RGBA */
  ihdr.writeUInt8(0, 10); /* compression : deflate */
  ihdr.writeUInt8(0, 11); /* filtrage : adaptatif */
  ihdr.writeUInt8(0, 12); /* entrelacement : aucun */

  /* Chaque scanline est préfixée de son octet de filtre. Le filtre 0 (aucun)
     suffit ici : le bruit est incompressible, un filtre prédictif n'y gagnerait rien. */
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
