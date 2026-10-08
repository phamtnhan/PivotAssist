export interface STTConfig {
  provider: "deepgram";
  model: "nova-3" | "nova-2";
  language: "vi" | "en";
  punctuate: boolean;
  endpointingMs: number;
}

export function createDeepgramSTTOptions(language: "vi" | "en" = "vi"): STTConfig {
  return {
    provider: "deepgram",
    model: "nova-3",
    language,
    punctuate: true,
    endpointingMs: 300, // fast speech endpointing for low latency
  };
}
