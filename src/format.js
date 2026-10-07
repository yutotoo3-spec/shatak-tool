export const yen  = (v) => Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(1)}万円` : `${Math.round(v).toLocaleString()}円`;
export const yen2 = (v) => `${Math.round(v / 10000).toLocaleString()}万円`;
export const man  = (v) => +(v / 10000).toFixed(1);
