import { describe, it, expect } from "vitest";
import { clampOrNull } from "./utils";

describe("clampOrNull", () => {
  it("範囲内の文字列はそのまま数値として返す", () => {
    expect(clampOrNull("500", 100, 3000)).toBe(500);
  });

  it("最大値を超える場合は最大値にクランプする", () => {
    expect(clampOrNull("5000", 100, 3000)).toBe(3000);
  });

  it("最小値を下回る場合は最小値にクランプする", () => {
    expect(clampOrNull("50", 100, 3000)).toBe(100);
  });

  it("数値として解釈できない文字列はnullを返す", () => {
    expect(clampOrNull("abc", 100, 3000)).toBeNull();
  });

  // URLSearchParams.get()はパラメータが存在しない場合nullを返す。
  // 呼び出し側（App.jsx）は `if (n !== null) setNenshu(n)` のように
  // 「nullなら値を上書きしない」という前提で使っているため、
  // nullを渡したときに意図せず0扱いされクランプされてしまうと、
  // 共有URLに一部のパラメータしか含まれない場合にデフォルト値が
  // 意図せず上書きされてしまう。
  it("nullを渡した場合はnullを返す（0として扱わない）", () => {
    expect(clampOrNull(null, 100, 3000)).toBeNull();
  });

  it("数値をそのまま渡した場合も動作する", () => {
    expect(clampOrNull(500, 100, 3000)).toBe(500);
  });
});
