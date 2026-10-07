import { describe, it, expect } from "vitest";
import { calcLimits, calcKitei, TAIDO_RATIO, KITEI_COMPANY_RATIO } from "./KiteiApp.jsx";

describe("calcLimits: 補助対象限度額・要相談ライン", () => {
  it("家族帯同は基本給の1/4、単身は1/5を限度額とする", () => {
    expect(TAIDO_RATIO.kazoku).toBe(1 / 4);
    expect(TAIDO_RATIO.tanshin).toBe(1 / 5);
    expect(calcLimits(709220, "kazoku").genzai).toBe(177305);
    expect(calcLimits(709220, "tanshin").genzai).toBe(141844);
  });

  it("要相談ラインは限度額の1.5倍", () => {
    const { genzai, warnThreshold } = calcLimits(709220, "kazoku");
    expect(warnThreshold).toBe(Math.floor(genzai * 1.5));
    expect(warnThreshold).toBe(265957);
  });
});

describe("calcKitei: 通常ケース（実賃料 ≤ 限度額）", () => {
  it("会社70%・本人30%で負担を按分する", () => {
    expect(KITEI_COMPANY_RATIO).toBe(0.7);
    const r = calcKitei(709220, "tanshin", 100000); // 限度額141,844円 > 実賃料
    expect(r.isOver).toBe(false);
    expect(r.company).toBe(70000);
    expect(r.personal).toBe(30000);
    expect(r.company + r.personal).toBe(100000); // 端数が消えず実賃料と一致する
  });

  it("実賃料が限度額とちょうど同額の場合も通常ケースとして扱う", () => {
    const { genzai } = calcLimits(709220, "kazoku");
    const r = calcKitei(709220, "kazoku", genzai);
    expect(r.isOver).toBe(false);
  });
});

describe("calcKitei: 超過ケース（実賃料 > 限度額）", () => {
  it("会社負担は限度額の70%で頭打ちになり、超過分は全額本人負担になる", () => {
    const r = calcKitei(709220, "kazoku", 200000); // 限度額177,305円 < 実賃料
    expect(r.isOver).toBe(true);
    expect(r.company).toBe(124113);
    expect(r.personal).toBe(75887);
    expect(r.company + r.personal).toBe(200000); // 端数が消えず実賃料と一致する
  });

  it("実賃料が要相談ライン（限度額×1.5）を超えると要相談フラグが立つ", () => {
    const under = calcKitei(709220, "kazoku", 265957); // 要相談ライン以下
    const over = calcKitei(709220, "kazoku", 400000);  // 要相談ライン超過
    expect(under.needsConsultation).toBe(false);
    expect(over.needsConsultation).toBe(true);
  });
});
