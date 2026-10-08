/**
 * Dual-threshold Hysteresis Comparator to prevent rapid toggling of states
 */
export class HysteresisComparator {
  private isHighState: boolean = false;
  private highThreshold: number;
  private lowThreshold: number;

  constructor(highThreshold: number, lowThreshold: number) {
    if (lowThreshold > highThreshold) {
      throw new Error("lowThreshold must be less than or equal to highThreshold");
    }
    this.highThreshold = highThreshold;
    this.lowThreshold = lowThreshold;
  }

  evaluate(currentValue: number): boolean {
    if (!this.isHighState && currentValue >= this.highThreshold) {
      this.isHighState = true;
    } else if (this.isHighState && currentValue <= this.lowThreshold) {
      this.isHighState = false;
    }
    return this.isHighState;
  }

  getState(): boolean {
    return this.isHighState;
  }

  reset(initialState: boolean = false): void {
    this.isHighState = initialState;
  }
}
