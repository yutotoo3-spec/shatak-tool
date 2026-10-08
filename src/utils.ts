// 数値をmin〜maxにクランプする。不正な値（NaN等）の場合はnullを返す
export const clampOrNull = (v: string | number | null, min: number, max: number): number | null => {
  const n = +(v ?? NaN);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};
