import { billingMode, vietQrConfig } from "@/lib/billing";
import { isGeminiConfigured, geminiProviderLabel } from "@/lib/gemini-server";
import { isLiveKitConfigured } from "@/lib/livekit";
import { momoConfig } from "@/lib/momo";
import { isTesseractAvailable } from "@/lib/resume-extract";

export async function runtimeCapabilities() {
  const vietqr = vietQrConfig();
  const momo = momoConfig();
  const tesseractAvailable = await isTesseractAvailable();
  return {
    gemini: {
      configured: isGeminiConfigured(),
      provider: geminiProviderLabel(),
    },
    livekit: {
      configured: isLiveKitConfigured(),
    },
    ocr: {
      tesseractAvailable,
      engine: tesseractAvailable ? "tesseract-cli" : "image-ocr-unavailable",
    },
    billing: {
      mode: billingMode(),
      vietqrConfigured: vietqr.configured,
      staticQrUrl: vietqr.staticQrUrl || null,
      momoConfigured: momo.configured,
    },
    esco: {
      mappingAvailable: false,
    },
    tts: {
      provider: "google-translate-tts",
      localGpu: false,
    },
  };
}
