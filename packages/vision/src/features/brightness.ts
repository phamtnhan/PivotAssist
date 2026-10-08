export interface BrightnessResult {
  brightnessScore: number; // 0 to 100
  isLowLighting: boolean;
  isOverexposed: boolean;
}

export function estimateBrightnessFromImageData(
  imageData: ImageData | { data: Uint8ClampedArray; width: number; height: number },
): BrightnessResult {
  const data = imageData.data;
  let totalLuminance = 0;
  const pixelCount = data.length / 4;

  // Sample every 4th pixel for speed
  let sampleCount = 0;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Standard relative luminance (ITU-R BT.709)
    totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sampleCount++;
  }

  const avgLuminance = sampleCount > 0 ? totalLuminance / sampleCount : 128;
  const brightnessScore = Math.round((avgLuminance / 255) * 100);

  const isLowLighting = brightnessScore < 30;
  const isOverexposed = brightnessScore > 88;

  return {
    brightnessScore,
    isLowLighting,
    isOverexposed,
  };
}
