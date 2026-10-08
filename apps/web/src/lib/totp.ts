import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import QRCode from "qrcode";
import { requireJwtSecret } from "@/lib/jwt-secret";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function secretKey(): Buffer {
  return createHash("sha256").update(requireJwtSecret()).digest();
}

export function generateTotpSecret(byteLength = 20): string {
  const bytes = randomBytes(byteLength);
  let bits = "";
  for (const value of bytes) bits += value.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index + 5 <= bits.length; index += 5) {
    output += BASE32[Number.parseInt(bits.slice(index, index + 5), 2)];
  }
  return output;
}

export function decodeBase32(secret: string): Buffer {
  const cleaned = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of cleaned) {
    const value = BASE32.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotp(
  secret: string,
  timestamp = Date.now(),
  stepSeconds = 30,
  digits = 6,
): string {
  const counter = Math.floor(timestamp / 1000 / stepSeconds);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const now = Date.now();
  const presented = Buffer.from(normalized);
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = Buffer.from(generateTotp(secret, now + offset * 30_000));
    if (expected.length === presented.length && timingSafeEqual(expected, presented)) return true;
  }
  return false;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSecret(payload: string): string | null {
  try {
    const buffer = Buffer.from(payload, "base64url");
    if (buffer.length < 29) return null;
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const data = buffer.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function otpauthUrl(email: string, secret: string): string {
  const label = encodeURIComponent(`PivotAssist:${email}`);
  const issuer = encodeURIComponent("PivotAssist");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
}

export async function qrImageUrl(otpauth: string): Promise<string> {
  return QRCode.toDataURL(otpauth, {
    margin: 2,
    width: 200,
    errorCorrectionLevel: "M",
  });
}
