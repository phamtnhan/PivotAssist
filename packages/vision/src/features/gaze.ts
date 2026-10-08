import { BaselineGazeCalibration } from "@pivotassist/contracts";
import { averageBlendshapePair } from "./gaze-blend.js";

export interface GazeResult {
  cameraAligned: boolean;
  deltaAngleDeg: number;
  isGazeDownward: boolean;
  rawGazeVector: { x: number; y: number };
}

/**
 * Computes gaze deviation relative to calibrated baseline
 */
export function estimateGaze(
  currentEyeLandmarks: {
    irisX: number;
    irisY: number;
    eyeCornerLeftX: number;
    eyeCornerRightX: number;
  },
  blendshapes: Record<string, number>,
  baseline: BaselineGazeCalibration | null,
): GazeResult {
  // Approximate gaze vector based on iris position relative to eye corners + blendshapes
  const eyeWidth = Math.max(
    0.001,
    currentEyeLandmarks.eyeCornerRightX - currentEyeLandmarks.eyeCornerLeftX,
  );
  const normalizedIrisX =
    (currentEyeLandmarks.irisX - currentEyeLandmarks.eyeCornerLeftX) / eyeWidth - 0.5;

  // Blendshapes for eye look direction
  const lookDown = averageBlendshapePair(
    blendshapes["eyeLookDownLeft"],
    blendshapes["eyeLookDownRight"],
  );
  const lookUp = averageBlendshapePair(blendshapes["eyeLookUpLeft"], blendshapes["eyeLookUpRight"]);
  const lookIn = averageBlendshapePair(blendshapes["eyeLookInLeft"], blendshapes["eyeLookInRight"]);
  const lookOut = averageBlendshapePair(
    blendshapes["eyeLookOutLeft"],
    blendshapes["eyeLookOutRight"],
  );

  const gazeX = normalizedIrisX + (lookOut - lookIn) * 0.5;
  const gazeY = lookDown - lookUp;

  const baselineX = baseline?.referenceGazeVector.x ?? 0;
  const baselineY = baseline?.referenceGazeVector.y ?? 0;

  const dx = gazeX - baselineX;
  const dy = gazeY - baselineY;

  // Estimate angular deviation in degrees (~45 deg max FOV)
  const deltaAngleDeg = Math.sqrt(dx * dx + dy * dy) * 45;

  // Downward gaze threshold
  const isGazeDownward = gazeY > 0.35 || dy > 0.3;

  // Camera aligned if within 15 degrees of calibrated baseline
  const cameraAligned = deltaAngleDeg <= 15.0;

  return {
    cameraAligned,
    deltaAngleDeg: Math.round(deltaAngleDeg * 10) / 10,
    isGazeDownward,
    rawGazeVector: { x: gazeX, y: gazeY },
  };
}
