export interface TTSConfig {
  provider: "cartesia";
  model: "sonic-multilingual" | "sonic-3";
  voiceId: string;
  language: "vi" | "en";
}

export function createCartesiaTTSOptions(language: "vi" | "en" = "vi"): TTSConfig {
  return {
    provider: "cartesia",
    model: "sonic-3",
    voiceId: process.env.CARTESIA_VOICE_ID || "cartesia_vi_natural_male_01",
    language,
  };
}
