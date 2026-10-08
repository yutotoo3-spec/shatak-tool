import { describe, it, expect } from "vitest";
import { kyuyoKojo, kisoKojoTokurei, kisoKojoShotoku, calcShotoku, calcJumin } from "./calc";

describe("kyuyoKojo（給与所得控除・令和7年度税制改正対応）", () => {
  it("190万円以下は一律65万円", () => {
    expect(kyuyoKojo(1900000)).toBe(650000);
    expect(kyuyoKojo(1000000)).toBe(650000);
  });

  it("360万円以下は 収入×30%＋8万円", () => {
    expect(kyuyoKojo(3600000)).toBe(1160000);
  });

  it("850万円超は一律195万円", () => {
    expect(kyuyoKojo(8500000)).toBe(1950000);
    expect(kyuyoKojo(8500001)).toBe(1950000);
    expect(kyuyoKojo(50000000)).toBe(1950000);
  });
});

describe("kisoKojoShotoku（所得税の基礎控除・令和7-8年度の時限上乗せ措置を含む）", () => {
  it("合計所得132万円以下は 58万円＋37万円（上乗せ上限）= 95万円", () => {
    expect(kisoKojoShotoku(1000000)).toBe(950000);
  });

  it("合計所得655万円超2400万円以下は上乗せなしの58万円", () => {
    expect(kisoKojoShotoku(24000000)).toBe(580000);
  });

  it("合計所得2400万円超は段階的に減少する（恒久ルール）", () => {
    expect(kisoKojoShotoku(24000001)).toBe(320000);
    expect(kisoKojoShotoku(24500001)).toBe(160000);
  });

  it("合計所得2500万円超は基礎控除なし", () => {
    expect(kisoKojoShotoku(25000001)).toBe(0);
  });

  it("kisoKojoTokurei: 上乗せ額は所得が上がるほど段階的に減る", () => {
    expect(kisoKojoTokurei(1320000)).toBe(370000);
    expect(kisoKojoTokurei(1320001)).toBe(300000);
    expect(kisoKojoTokurei(6550000)).toBe(50000);
    expect(kisoKojoTokurei(6550001)).toBe(0);
  });
});

describe("calcShotoku（所得税・復興特別所得税2.1%込み）", () => {
  it("課税所得0円以下は0円", () => {
    expect(calcShotoku(0)).toBe(0);
    expect(calcShotoku(-100)).toBe(0);
  });

  it("195万円以下は5%区分で計算される", () => {
    expect(calcShotoku(1950000)).toBe(99547);
  });

  it("195万円超330万円以下は10%区分（控除97,500円）で計算される", () => {
    expect(calcShotoku(3300000)).toBe(237382);
  });
});

describe("calcJumin（住民税・所得割10%＋均等割5,000円）", () => {
  it("年収・社保控除・扶養人数から住民税額を算出する", () => {
    // 給与所得控除後所得 = 5,000,000 - kyuyoKojo(5,000,000) = 3,560,000
    // 課税所得 = 3,560,000 - 700,000(社保) - 430,000(基礎控除) - 0(扶養なし) = 2,430,000
    // 住民税 = floor(2,430,000 × 10% + 5,000) = 248,000
    expect(calcJumin(5000000, 700000, 0)).toBe(248000);
  });

  it("扶養家族が増えると課税所得が下がり住民税も下がる", () => {
    const without = calcJumin(5000000, 700000, 0);
    const withDep = calcJumin(5000000, 700000, 1);
    expect(withDep).toBeLessThan(without);
  });

  it("課税所得がマイナスになる場合は均等割の5,000円のみになる", () => {
    expect(calcJumin(1000000, 2000000, 0)).toBe(5000);
  });
});
