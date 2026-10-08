export interface HeadPoseResult {
  yaw: number; // Left (-) / Right (+) in degrees
  pitch: number; // Down (-) / Up (+) in degrees
  roll: number; // Tilt Left (-) / Tilt Right (+) in degrees
}

/**
 * Extracts Euler angles (yaw, pitch, roll) from transformation matrix or key face landmarks
 */
export function estimateHeadPose(
  facialTransformationMatrix?: number[] | null,
  keyLandmarks?: {
    noseTip: { x: number; y: number; z: number };
    chin: { x: number; y: number; z: number };
    leftEye: { x: number; y: number; z: number };
    rightEye: { x: number; y: number; z: number };
  },
): HeadPoseResult {
  // If MediaPipe 4x4 transformation matrix is provided
  if (facialTransformationMatrix && facialTransformationMatrix.length >= 16) {
    const m = facialTransformationMatrix;
    // Extract rotation from 4x4 column-major matrix
    const pitch = Math.asin(-Math.max(-1, Math.min(1, m[6]))); // R[2][1]
    const yaw = Math.atan2(m[2], m[10]); // R[0][2], R[2][2]
    const roll = Math.atan2(m[4], m[5]); // R[1][0], R[1][1]

    const radToDeg = 180 / Math.PI;
    return {
      yaw: Math.round(yaw * radToDeg * 10) / 10,
      pitch: Math.round(pitch * radToDeg * 10) / 10,
      roll: Math.round(roll * radToDeg * 10) / 10,
    };
  }

  // Fallback estimation using landmark geometry
  if (keyLandmarks) {
    const { noseTip, chin, leftEye, rightEye } = keyLandmarks;
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const eyeMidY = (leftEye.y + rightEye.y) / 2;

    const dx = noseTip.x - eyeMidX;
    const dy = noseTip.y - eyeMidY;

    // Approximate angles
    const yaw = (noseTip.x - eyeMidX) * 90;
    const pitch = (chin.y - eyeMidY - 0.2) * 90;
    const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

    return {
      yaw: Math.round(yaw * 10) / 10,
      pitch: Math.round(pitch * 10) / 10,
      roll: Math.round(roll * 10) / 10,
    };
  }

  return { yaw: 0, pitch: 0, roll: 0 };
}
