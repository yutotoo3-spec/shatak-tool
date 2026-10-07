import { describe, it, expect } from "vitest";
import { calcPattern, KENPO_BONUS_ANNUAL_CAP } from "./calc.js";

// issue #39: 健康保険・介護保険の標準賞与額は年度累計573万円で頭打ちになるが、
// 以前の実装では上限が適用されず、高年収・賞与多めのケースで保険料を過大に計算していた。
describe("calcPattern: 健保・介護保険の賞与標準累計上限（年573万円）", () => {
  it("年間賞与が573万円を超える場合、健保・介護保険料は573万円を基準に計算される（頭打ち）", () => {
    // nenshu=3000万円, 賞与6ヶ月 → annualBonus = 3000万 / 18 * 6 = 1000万円（上限超過）
    const result = calcPattern(30000000, 0, 45, 0, false, 0.05, 6, 0);

    expect(KENPO_BONUS_ANNUAL_CAP).toBe(5730000);
    expect(result.annualBonus).toBe(10000000);

    // 健保: round(573万 × 5%) = 286,500 円（上限適用前は round(1000万 × 5%) = 500,000 円になってしまう）
    // 介護保険(45歳): round(573万 × 0.81%) = 46,413 円
    // 厚生年金: round(min(1000万,150万) × 9.15%) = 137,250 円（従来通り1回150万円で頭打ち）
    // 雇用保険: round(1000万 × 0.50%) = 50,000 円（賞与に上限なし、仕様通り）
    const expectedBonusShakai = 286500 + 46413 + 137250 + 50000;
    expect(result.bonus_shakai).toBe(expectedBonusShakai);

    // 上限を適用しない場合の（修正前の）誤った値より小さくなっていることを確認
    const buggyBonusShakai = 500000 + Math.round(10000000 * 0.0081) + 137250 + 50000;
    expect(result.bonus_shakai).toBeLessThan(buggyBonusShakai);
  });

  it("年間賞与が573万円以下の場合は、上限なしの通常計算と一致する（既存挙動の回帰確認）", () => {
    // nenshu=600万円, 賞与2ヶ月 → annualBonus = 600万 / 14 * 2 ≈ 857,143円（上限未満）
    const result = calcPattern(6000000, 0, 30, 0, false, 0.05, 2, 0);
    const bh = Math.floor(result.annualBonus / 1000) * 1000;

    expect(result.annualBonus).toBeLessThan(KENPO_BONUS_ANNUAL_CAP);
    expect(result.bonus_shakai).toBe(
      Math.round(bh * 0.05) + 0 + Math.round(bh * 0.0915) + Math.round(result.annualBonus * 0.005)
    );
  });
});
