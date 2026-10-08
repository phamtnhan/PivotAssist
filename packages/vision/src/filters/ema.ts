/**
 * Exponential Moving Average filter for smoothing continuous vision metrics (gaze, head pose, brightness)
 */
export class ExponentialMovingAverage {
  private alpha: number;
  private current: number | null = null;

  constructor(alpha: number = 0.3) {
    this.alpha = Math.max(0, Math.min(1, alpha));
  }

  update(value: number): number {
    if (this.current === null) {
      this.current = value;
    } else {
      this.current = this.alpha * value + (1 - this.alpha) * this.current;
    }
    return this.current;
  }

  getValue(): number {
    return this.current ?? 0;
  }

  reset(): void {
    this.current = null;
  }
}
