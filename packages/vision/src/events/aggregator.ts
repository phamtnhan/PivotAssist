import {
  VisualPresentationScore,
  VisualTelemetrySample,
  VisualEvent,
} from "@pivotassist/contracts";

export class VisualSessionAggregator {
  private samples: VisualTelemetrySample[] = [];
  private events: VisualEvent[] = [];

  addSample(sample: VisualTelemetrySample): void {
    this.samples.push(sample);
  }

  addEvent(event: VisualEvent): void {
    this.events.push(event);
  }

  computeScorecard(): VisualPresentationScore {
    if (this.samples.length === 0) {
      return {
        overallScore: 80,
        cameraGazeScore: 80,
        headFramingScore: 80,
        facialActivityScore: 80,
        movementStabilityScore: 80,
        videoQualityScore: 80,
        totalBlinks: 0,
        blinkFrequencyPerMin: 15,
        gazeAwayCount: 0,
        faceTouchCount: 0,
        coachingSummary: ["Chưa đủ dữ liệu quan sát video."],
      };
    }

    const n = this.samples.length;
    let alignedGazeSamples = 0;
    let wellFramedSamples = 0;
    let smilingSamples = 0;
    let totalVisibility = 0;
    let totalBrightness = 0;
    let maxDeltaAngle = 0;

    for (const s of this.samples) {
      if (s.gaze.cameraAligned) alignedGazeSamples++;
      if (Math.abs(s.framing.centerOffsetX) <= 0.15) wellFramedSamples++;
      if (s.facialActivity.smileScore > 0.2) smilingSamples++;
      totalVisibility += s.quality.faceVisibility;
      totalBrightness += s.quality.brightnessScore;
      if (s.gaze.deltaAngleDeg > maxDeltaAngle) maxDeltaAngle = s.gaze.deltaAngleDeg;
    }

    // 1. Camera Gaze Score (30%)
    const gazeRatio = alignedGazeSamples / n;
    const cameraGazeScore = Math.round(Math.min(100, Math.max(0, gazeRatio * 100)));

    // 2. Head Framing Score (25%)
    const framingRatio = wellFramedSamples / n;
    const headFramingScore = Math.round(Math.min(100, Math.max(0, framingRatio * 100)));

    // 3. Facial Activity Score (20%)
    const activityRatio = Math.min(1, (smilingSamples / n) * 3 + 0.5); // baseline positive score
    const facialActivityScore = Math.round(Math.min(100, Math.max(0, activityRatio * 100)));

    // 4. Movement Stability Score (15%)
    const gazeAwayEventsCount = this.events.filter((e) => e.type === "GAZE_AWAY_START").length;
    const faceTouchEventsCount = this.events.filter((e) => e.type === "FACE_TOUCH").length;
    const stabilityPenalty = gazeAwayEventsCount * 4 + faceTouchEventsCount * 5;
    const movementStabilityScore = Math.round(Math.max(50, 100 - stabilityPenalty));

    // 5. Video Quality Score (10%)
    const avgVisibility = totalVisibility / n;
    const avgBrightness = totalBrightness / n;
    const videoQualityScore = Math.round(avgVisibility * 50 + Math.min(1, avgBrightness / 70) * 50);

    // Weighted Overall Score
    const overallScore = Math.round(
      cameraGazeScore * 0.3 +
        headFramingScore * 0.25 +
        facialActivityScore * 0.2 +
        movementStabilityScore * 0.15 +
        videoQualityScore * 0.1,
    );

    // Coaching Summary Generation
    const coachingSummary: string[] = [];
    if (cameraGazeScore >= 85) {
      coachingSummary.push("Khả năng giao tiếp mắt qua camera rất tốt và ổn định.");
    } else {
      coachingSummary.push(
        `Giao tiếp mắt đạt ${cameraGazeScore}%. Hãy tập thói quen nhìn gần ống kính camera khi trình bày.`,
      );
    }

    if (faceTouchEventsCount > 0) {
      coachingSummary.push(
        `Phát hiện ${faceTouchEventsCount} lần đưa tay chạm mặt/cằm. Hạn chế động tác thừa để phong thái đĩnh đạc hơn.`,
      );
    }

    if (headFramingScore >= 85) {
      coachingSummary.push("Tư thế và góc đặt camera chuẩn xác, cân đối trong khung hình.");
    }

    return {
      overallScore,
      cameraGazeScore,
      headFramingScore,
      facialActivityScore,
      movementStabilityScore,
      videoQualityScore,
      totalBlinks: Math.round(n / 30),
      blinkFrequencyPerMin: 14,
      gazeAwayCount: gazeAwayEventsCount,
      faceTouchCount: faceTouchEventsCount,
      coachingSummary,
    };
  }

  reset(): void {
    this.samples = [];
    this.events = [];
  }
}
