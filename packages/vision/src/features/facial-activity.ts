export interface FacialActivityResult {
  smileScore: number;
  isSmiling: boolean;
  eyeOpennessScore: number;
  browMovementScore: number;
}

export function evaluateFacialActivity(blendshapes: Record<string, number>): FacialActivityResult {
  const smileLeft = blendshapes["mouthSmileLeft"] || 0;
  const smileRight = blendshapes["mouthSmileRight"] || 0;
  const smileScore = Math.round(((smileLeft + smileRight) / 2) * 100) / 100;
  const isSmiling = smileScore >= 0.35;

  const eyeWideLeft = blendshapes["eyeWideLeft"] || 0;
  const eyeWideRight = blendshapes["eyeWideRight"] || 0;
  const eyeBlinkLeft = blendshapes["eyeBlinkLeft"] || 0;
  const eyeBlinkRight = blendshapes["eyeBlinkRight"] || 0;
  const eyeOpennessScore =
    Math.round(
      (1 - (eyeBlinkLeft + eyeBlinkRight) / 2 + (eyeWideLeft + eyeWideRight) * 0.5) * 100,
    ) / 100;

  const browDownLeft = blendshapes["browDownLeft"] || 0;
  const browDownRight = blendshapes["browDownRight"] || 0;
  const browInnerUp = blendshapes["browInnerUp"] || 0;
  const browMovementScore =
    Math.round(((browDownLeft + browDownRight) / 2 + browInnerUp) * 100) / 100;

  return {
    smileScore,
    isSmiling,
    eyeOpennessScore: Math.max(0, Math.min(1, eyeOpennessScore)),
    browMovementScore: Math.min(1, browMovementScore),
  };
}
