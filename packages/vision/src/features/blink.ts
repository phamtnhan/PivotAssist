export interface BlinkTrackerResult {
  isBlinking: boolean;
  blinkCount: number;
  blinkFrequencyPerMin: number;
}

export class BlinkTracker {
  private blinkTimestamps: number[] = [];
  private isCurrentlyClosed: boolean = false;
  private totalBlinkCount: number = 0;

  update(blendshapes: Record<string, number>, currentElapsedMs: number): BlinkTrackerResult {
    const leftBlink = blendshapes["eyeBlinkLeft"] || 0;
    const rightBlink = blendshapes["eyeBlinkRight"] || 0;
    const averageBlink = (leftBlink + rightBlink) / 2;

    const isClosed = averageBlink >= 0.55;

    if (isClosed && !this.isCurrentlyClosed) {
      this.isCurrentlyClosed = true;
      this.totalBlinkCount++;
      this.blinkTimestamps.push(currentElapsedMs);
    } else if (!isClosed && this.isCurrentlyClosed) {
      this.isCurrentlyClosed = false;
    }

    // Keep only timestamps from the last 60 seconds (60,000ms) for rolling frequency
    const oneMinAgo = currentElapsedMs - 60000;
    this.blinkTimestamps = this.blinkTimestamps.filter((t) => t >= oneMinAgo);

    const blinkFrequencyPerMin = this.blinkTimestamps.length;

    return {
      isBlinking: this.isCurrentlyClosed,
      blinkCount: this.totalBlinkCount,
      blinkFrequencyPerMin,
    };
  }

  getTotalBlinks(): number {
    return this.totalBlinkCount;
  }

  reset(): void {
    this.blinkTimestamps = [];
    this.isCurrentlyClosed = false;
    this.totalBlinkCount = 0;
  }
}
