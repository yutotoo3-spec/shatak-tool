import { describe, it, expect } from "vitest";
import { getHyojun, getKenpoHyojun } from "./App.jsx";

describe("getHyojun（厚生年金の標準報酬月額・32等級・上限65万円）", () => {
  it("等級テーブルの境界値で正しい等級に丸める", () => {
    expect(getHyojun(92999)).toBe(88000);
    expect(getHyojun(93000)).toBe(98000); // 境界値は上の等級に属する
  });

  it("上限（65万円）を超える月額は65万円に頭打ちになる", () => {
    expect(getHyojun(700000)).toBe(650000);
    expect(getHyojun(5000000)).toBe(650000);
  });
});

describe("getKenpoHyojun（健康保険・介護保険の標準報酬月額・50等級・上限139万円）", () => {
  it("等級テーブルの境界値で正しい等級に丸める", () => {
    expect(getKenpoHyojun(62999)).toBe(58000);
    expect(getKenpoHyojun(63000)).toBe(68000);
  });

  it("上限（139万円）を超える月額は139万円に頭打ちになる", () => {
    expect(getKenpoHyojun(2000000)).toBe(1390000);
  });

  it("厚生年金用テーブルより上限が高い（139万円 > 65万円）", () => {
    const m = 1000000;
    expect(getKenpoHyojun(m)).toBeGreaterThan(getHyojun(m));
  });
});
