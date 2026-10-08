import { SignJWT } from "jose";

export function isLiveKitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL?.trim() &&
    process.env.LIVEKIT_API_KEY?.trim() &&
    process.env.LIVEKIT_API_SECRET?.trim(),
  );
}

export function liveKitUrl(): string | null {
  return process.env.LIVEKIT_URL?.trim() || null;
}

export async function createLiveKitParticipantToken(input: {
  identity: string;
  name: string;
  roomName: string;
}): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY / LIVEKIT_API_SECRET chưa được cấu hình.");
  }
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    name: input.name,
    video: {
      room: input.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(apiKey)
    .setSubject(input.identity)
    .setNotBefore(now - 10)
    .setExpirationTime(now + 60 * 60)
    .sign(new TextEncoder().encode(apiSecret));
}
