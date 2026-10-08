import {
  BaselineGazeCalibration,
  VisualTelemetrySample,
  VisualEvent,
} from "@pivotassist/contracts";
import { BaselineGazeCalibrator } from "../calibration/gaze-calibration.js";
import { estimateGaze } from "../features/gaze.js";
import { estimateHeadPose } from "../features/head-pose.js";
import { evaluateFraming } from "../features/framing.js";
import { BlinkTracker } from "../features/blink.js";
import { evaluateFacialActivity } from "../features/facial-activity.js";
import { detectFaceTouch } from "../features/face-touch.js";
import { estimateBrightnessFromImageData } from "../features/brightness.js";
import { VisualEventDetector } from "../events/detector.js";
import { VisualSessionAggregator } from "../events/aggregator.js";

export type WorkerInMessage =
  | { type: "INIT"; sessionId: string }
  | { type: "SET_BASELINE"; baseline: BaselineGazeCalibration }
  | { type: "START_CALIBRATION" }
  | {
      type: "PROCESS_FRAME";
      elapsedMs: number;
      faceLandmarks?: Array<{ x: number; y: number; z: number }>;
      blendshapes?: Record<string, number>;
      matrix?: number[];
      handLandmarksList?: Array<Array<{ x: number; y: number; z: number }>>;
      imageData?: { data: Uint8ClampedArray; width: number; height: number };
    }
  | { type: "FINISH_SESSION" }
  | { type: "RESET" };

export type WorkerOutMessage =
  | { type: "READY" }
  | { type: "CALIBRATION_PROGRESS"; progress: number }
  | { type: "CALIBRATION_DONE"; baseline: BaselineGazeCalibration }
  | { type: "TELEMETRY"; sample: VisualTelemetrySample }
  | { type: "EVENT"; event: VisualEvent }
  | { type: "SCORECARD"; scorecard: ReturnType<VisualSessionAggregator["computeScorecard"]> };

