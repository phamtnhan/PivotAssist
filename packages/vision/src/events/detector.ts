import { VisualEvent, VisualEventType } from "@pivotassist/contracts";
import { HysteresisComparator } from "../filters/hysteresis.js";
import { DurationDebouncer } from "../filters/debounce.js";

export class VisualEventDetector {
  private sessionId: string;
  private gazeHysteresis = new HysteresisComparator(15.0, 10.0);
  private gazeDebouncer = new DurationDebouncer(1500); // 1.5s hold before firing GAZE_AWAY

  private downwardDebouncer = new DurationDebouncer(2000); // 2s hold for GAZE_DOWNWARD
  private faceTouchDebouncer = new DurationDebouncer(1200); // 1.2s hold for FACE_TOUCH
  private offCenterDebouncer = new DurationDebouncer(2500); // 2.5s hold for HEAD_OFF_CENTER
  private brightnessDebouncer = new DurationDebouncer(3000); // 3s hold for LOW_BRIGHTNESS

  private activeEvents: Map<VisualEventType, { startElapsedMs: number; seq: number }> = new Map();
  private eventSeq = 0;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  processFrame(params: {
    elapsedMs: number;
    deltaAngleDeg: number;
    isGazeDownward: boolean;
    isFaceTouch: boolean;
    isWellFramed: boolean;
    isLowLighting: boolean;
    faceVisible: boolean;
  }): VisualEvent[] {
    const emittedEvents: VisualEvent[] = [];
    const {
      elapsedMs,
      deltaAngleDeg,
      isGazeDownward,
      isFaceTouch,
      isWellFramed,
      isLowLighting,
      faceVisible,
    } = params;

    // 1. Gaze Away Detection
    const isGazeAway = !faceVisible || this.gazeHysteresis.evaluate(deltaAngleDeg);
    const gazeTriggered = this.gazeDebouncer.update(isGazeAway, elapsedMs);

    if (gazeTriggered && !this.activeEvents.has("GAZE_AWAY_START")) {
      const seq = ++this.eventSeq;
      this.activeEvents.set("GAZE_AWAY_START", { startElapsedMs: elapsedMs, seq });
      emittedEvents.push({
        sessionId: this.sessionId,
        seq,
        elapsedMs,
        type: "GAZE_AWAY_START",
        label: "Gaze away",
        description: `Hướng nhìn lệch camera (${Math.round(deltaAngleDeg)}°)`,
        severity: "info",
      });
    } else if (!isGazeAway && this.activeEvents.has("GAZE_AWAY_START")) {
      const active = this.activeEvents.get("GAZE_AWAY_START")!;
      const durationMs = elapsedMs - active.startElapsedMs;
      this.activeEvents.delete("GAZE_AWAY_START");

      emittedEvents.push({
        sessionId: this.sessionId,
        seq: ++this.eventSeq,
        elapsedMs,
        durationMs,
        type: "GAZE_AWAY_END",
        label: "Gaze restored",
        description: `Hướng nhìn đã quay trở lại camera sau ${(durationMs / 1000).toFixed(1)}s`,
        severity: "info",
      });
    }

    // 2. Gaze Downward Detection
    const downwardTriggered = this.downwardDebouncer.update(isGazeDownward, elapsedMs);
    if (downwardTriggered) {
      emittedEvents.push({
        sessionId: this.sessionId,
        seq: ++this.eventSeq,
        elapsedMs,
        durationMs: this.downwardDebouncer.getHoldDurationMs(elapsedMs),
        type: "GAZE_DOWNWARD",
        label: "Gaze downward",
        description: "Cúi nhìn xuống dưới trong khi suy nghĩ",
        severity: "warning",
      });
    }

    // 3. Face Touch Detection
    const touchTriggered = this.faceTouchDebouncer.update(isFaceTouch, elapsedMs);
    if (touchTriggered) {
      emittedEvents.push({
        sessionId: this.sessionId,
        seq: ++this.eventSeq,
        elapsedMs,
        durationMs: this.faceTouchDebouncer.getHoldDurationMs(elapsedMs),
        type: "FACE_TOUCH",
        label: "Face touch",
        description: "Phát hiện đưa tay lên vùng mặt/cằm",
        severity: "info",
      });
    }

    // 4. Head Off Center Detection
    const offCenterTriggered = this.offCenterDebouncer.update(!isWellFramed, elapsedMs);
    if (offCenterTriggered) {
      emittedEvents.push({
        sessionId: this.sessionId,
        seq: ++this.eventSeq,
        elapsedMs,
        durationMs: this.offCenterDebouncer.getHoldDurationMs(elapsedMs),
        type: "HEAD_OFF_CENTER",
        label: "Head off-center",
        description: "Đầu lệch khỏi tâm khung hình camera",
        severity: "info",
      });
    }

    // 5. Low Brightness Detection
    const lowLightTriggered = this.brightnessDebouncer.update(isLowLighting, elapsedMs);
    if (lowLightTriggered) {
      emittedEvents.push({
        sessionId: this.sessionId,
        seq: ++this.eventSeq,
        elapsedMs,
        type: "LOW_BRIGHTNESS",
        label: "Low brightness",
        description: "Ánh sáng khuôn mặt hơi tối",
        severity: "warning",
      });
    }

    return emittedEvents;
  }

  reset(): void {
    this.gazeHysteresis.reset();
    this.gazeDebouncer.reset();
    this.downwardDebouncer.reset();
    this.faceTouchDebouncer.reset();
    this.offCenterDebouncer.reset();
    this.brightnessDebouncer.reset();
    this.activeEvents.clear();
  }
}
