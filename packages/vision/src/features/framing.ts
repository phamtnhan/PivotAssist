export interface FramingResult {
  centerOffsetX: number; // Offset from 0.5 (ideal center)
  centerOffsetY: number; // Offset from 0.5
  normalizedFaceScale: number; // Scale ratio relative to frame
  isWellFramed: boolean;
}

export function evaluateFraming(faceBoundingBox: {
  xMin: number;
  yMin: number;
  width: number;
  height: number;
}): FramingResult {
  const centerX = faceBoundingBox.xMin + faceBoundingBox.width / 2;
  const centerY = faceBoundingBox.yMin + faceBoundingBox.height / 2;

  const centerOffsetX = Math.round((centerX - 0.5) * 1000) / 1000;
  const centerOffsetY = Math.round((centerY - 0.5) * 1000) / 1000;

  // Face scale proportional to frame height (~0.3 to 0.5 is ideal for headshots)
  const normalizedFaceScale = Math.round(faceBoundingBox.height * 1000) / 1000;

  // Well-framed if center offset is within 15% of frame and scale is between 0.25 and 0.65
  const isWellFramed =
    Math.abs(centerOffsetX) <= 0.15 &&
    Math.abs(centerOffsetY) <= 0.15 &&
    normalizedFaceScale >= 0.25 &&
    normalizedFaceScale <= 0.65;

  return {
    centerOffsetX,
    centerOffsetY,
    normalizedFaceScale,
    isWellFramed,
  };
}
