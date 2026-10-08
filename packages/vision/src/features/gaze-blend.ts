export function averageBlendshapePair(left?: number, right?: number): number {
  return ((left || 0) + (right || 0)) / 2;
}
