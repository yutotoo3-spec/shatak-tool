import { describe, it, expect } from "vitest";
import {
  calcPattern, calcLimits, splitShatak, calcChintairyoSoutou, solveKihonkyuAfterShatak,
} from "./calc";
import { calcKitei } from "./KiteiApp.jsx";

describe("概算モード: 補助対象限度額の適用（第11条）", () => {
  // 要望の確認ケース: 年収1,000万円・単身・賞与0・実賃料20万円
  const kenpo = 0.05;
  const { genzai } = calcLimits(Math.floor(10000000 / 12), "tanshin");
  const no = calcPattern(10000000, 200000, 30, 0, false, kenpo, 0, 70, genzai);
  const yes = calcPattern(10000000, 200000, 30, 0, true, kenpo, 0, 70, genzai);

  it("家賃が上限超え: 会社負担は上限×70%、本人負担は上限×30%＋超過分", () => {
    expect(genzai).toBe(166666);
    expect(yes.shatakOver).toBe(true);
    expect(yes.co_yachin).toBe(116666);   // 約11.7万円
    expect(yes.selfYachin).toBe(83334);   // 約8.3万円
    expect(Math.round((yes.annual_tedori - no.annual_tedori) / 10000)).toBe(48);
  });

  it("規定通りツールと同じ按分になる", () => {
    const k = calcKitei(Math.floor(10000000 / 12), "tanshin", 200000);
    expect(k.company).toBe(yes.co_yachin);
    expect(k.personal).toBe(yes.selfYachin);
  });

  it("家賃が上限以下なら家賃×70%", () => {
    const s = splitShatak(100000, 166666, 0.7);
    expect(s).toEqual({ company: 70000, personal: 30000, isOver: false });
  });
});

describe("賃貸料相当額（第11条ただし書き）", () => {
  it("建物×0.2%＋12円×(床面積/3.3)＋敷地×0.22%", () => {
    // 5,000,000×0.002=10,000 / 12×33/3.3=120 / 3,000,000×0.0022=6,600
    expect(calcChintairyoSoutou(5000000, 3000000, 33)).toBe(16720);
  });

  it("本人負担が下回る場合は賃貸料相当額まで引き上げる", () => {
    const r = calcKitei(709220, "tanshin", 50000, 20000); // 本人負担15,000 < 20,000
    expect(r.floorApplied).toBe(true);
    expect(r.personal).toBe(20000);
    expect(r.company).toBe(30000);
    const r2 = calcKitei(709220, "tanshin", 50000, 10000);
    expect(r2.floorApplied).toBe(false);
    expect(r2.personal).toBe(15000);
  });
});

describe("社宅あり（給与減額後）の基本給で上限を判定", () => {
  it("減額後の基本給 = 社宅なしの基本給 − 会社負担×12÷(12+賞与月数) が成り立つ", () => {
    const base = 833333;
    const k = solveKihonkyuAfterShatak(base, "tanshin", 200000, 0, 0.7);
    const { company } = splitShatak(200000, calcLimits(k, "tanshin").genzai, 0.7);
    expect(Math.abs(k - (base - company))).toBeLessThanOrEqual(1);
    expect(k).toBeLessThan(base);
  });

  it("切り捨てで2つの値を行き来する場合も、小さい方の1つの値に決まる", () => {
    // 833,333円・単身・実賃料20万円・賞与0は 730,994円 ⇄ 730,995円 を行き来するケース
    expect(solveKihonkyuAfterShatak(833333, "tanshin", 200000, 0, 0.7)).toBe(730994);
  });
});
