import type { DetectedType } from '../types';
import { MAGIC_BYTES, WEBP_MARKER } from '../config';

export function detectImageType(buffer: ArrayBuffer): DetectedType | null {
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 12) return null;

  for (const sig of MAGIC_BYTES) {
    if (bytes.length < sig.offset + sig.bytes.length) continue;

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (bytes[sig.offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      // For RIFF header, also verify WEBP marker at offset 8
      if (sig.type.ext === 'webp') {
        let webpMatch = true;
        for (let i = 0; i < WEBP_MARKER.length; i++) {
          if (bytes[8 + i] !== WEBP_MARKER[i]) {
            webpMatch = false;
            break;
          }
        }
        if (!webpMatch) continue; // RIFF but not WEBP
      }
      return sig.type;
    }
  }

  return null;
}
