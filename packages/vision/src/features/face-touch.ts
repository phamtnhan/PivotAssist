export interface FaceTouchResult {
  isFaceTouchDetected: boolean;
  overlapRatio: number;
}

export function detectFaceTouch(
  faceBox: { xMin: number; yMin: number; width: number; height: number },
  handLandmarksList?: Array<Array<{ x: number; y: number; z: number }>> | null,
): FaceTouchResult {
  if (!handLandmarksList || handLandmarksList.length === 0) {
    return { isFaceTouchDetected: false, overlapRatio: 0 };
  }

  const faceXMax = faceBox.xMin + faceBox.width;
  const faceYMax = faceBox.yMin + faceBox.height;

  let touchPointsCount = 0;
  let totalHandPoints = 0;

  for (const hand of handLandmarksList) {
    for (const point of hand) {
      totalHandPoints++;
      // Check if hand keypoint is within face bounding box
      if (
        point.x >= faceBox.xMin &&
        point.x <= faceXMax &&
        point.y >= faceBox.yMin &&
        point.y <= faceYMax
      ) {
        touchPointsCount++;
      }
    }
  }

  const overlapRatio = totalHandPoints > 0 ? touchPointsCount / totalHandPoints : 0;
  // If at least 3 hand landmarks enter the face box, detect touch event
  const isFaceTouchDetected = touchPointsCount >= 3;

  return {
    isFaceTouchDetected,
    overlapRatio: Math.round(overlapRatio * 100) / 100,
  };
}
