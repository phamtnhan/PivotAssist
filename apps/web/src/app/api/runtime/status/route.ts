import { NextResponse } from "next/server";
import { runtimeCapabilities } from "@/lib/runtime-capabilities";

export async function GET() {
  const capabilities = await runtimeCapabilities();
  return NextResponse.json({ success: true, ...capabilities });
}
