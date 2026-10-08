/**
 * Duration Debouncer to ensure a condition holds for a minimum duration before firing
 */
export class DurationDebouncer {
  private activeStartTime: number | null = null;
  private minDurationMs: number;
  private hasTriggered: boolean = false;

  constructor(minDurationMs: number) {
    this.minDurationMs = minDurationMs;
  }

  update(conditionActive: boolean, currentElapsedMs: number): boolean {
    if (conditionActive) {
      if (this.activeStartTime === null) {
        this.activeStartTime = currentElapsedMs;
        this.hasTriggered = false;
      } else if (
        !this.hasTriggered &&
        currentElapsedMs - this.activeStartTime >= this.minDurationMs
      ) {
        this.hasTriggered = true;
        return true; // Trigger fired!
      }
    } else {
      this.activeStartTime = null;
      this.hasTriggered = false;
    }
    return false;
  }

  getHoldDurationMs(currentElapsedMs: number): number {
    if (this.activeStartTime === null) return 0;
    return Math.max(0, currentElapsedMs - this.activeStartTime);
  }

  reset(): void {
    this.activeStartTime = null;
    this.hasTriggered = false;
  }
}
