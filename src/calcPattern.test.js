import { describe, it, expect } from "vitest";
import { calcPattern } from "./calc.js";

describe("calcPattern: 社宅なしの基本ケース", () => {
  it("理論年収600万円・賞与なし・45歳（介護保険対象）の月次社保内訳", () => {
    const r = calcPattern(6000000, 0, 45, 0, false, 0.05, 0, 0);
    expect(r.monthly).toBe(500000);
    expect(r.kenpo).toBe(25000);  // round(500,000 × 5%)
    expect(r.kaigo).toBe(4050);   // round(500,000 × 0.81%)（45歳は介護保険対象）
    expect(r.kosei).toBe(45750);  // round(500,000 × 9.15%)
    expect(r.koyo).toBe(2500);    // round(500,000 × 0.50%)
    expect(r.monthly_shakai).toBe(77300);
  });

  it("39歳以下は介護保険料がかからない", () => {
    const r = calcPattern(6000000, 0, 39, 0, false, 0.05, 0, 0);
    expect(r.kaigo).toBe(0);
  });

  it("40歳ちょうどから介護保険料がかかる", () => {
    const r = calcPattern(6000000, 0, 40, 0, false, 0.05, 0, 0);
    expect(r.kaigo).toBeGreaterThan(0);
  });
});

describe("calcPattern: 社宅ありの手取り増加効果", () => {
  it("社宅利用により同じ理論年収でも手取りが増える（家賃の社会保険料・税金への影響が外れるため）", () => {
    const no = calcPattern(8000000, 200000, 30, 0, false, 0.05, 0, 70);
    const yes = calcPattern(8000000, 200000, 30, 0, true, 0.05, 0, 70);
    expect(yes.annual_tedori).toBeGreaterThan(no.annual_tedori);
  });

  it("会社負担割合が高いほど本人の家賃自己負担は小さくなる", () => {
    const low = calcPattern(8000000, 200000, 30, 0, true, 0.05, 0, 50);
    const high = calcPattern(8000000, 200000, 30, 0, true, 0.05, 0, 100);
    expect(high.selfYachin).toBeLessThan(low.selfYachin);
    expect(high.selfYachin).toBe(0); // 会社負担100%なら自己負担ゼロ
  });
});
