import { BaselineGazeCalibration } from "@pivotassist/contracts";

export interface CalibrationSample {
  gazeVector: { x: number; y: number };
  interEyeDistance: number;
  headPose: { yaw: number; pitch: number; roll: number };
}

export class BaselineGazeCalibrator {
  private samples: CalibrationSample[] = [];
  private targetSampleCount: number;

  constructor(targetSampleCount: number = 30) {
    this.targetSampleCount = targetSampleCount;
  }

  addSample(sample: CalibrationSample): boolean {
    this.samples.push(sample);
    return this.isComplete();
  }

  isComplete(): boolean {
    return this.samples.length >= this.targetSampleCount;
  }

  getProgress(): number {
    return Math.min(1, this.samples.length / this.targetSampleCount);
  }

  computeBaseline(calibratedAtElapsedMs: number): BaselineGazeCalibration {
    if (this.samples.length === 0) {
      return {
        referenceGazeVector: { x: 0, y: 0 },
        normalizedInterEyeDistance: 0.25,
        neutralHeadPose: { yaw: 0, pitch: 0, roll: 0 },
        calibratedAtElapsedMs,
        sampleCount: 0,
      };
    }

    const n = this.samples.length;
    let sumGazeX = 0;
    let sumGazeY = 0;
    let sumInterEyeDist = 0;
    let sumYaw = 0;
    let sumPitch = 0;
    let sumRoll = 0;

    for (const s of this.samples) {
      sumGazeX += s.gazeVector.x;
      sumGazeY += s.gazeVector.y;
      sumInterEyeDist += s.interEyeDistance;
      sumYaw += s.headPose.yaw;
      sumPitch += s.headPose.pitch;
      sumRoll += s.headPose.roll;
    }

    return {
      referenceGazeVector: {
        x: sumGazeX / n,
        y: sumGazeY / n,
      },
      normalizedInterEyeDistance: sumInterEyeDist / n,
      neutralHeadPose: {
        yaw: sumYaw / n,
        pitch: sumPitch / n,
        roll: sumRoll / n,
      },
      calibratedAtElapsedMs,
      sampleCount: n,
    };
  }

  reset(): void {
    this.samples = [];
  }
}
