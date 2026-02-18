export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function contentHash(data: ArrayBuffer): Promise<string> {
  const hex = await sha256Hex(data);
  return hex.slice(0, 24); // first 12 bytes = 24 hex chars
}

export async function generateDeleteToken(hash: string, timestamp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(hash + timestamp + crypto.randomUUID());
  const hex = await sha256Hex(data.buffer as ArrayBuffer);
  return hex.slice(0, 32);
}

export async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const hex = await sha256Hex(encoder.encode(ip).buffer as ArrayBuffer);
  return hex.slice(0, 16);
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  return sha256Hex(encoder.encode(token).buffer as ArrayBuffer);
}