let sessionId = "default_session";
let baseline: BaselineGazeCalibration | null = null;
let calibrator = new BaselineGazeCalibrator(45);
let isCalibrating = false;
let blinkTracker = new BlinkTracker();
let eventDetector = new VisualEventDetector(sessionId);
let aggregator = new VisualSessionAggregator();
let seqCounter = 0;
let lastTelemetryElapsedMs = 0;

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "INIT":
      sessionId = msg.sessionId;
      baseline = null;
      isCalibrating = false;
      seqCounter = 0;
      lastTelemetryElapsedMs = 0;
      calibrator.reset();
      blinkTracker.reset();
      eventDetector = new VisualEventDetector(sessionId);
      aggregator = new VisualSessionAggregator();
      self.postMessage({ type: "READY" } satisfies WorkerOutMessage);
      break;

    case "SET_BASELINE":
      baseline = msg.baseline;
      break;

    case "START_CALIBRATION":
      calibrator.reset();
      isCalibrating = true;
      break;

    case "PROCESS_FRAME": {
      const {
        elapsedMs,
        faceLandmarks,
        blendshapes = {},
        matrix,
        handLandmarksList,
        imageData,
      } = msg;

      const faceVisible = !!faceLandmarks && faceLandmarks.length >= 468;
      const noseTip = faceVisible ? faceLandmarks[1] : { x: 0.5, y: 0.5, z: 0 };
      const chin = faceVisible ? faceLandmarks[152] : { x: 0.5, y: 0.8, z: 0 };
      const leftEye = faceVisible ? faceLandmarks[33] : { x: 0.4, y: 0.4, z: 0 };
      const rightEye = faceVisible ? faceLandmarks[263] : { x: 0.6, y: 0.4, z: 0 };

      // Compute features
      const gazeResult = estimateGaze(
        {
          irisX: faceVisible ? faceLandmarks[468]?.x || 0.5 : 0.5,
          irisY: faceVisible ? faceLandmarks[468]?.y || 0.4 : 0.4,
          eyeCornerLeftX: leftEye.x,
          eyeCornerRightX: rightEye.x,
        },
        blendshapes,
        baseline,
      );

      const headPose = estimateHeadPose(matrix, { noseTip, chin, leftEye, rightEye });

      const faceBox = {
        xMin: Math.min(leftEye.x, rightEye.x) - 0.1,
        yMin: Math.min(leftEye.y, rightEye.y) - 0.1,
        width: Math.abs(rightEye.x - leftEye.x) + 0.2,
        height: Math.abs(chin.y - leftEye.y) + 0.2,
      };

      const framing = evaluateFraming(faceBox);
      const blinkInfo = blinkTracker.update(blendshapes, elapsedMs);
      const activity = evaluateFacialActivity(blendshapes);
      const faceTouch = detectFaceTouch(faceBox, handLandmarksList);
      const brightness = imageData
        ? estimateBrightnessFromImageData(imageData)
        : { brightnessScore: 85, isLowLighting: false, isOverexposed: false };

      // If in Calibration mode
      if (isCalibrating && faceVisible) {
        const isComplete = calibrator.addSample({
          gazeVector: gazeResult.rawGazeVector,
          interEyeDistance: Math.abs(rightEye.x - leftEye.x),
          headPose,
        });

        self.postMessage({
          type: "CALIBRATION_PROGRESS",
          progress: calibrator.getProgress(),
        } satisfies WorkerOutMessage);

        if (isComplete) {
          isCalibrating = false;
          baseline = calibrator.computeBaseline(elapsedMs);
          self.postMessage({
            type: "CALIBRATION_DONE",
            baseline,
          } satisfies WorkerOutMessage);
        }
      }

      // Detect discrete events
      const events = eventDetector.processFrame({
        elapsedMs,
        deltaAngleDeg: gazeResult.deltaAngleDeg,
        isGazeDownward: gazeResult.isGazeDownward,
        isFaceTouch: faceTouch.isFaceTouchDetected,
        isWellFramed: framing.isWellFramed,
        isLowLighting: brightness.isLowLighting,
        faceVisible,
      });

      for (const ev of events) {
        aggregator.addEvent(ev);
        self.postMessage({ type: "EVENT", event: ev } satisfies WorkerOutMessage);
      }

      // Emit periodic telemetry sample (2-5 Hz rate limiting)
      if (elapsedMs - lastTelemetryElapsedMs >= 250) {
        lastTelemetryElapsedMs = elapsedMs;
        const sample: VisualTelemetrySample = {
          sessionId,
          seq: ++seqCounter,
          elapsedMs,
          gaze: {
            cameraAligned: gazeResult.cameraAligned,
            deltaAngleDeg: gazeResult.deltaAngleDeg,
            isGazeDownward: gazeResult.isGazeDownward,
          },
          headPose,
          framing: {
            centerOffsetX: framing.centerOffsetX,
            centerOffsetY: framing.centerOffsetY,
            normalizedFaceScale: framing.normalizedFaceScale,
          },
          facialActivity: {
            smileScore: activity.smileScore,
            blinkState: blinkInfo.isBlinking,
            eyeOpennessScore: activity.eyeOpennessScore,
          },
          quality: {
            faceVisibility: faceVisible ? 1 : 0,
            brightnessScore: brightness.brightnessScore,
          },
        };

        aggregator.addSample(sample);
        self.postMessage({ type: "TELEMETRY", sample } satisfies WorkerOutMessage);
      }
      break;
    }

    case "FINISH_SESSION": {
      const scorecard = aggregator.computeScorecard();
      self.postMessage({ type: "SCORECARD", scorecard } satisfies WorkerOutMessage);
      break;
    }

    case "RESET":
      sessionId = "default_session";
      baseline = null;
      isCalibrating = false;
      seqCounter = 0;
      lastTelemetryElapsedMs = 0;
      calibrator.reset();
      blinkTracker.reset();
      eventDetector = new VisualEventDetector(sessionId);
      aggregator = new VisualSessionAggregator();
      self.postMessage({ type: "READY" } satisfies WorkerOutMessage);
      break;
  }
};
