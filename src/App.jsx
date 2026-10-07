import { useState, useMemo, useEffect, useCallback } from "react";
import { RATE_YEAR, KENPO_RATES, PREFS, KUMIAI_PRESETS } from "./rates.js";
import { calcPattern } from "./calc.js";
import { yen, yen2 } from "./format.js";
import { clampOrNull } from "./utils.js";
import { C } from "./theme.js";
import { Badge, NumInput, SegBtn } from "./components/primitives.jsx";
import { CompareChart } from "./components/CompareChart.jsx";
import { CostSummaryTable } from "./components/CostSummaryTable.jsx";
import { PatternCard } from "./components/PatternCard.jsx";

// ─────────────────────────────────────────────────────────────
// メインアプリ
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [manualOpen, setManualOpen] = useState(null); // "hr" | "user" | null

  const [nenshu,        setNenshu]        = useState(800);
  const [yachin,        setYachin]        = useState(20);
  const [age,           setAge]           = useState(30);
  const [dep,           setDep]           = useState(0);
  const [pref,          setPref]          = useState("京都");
  const [bonus,         setBonus]         = useState(0);
  const [coRatio,       setCoRatio]       = useState(70);
  const [insuranceType, setInsuranceType] = useState("kyokai"); // "kyokai" | "kumiai"
  const [customKenpoRate, setCustomKenpoRate] = useState(5.0);  // 健保組合用 被保険者折半率%
  const [ran,           setRan]           = useState(false);
  const [mode,          setMode]          = useState("candidate");
  const [copied,        setCopied]        = useState("");
  const [isMobile,      setIsMobile]      = useState(window.innerWidth < 640);
  const [extraScenarios, setExtraScenarios] = useState([]); // [{id,label,yachin,coRatio}]
  const [joinYM,        setJoinYM]        = useState(""); // "YYYY-MM" 入社想定年月

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    try {
      const p = new URLSearchParams(hash);
      const n = clampOrNull(p.get("n"), 100, 3000);
      if (n !== null) setNenshu(n);
      const y = clampOrNull(p.get("y"), 1, 100);
      if (y !== null) setYachin(y);
      const a = clampOrNull(p.get("a"), 18, 70);
      if (a !== null) setAge(a);
      const d = clampOrNull(p.get("d"), 0, 10);
      if (d !== null) setDep(d);
      if (p.get("p") && KENPO_RATES[p.get("p")]) setPref(p.get("p"));
      const b = clampOrNull(p.get("b"), 0, 12);
      if (b !== null) setBonus(b);
      const r = clampOrNull(p.get("r"), 50, 100);
      if (r !== null) setCoRatio(r);
      if (p.get("it") === "kumiai") {
        setInsuranceType("kumiai");
        const kr = clampOrNull(p.get("kr"), 1, 15);
        if (kr !== null) setCustomKenpoRate(kr);
      }
      if (p.get("jm")) setJoinYM(p.get("jm"));
      setRan(true);
      setMode("candidate");
    } catch {
      // 共有URLのハッシュが不正な形式の場合は無視し、通常の初期表示にフォールバックする
    }
  }, []);

  const kenpoRate = useMemo(() => {
    if (insuranceType === "kumiai") return customKenpoRate / 100;
    return (KENPO_RATES[pref] ?? 5.005) / 100;
  }, [insuranceType, customKenpoRate, pref]);

  const result = useMemo(() => {
    if (!ran) return null;
    const n = nenshu * 10000, y = yachin * 10000;
    return {
      no:  calcPattern(n, y, age, dep, false, kenpoRate, bonus, coRatio),
      yes: calcPattern(n, y, age, dep, true,  kenpoRate, bonus, coRatio),
    };
  }, [ran, nenshu, yachin, age, dep, kenpoRate, bonus, coRatio]);

  const diff = result ? result.yes.annual_tedori - result.no.annual_tedori : 0;

  const buildShareURL = useCallback(() => {
    const base = { n: nenshu, y: yachin, a: age, d: dep, p: pref, b: bonus, r: coRatio };
    if (insuranceType === "kumiai") {
      base.it = "kumiai";
      base.kr = customKenpoRate;
    }
    if (joinYM) base.jm = joinYM;
    const params = new URLSearchParams(base);
    return `${window.location.href.split("#")[0]}#${params.toString()}`;
  }, [nenshu, yachin, age, dep, pref, bonus, coRatio, insuranceType, customKenpoRate, joinYM]);

  const handleCopyURL = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildShareURL());
      setCopied("url"); setTimeout(() => setCopied(""), 2500);
    } catch {
      prompt("このURLをコピーしてください", buildShareURL());
    }
  }, [buildShareURL]);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    const { no, yes } = result;
    const nenshuYen = nenshu * 10000;
    const noPersonal  = no.annual_yachin + no.annual_shakai + no.annual_shotoku + no.annual_jumin;
    const yesPersonal = yes.annual_yachin + yes.annual_shakai + yes.annual_shotoku + yes.annual_jumin;
    const text = [
      "═══════════════════════════════════════",
      "  借り上げ社宅制度 オファー比較シミュレーション",
      "═══════════════════════════════════════",
      "",
      "【入力条件】",
      `  理論年収（提示年収）: ${yen2(nenshuYen)}`,
      `  想定家賃（月額）    : ${yen(yachin * 10000)}`,
      `  社宅会社負担割合    : ${coRatio}%（本人負担 ${100 - coRatio}%）`,
      insuranceType === "kumiai"
        ? `  健康保険            : 健康保険組合・共済組合（被保険者折半率 ${customKenpoRate}%）`
        : `  都道府県            : ${pref}（協会けんぽ ${KENPO_RATES[pref]}%）`,
      `  賞与                : ${bonus}ヶ月`,
      `  年齢                : ${age}歳${age >= 40 ? "（介護保険あり）" : ""}`,
      `  扶養家族            : ${dep}人`,
      ...(joinYM ? [`  入社想定月          : ${joinYM.replace("-", "年")}月`] : []),
      "",
      "───────────────────────────────────────",
      "【社宅なし】",
      "───────────────────────────────────────",
      `  月給（額面）        : ${yen2(no.monthly)}${bonus > 0 ? `　賞与: ${yen2(no.annualBonus)}/年` : ""}`,
      `  家賃自己負担        : ${yen(no.selfYachin)}/月（年間 ${yen2(no.annual_yachin)}）`,
      "",
      "  企業支払い（年間）",
      `    給与              : ${yen2(no.teiji)}`,
      `    会社負担社保      : ${yen2(no.co_shakai * 12)}`,
      `    社宅費用          : −（なし）`,
      `    企業合計          : ${yen2(no.companyTotal * 12)}`,
      "",
      "  個人負担（年間）",
      `    家賃              : ${yen2(no.annual_yachin)}`,
      `    社保（本人）      : ${yen2(no.annual_shakai)}`,
      `    税金              : ${yen2(no.annual_shotoku + no.annual_jumin)}`,
      `    個人負担合計      : ${yen2(noPersonal)}`,
      "",
      `  年間手取り（実質）  : ${yen2(no.annual_tedori)}（概算）`,
      `  月間手取り（実質）  : ${yen(no.m_tedori)}（家賃支払い後）`,
      "",
      "───────────────────────────────────────",
      `【社宅あり（会社${coRatio}%負担）】`,
      "───────────────────────────────────────",
      `  月給（額面）        : ${yen2(yes.monthly)}${bonus > 0 ? `　賞与: ${yen2(yes.annualBonus)}/年` : ""}`,
      `  家賃自己負担        : ${yen(yes.selfYachin)}/月（年間 ${yen2(yes.annual_yachin)}）`,
      `  社宅会社負担        : ${yen(yes.co_yachin)}/月（年間 ${yen2(yes.co_yachin * 12)}）`,
      "",
      "  企業支払い（年間）",
      `    給与              : ${yen2(yes.teiji)}`,
      `    会社負担社保      : ${yen2(yes.co_shakai * 12)}`,
      `    社宅費用          : ${yen2(yes.co_yachin * 12)}`,
      `    企業合計          : ${yen2(yes.companyTotal * 12)}`,
      "",
      "  個人負担（年間）",
      `    家賃（${100 - coRatio}%）       : ${yen2(yes.annual_yachin)}`,
      `    社保（本人）      : ${yen2(yes.annual_shakai)}`,
      `    税金              : ${yen2(yes.annual_shotoku + yes.annual_jumin)}`,
      `    個人負担合計      : ${yen2(yesPersonal)}`,
      "",
      `  年間手取り（実質）  : ${yen2(yes.annual_tedori)}（概算）`,
      `  月間手取り（実質）  : ${yen(yes.m_tedori)}（家賃支払い後）`,
      "",
      "═══════════════════════════════════════",
      `社宅制度により年間手取りが ${diff > 0 ? "+" : ""}${yen2(diff)}（月間 ${diff > 0 ? "+" : ""}${yen(diff / 12)}）`,
      "═══════════════════════════════════════",
      "",
      "住民税は概算値です（前年所得ベース）。",
      insuranceType === "kumiai"
        ? `健康保険組合・共済組合の被保険者折半率 ${customKenpoRate}% を使用。厚生年金18.30%・雇用保険0.50%・介護保険1.62%（折半）。`
        : `協会けんぽ${pref}支部 ${RATE_YEAR}年度料率を使用。厚生年金18.30%・雇用保険0.50%・介護保険1.62%（折半）。`,
      "実際の金額は年末調整・確定申告・各種控除により異なります。",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("text"); setTimeout(() => setCopied(""), 2500);
    } catch { alert("コピーに失敗しました。"); }
  }, [result, diff, pref, bonus, age, dep, nenshu, yachin, coRatio, joinYM, insuranceType, customKenpoRate]);

  const handlePrint = () => window.print();
  const resetRan = () => setRan(false);

  const handleExportCSV = useCallback(() => {
    if (!result) return;
    const { no, yes } = result;
    const rows = [
      ["項目", "社宅なし", `社宅あり（会社${coRatio}%負担）`, "差額"],
      ["年間手取り（実質）（円）", no.annual_tedori, yes.annual_tedori, yes.annual_tedori - no.annual_tedori],
      ["月間手取り（実質）（円）", no.m_tedori, yes.m_tedori, yes.m_tedori - no.m_tedori],
      ["社会保険料・年間（円）", no.annual_shakai, yes.annual_shakai, yes.annual_shakai - no.annual_shakai],
      ["所得税・年間（円）", no.annual_shotoku, yes.annual_shotoku, yes.annual_shotoku - no.annual_shotoku],
      ["住民税・年間概算（円）", no.annual_jumin, yes.annual_jumin, yes.annual_jumin - no.annual_jumin],
      ["家賃自己負担・年間（円）", no.annual_yachin, yes.annual_yachin, yes.annual_yachin - no.annual_yachin],
      ["会社年間コスト（円）", Math.round(no.companyTotal * 12), Math.round(yes.companyTotal * 12), Math.round((yes.companyTotal - no.companyTotal) * 12)],
      [],
      ["入力条件"],
      ["理論年収（万円）", nenshu],
      ["想定家賃・月額（万円）", yachin],
      ["社宅会社負担割合（%）", coRatio],
      insuranceType === "kumiai"
        ? ["健康保険", `健保組合・共済 ${customKenpoRate}%`]
        : ["健康保険", `協会けんぽ ${pref}（${KENPO_RATES[pref]}%）`],
      ["賞与月数", bonus],
      ["年齢", age],
      ["扶養家族（人）", dep],
    ];
    const bom = "﻿";
    const csv = bom + rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shatak-simulation.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [result, nenshu, yachin, age, dep, bonus, coRatio, pref, insuranceType, customKenpoRate]);

  // フォーム用スタイル
  const lbl = {
    fontSize: 11, fontWeight: 600,
    color: C.gray,
    marginBottom: 7, display: "block",
    letterSpacing: "0.04em", textTransform: "uppercase",
  };
  const selectStyle = {
    width: "100%",
    padding: isMobile ? "12px 12px" : "10px 12px",
    border: `1px solid ${C.formBorder}`,
    borderRadius: 10,
    background: C.formSurface,
    fontSize: isMobile ? 15 : 14,
    color: C.formLabel,
    outline: "none",
    fontFamily: "inherit",
    cursor: "pointer",
    appearance: "none", WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238E8E93' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 36,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      padding: isMobile ? "24px 16px 64px" : "40px 24px 56px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Hiragino Sans', sans-serif",
    }}>

      {/* ヘッダー */}
      <div style={{ textAlign: "center", marginBottom: isMobile ? 28 : 36 }}>
        <h1 style={{
          color: C.labelPrimary,
          fontSize: isMobile ? 22 : 28,
          fontWeight: 700,
          margin: "0 0 20px",
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
        }}>
          借り上げ社宅制度 オファー比較シミュレーター
        </h1>

        {/* セグメントコントロール */}
        <div style={{
          display: "inline-flex",
          padding: 3,
          borderRadius: 10,
          background: "rgba(118,118,128,0.24)",
          gap: 2,
        }}>
          {[["candidate", "候補者モード"], ["hr", "HR 設定モード"]].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: isMobile ? "8px 16px" : "7px 20px",
              border: "none", borderRadius: 8, cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13, fontWeight: mode === m ? 600 : 400,
              background: mode === m ? C.surface : "transparent",
              color: mode === m ? C.labelPrimary : C.labelSecond,
              boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
              transition: "all 0.15s",
              letterSpacing: "-0.01em",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* HR 設定パネル */}
      {mode === "hr" && (
        <div style={{
          maxWidth: 680, margin: "0 auto 20px",
          borderRadius: 16,
          background: C.surface,
          border: `1px solid ${C.blue}44`,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${C.separator}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: C.blue,
              }} />
              <div style={{ color: C.labelPrimary, fontSize: 14, fontWeight: 600 }}>HR 設定モード</div>
              <div style={{ color: C.labelSecond, fontSize: 12, marginLeft: 4 }}>
                候補者の情報を入力し、共有 URL を生成して送付してください
              </div>
            </div>
          </div>

          {/* 計算方法の選択: 概算（このツール） / 規定通り（規程準拠ツール） */}
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.separator}` }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: C.labelSecond,
              letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10,
            }}>
              計算方法を選択
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <div style={{
                flex: 1, minWidth: isMobile ? "100%" : 0,
                border: `1px solid ${C.blue}`, borderRadius: 12, padding: "14px 16px",
                background: "rgba(10,132,255,0.1)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.labelPrimary }}>概算</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: C.blue,
                    background: "rgba(10,132,255,0.15)", padding: "2px 6px", borderRadius: 4,
                  }}>このページ</span>
                </div>
                <div style={{ fontSize: 11, color: C.labelSecond, lineHeight: 1.5 }}>
                  家賃の会社負担割合（50〜100%、既定70%・下で設定可能）でオファー比較・節税試算を行うシナリオ検討用の仮の値です。社内規程の確定値ではありません。
                </div>
              </div>
              <a href="/kitei" style={{
                flex: 1, minWidth: isMobile ? "100%" : 0, textDecoration: "none", display: "block",
                border: `1px solid ${C.separator}`, borderRadius: 12, padding: "14px 16px",
                background: C.surface2,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.labelPrimary }}>規定通り</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.labelSecond }}>開く →</span>
                </div>
                <div style={{ fontSize: 11, color: C.labelSecond, lineHeight: 1.5 }}>
                  借上社宅管理規程（第9条・第11条）に基づく正式な会社負担・本人負担を算出します（会社負担70%で固定）。
                </div>
              </a>
            </div>
          </div>
          <div style={{ padding: "16px 20px" }}>

            {/* 健康保険の種類 */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.labelSecond, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                健康保険の種類
              </div>

              {/* 協会けんぽ / 健保組合 切替 */}
              <div style={{
                display: "inline-flex", padding: 3,
                borderRadius: 10, background: "rgba(118,118,128,0.24)",
                gap: 2, marginBottom: 14,
              }}>
                {[["kyokai", "協会けんぽ"], ["kumiai", "健保組合・共済"]].map(([t, label]) => (
                  <button key={t} type="button" aria-pressed={insuranceType === t} onClick={() => { setInsuranceType(t); resetRan(); }} style={{
                    padding: "7px 16px",
                    border: "none", borderRadius: 8, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 13,
                    fontWeight: insuranceType === t ? 600 : 400,
                    background: insuranceType === t ? C.surface : "transparent",
                    color: insuranceType === t ? C.labelPrimary : C.labelSecond,
                    boxShadow: insuranceType === t ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap",
                  }}>{label}</button>
                ))}
              </div>

              {/* 協会けんぽ: 都道府県選択 */}
              {insuranceType === "kyokai" && (
                <div>
                  <div style={{ fontSize: 11, color: C.labelSecond, marginBottom: 8 }}>
                    都道府県を選択すると自動で料率を適用します
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center",
                    gap: 10, flexWrap: "wrap",
                  }}>
                    <div style={{ flex: "1 1 180px" }}>
                      <select
                        aria-label="都道府県"
                        value={pref}
                        onChange={e => { setPref(e.target.value); resetRan(); }}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          border: `1px solid ${C.separator}`,
                          borderRadius: 10,
                          background: C.surface2,
                          fontSize: 13, color: C.labelPrimary,
                          outline: "none", fontFamily: "inherit", cursor: "pointer",
                          appearance: "none", WebkitAppearance: "none",
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238E8E93' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 12px center",
                          paddingRight: 36,
                        }}
                      >
                        {PREFS.map(p => (
                          <option key={p} value={p}>{p}　（{KENPO_RATES[p]}%）</option>
                        ))}
                      </select>
                    </div>
                    <div style={{
                      padding: "8px 14px",
                      background: "rgba(10,132,255,0.12)",
                      borderRadius: 8,
                      fontSize: 13, color: C.blue, fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}>
                      被保険者折半率 {KENPO_RATES[pref]}%
                    </div>
                  </div>
                </div>
              )}

              {/* 健保組合・共済 */}
              {insuranceType === "kumiai" && (
                <div>
                  <div style={{ fontSize: 11, color: C.labelSecond, marginBottom: 10 }}>
                    業種別の目安を選択するか、実際の被保険者折半率（%）を直接入力してください
                  </div>

                  {/* プリセットボタン */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {KUMIAI_PRESETS.map(p => (
                      <button
                        key={p.name}
                        type="button"
                        aria-pressed={Math.abs(customKenpoRate - p.rate) < 0.01}
                        onClick={() => { setCustomKenpoRate(p.rate); resetRan(); }}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: `1px solid ${Math.abs(customKenpoRate - p.rate) < 0.01 ? C.blue : C.separator}`,
                          background: Math.abs(customKenpoRate - p.rate) < 0.01
                            ? "rgba(10,132,255,0.12)"
                            : C.surface2,
                          color: C.labelPrimary,
                          cursor: "pointer", fontFamily: "inherit",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          transition: "all 0.15s",
                          textAlign: "left",
                        }}
                      >
                        <div>
                          <span style={{
                            fontSize: 13, fontWeight: Math.abs(customKenpoRate - p.rate) < 0.01 ? 600 : 400,
                            color: Math.abs(customKenpoRate - p.rate) < 0.01 ? C.blue : C.labelPrimary,
                            marginRight: 8,
                          }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: C.gray }}>{p.desc}</span>
                        </div>
                        <span style={{
                          fontSize: 13, fontWeight: 600,
                          color: Math.abs(customKenpoRate - p.rate) < 0.01 ? C.blue : C.labelSecond,
                          whiteSpace: "nowrap",
                        }}>{p.rate}%</span>
                      </button>
                    ))}
                  </div>

                  {/* 手動入力 */}
                  <div style={{
                    padding: "14px",
                    background: C.surface2,
                    borderRadius: 12,
                    border: `1px solid ${C.separator}`,
                  }}>
                    <label htmlFor="input-kenpo-rate" style={{ display: "block", fontSize: 11, color: C.labelSecond, marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      被保険者折半率を直接入力
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        flex: 1,
                        display: "flex", alignItems: "center",
                        border: `1px solid ${C.separator}`,
                        borderRadius: 10, overflow: "hidden",
                        background: C.surface3,
                      }}>
                        <button
                          type="button"
                          aria-label="折半率を減らす"
                          onClick={() => { setCustomKenpoRate(v => +(Math.max(1, v - 0.1).toFixed(2))); resetRan(); }}
                          style={{
                            padding: "10px 16px", background: "none", border: "none",
                            fontSize: 18, color: C.blue, cursor: "pointer",
                            borderRight: `1px solid ${C.separator}`,
                            lineHeight: 1, fontFamily: "inherit", fontWeight: 300,
                          }}>−</button>
                        <input
                          id="input-kenpo-rate"
                          type="number"
                          value={customKenpoRate}
                          onChange={e => {
                            const n = +e.target.value;
                            if (Number.isFinite(n)) { setCustomKenpoRate(n); resetRan(); }
                          }}
                          onBlur={e => {
                            const n = +e.target.value;
                            setCustomKenpoRate(Number.isFinite(n) ? Math.min(15, Math.max(1, n)) : 1);
                            resetRan();
                          }}
                          min={1} max={15} step={0.1}
                          style={{
                            flex: 1, padding: "10px 4px",
                            border: "none", background: "transparent",
                            textAlign: "center", fontSize: 14,
                            color: C.labelPrimary, outline: "none",
                            fontFamily: "inherit", fontWeight: 500,
                          }}
                        />
                        <button
                          type="button"
                          aria-label="折半率を増やす"
                          onClick={() => { setCustomKenpoRate(v => +(Math.min(15, v + 0.1).toFixed(2))); resetRan(); }}
                          style={{
                            padding: "10px 16px", background: "none", border: "none",
                            fontSize: 18, color: C.blue, cursor: "pointer",
                            borderLeft: `1px solid ${C.separator}`,
                            lineHeight: 1, fontFamily: "inherit", fontWeight: 300,
                          }}>＋</button>
                      </div>
                      <div style={{ fontSize: 14, color: C.labelSecond, fontWeight: 500 }}>%</div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: C.gray }}>
                      協会けんぽ全国平均は約4.9〜5.2%。健保組合は一般に3〜6%程度です。
                    </div>
                  </div>

                  {/* 参考: 適用料率表示 */}
                  <div style={{
                    marginTop: 10,
                    padding: "8px 14px",
                    background: "rgba(10,132,255,0.08)",
                    borderRadius: 8,
                    fontSize: 12, color: C.blue,
                  }}>
                    適用料率（被保険者折半）: <strong>{customKenpoRate}%</strong>　全体料率: {(customKenpoRate * 2).toFixed(2)}%
                  </div>
                </div>
              )}
            </div>

            {/* 社宅会社負担割合 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.labelSecond, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                社宅会社負担割合
              </div>
              <div role="group" aria-label="社宅会社負担割合" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[50, 60, 70, 75, 80, 85, 90, 100].map(r => (
                  <button key={r} type="button" aria-pressed={coRatio === r} onClick={() => { setCoRatio(r); resetRan(); }} style={{
                    padding: "8px 14px", borderRadius: 8,
                    border: `1px solid ${coRatio === r ? C.blue : C.separator}`,
                    background: coRatio === r ? C.blue : "transparent",
                    color: coRatio === r ? "#fff" : C.labelSecond,
                    fontWeight: coRatio === r ? 600 : 400,
                    fontFamily: "inherit", fontSize: 13,
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {r}%
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: C.labelSecond }}>
                会社負担 <span style={{ color: C.labelPrimary, fontWeight: 600 }}>{coRatio}%</span>
                　/　本人負担 <span style={{ color: C.labelPrimary, fontWeight: 600 }}>{100 - coRatio}%</span>
              </div>
            </div>

            {/* 入社想定日 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.labelSecond, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                入社想定日（任意）
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="month"
                  value={joinYM}
                  onChange={e => setJoinYM(e.target.value)}
                  min="2025-01"
                  max="2030-12"
                  style={{
                    padding: "9px 12px",
                    border: `1px solid ${joinYM ? C.blue + "88" : C.separator}`,
                    borderRadius: 10,
                    background: C.surface2,
                    fontSize: 13, color: joinYM ? C.labelPrimary : C.gray,
                    outline: "none", fontFamily: "inherit",
                    colorScheme: "dark",
                  }}
                />
                {joinYM && (
                  <button
                    type="button"
                    aria-label="入社想定日をクリア"
                    onClick={() => setJoinYM("")}
                    style={{ background: "none", border: "none", color: C.gray, cursor: "pointer", fontSize: 16, padding: "4px 8px", fontFamily: "inherit" }}
                  >×</button>
                )}
              </div>
              {joinYM && (() => {
                const m = parseInt(joinYM.split("-")[1], 10);
                const y = parseInt(joinYM.split("-")[0], 10);
                const fiscalYear = m >= 4 ? y : y - 1;
                const isCurrentFiscal = fiscalYear >= 2025;
                return (
                  <div style={{
                    marginTop: 8, padding: "8px 12px",
                    borderRadius: 8,
                    background: isCurrentFiscal ? "rgba(10,132,255,0.08)" : "rgba(255,159,10,0.08)",
                    fontSize: 11,
                    color: isCurrentFiscal ? C.blue : C.orange,
                  }}>
                    {isCurrentFiscal
                      ? `令和${fiscalYear - 2018}（${fiscalYear}）年度の料率を適用中（令和8年度 ${RATE_YEAR} データ）`
                      : `入社月が1〜3月のため、令和${fiscalYear - 2018}（${fiscalYear}）年度料率が適用されます。現在は令和8年度データで概算しています。`
                    }
                  </div>
                );
              })()}
            </div>

            {/* 手順 */}
            <div style={{
              fontSize: 12, color: C.labelSecond,
              lineHeight: 1.9, marginBottom: 14,
            }}>
              1. 社宅会社負担割合・都道府県・年収・家賃・賞与・年齢・扶養を入力<br />
              2. シミュレーションを実行<br />
              3. 共有 URL をコピーして候補者に送付
            </div>

            {result ? (
              <button onClick={handleCopyURL} style={{
                width: "100%",
                padding: isMobile ? "14px" : "12px",
                borderRadius: 10,
                background: copied === "url" ? C.green : C.blue,
                color: "#fff", fontWeight: 600,
                fontSize: isMobile ? 15 : 13,
                border: "none", cursor: "pointer",
                fontFamily: "inherit",
                transition: "background 0.25s",
                letterSpacing: "-0.01em",
              }}>
                {copied === "url" ? "URL をコピーしました" : "候補者への共有 URL をコピー"}
              </button>
            ) : (
              <div style={{
                padding: "11px 16px",
                background: C.surface2,
                borderRadius: 10,
                color: C.gray,
                fontSize: 12, textAlign: "center",
              }}>
                先にシミュレーションを実行してください
              </div>
            )}
          </div>
        </div>
      )}

      {/* 入力フォーム */}
      <div style={{
        maxWidth: 680, margin: "0 auto 20px",
        background: C.formBg,
        borderRadius: 16,
        padding: isMobile ? "20px 16px" : "28px 32px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: C.formLabel, marginBottom: 22,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{
            background: C.blue, color: "#fff",
            borderRadius: 6, padding: "3px 9px",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
          }}>STEP 1</span>
          候補者の情報を入力してください
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 18 : "18px 28px",
        }}>
          {/* 都道府県 */}
          <div>
            <label style={lbl} htmlFor="input-pref">居住都道府県</label>
            <select id="input-pref" value={pref} onChange={e => { setPref(e.target.value); resetRan(); }} style={selectStyle}>
              {PREFS.map(p => (
                <option key={p} value={p}>{p}　（{KENPO_RATES[p]}%）</option>
              ))}
            </select>
            <div style={{ marginTop: 6, fontSize: 11, color: C.gray }}>
              （　）内は協会けんぽの健康保険料率（被保険者負担分）です
            </div>
          </div>

          {/* 賞与月数 */}
          <div>
            <label style={lbl} id="label-bonus">賞与月数</label>
            <div role="group" aria-labelledby="label-bonus" style={{
              display: "flex", gap: 4,
              background: "rgba(118,118,128,0.18)",
              borderRadius: 10, padding: 3,
            }}>
              {[0, 1, 2, 3, 4, 5, 6].map(n => (
                <SegBtn key={n} active={bonus === n}
                  onClick={() => { setBonus(n); resetRan(); }}
                  isMobile={isMobile}>
                  {n}
                </SegBtn>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: C.gray }}>
              年間賞与を「月給の何ヶ月分」で入力（例：夏冬計3ヶ月分なら「3」）
            </div>
          </div>

          {/* 提示年収 */}
          <div>
            <label style={lbl} htmlFor="input-nenshu">提示年収（万円）</label>
            <NumInput id="input-nenshu" label="提示年収" val={nenshu} setter={setNenshu} min={100} max={3000} step={10} onDone={resetRan} isMobile={isMobile} />
            {bonus > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: C.gray }}>
                月給 約{Math.round(nenshu / (12 + bonus))}万　+　賞与 約{Math.round(nenshu * bonus / (12 + bonus))}万/年
              </div>
            )}
          </div>

          {/* 家賃 */}
          <div>
            <label style={lbl} htmlFor="input-yachin">想定家賃・月額（万円）</label>
            <NumInput id="input-yachin" label="想定家賃" val={yachin} setter={setYachin} min={1} max={100} step={0.5} onDone={resetRan} isMobile={isMobile} />
          </div>

          {/* 年齢 */}
          <div>
            <label style={lbl} htmlFor="input-age">年齢</label>
            <NumInput id="input-age" label="年齢" val={age} setter={setAge} min={18} max={70} step={1} onDone={resetRan} isMobile={isMobile} />
            {age >= 40 && (
              <div style={{ marginTop: 6, fontSize: 11, color: C.orange, fontWeight: 500 }}>
                40歳以上：介護保険料が加算されます
              </div>
            )}
          </div>

          {/* 扶養 */}
          <div>
            <label style={lbl} id="label-dep">扶養家族の人数</label>
            <div role="group" aria-labelledby="label-dep" style={{
              display: "flex", gap: 4,
              background: "rgba(118,118,128,0.18)",
              borderRadius: 10, padding: 3,
            }}>
              {[0, 1, 2, 3].map(n => (
                <SegBtn key={n} active={dep === n}
                  onClick={() => { setDep(n); resetRan(); }}
                  isMobile={isMobile}>
                  {n === 3 ? "3+" : `${n}人`}
                </SegBtn>
              ))}
            </div>
          </div>
        </div>

        {/* 計算条件メモ */}
        <div style={{
          marginTop: 20,
          padding: "10px 14px",
          background: C.formSurface,
          borderRadius: 10,
          display: "flex", gap: "6px 20px", flexWrap: "wrap",
        }}>
          {[
            ["健康保険",
              insuranceType === "kumiai"
                ? `健保組合・共済 ${customKenpoRate}%（カスタム）`
                : `協会けんぽ ${pref}（${KENPO_RATES[pref]}%）`
            ],
            ["社宅負担", `会社${coRatio}% / 本人${100 - coRatio}%`],
            ["厚生年金", "18.30%（折半）"],
            ["雇用保険", "0.50%（本人）"],
            ["介護保険", "1.62%（折半・40歳以上）"],
            ...(joinYM ? [["入社想定", `${joinYM.replace("-", "年")}月`]] : []),
          ].map(([k, v]) => (
            <span key={k} style={{ fontSize: 11, color: C.formSecond }}>
              <span style={{ color: C.gray }}>{k}: </span>{v}
            </span>
          ))}
        </div>

        <button onClick={() => setRan(true)} style={{
          marginTop: 18, width: "100%",
          padding: isMobile ? "16px" : "14px",
          background: C.blue,
          color: "#fff", fontWeight: 600,
          fontSize: isMobile ? 16 : 15,
          borderRadius: 12, border: "none",
          cursor: "pointer",
          letterSpacing: "-0.01em",
          fontFamily: "inherit",
          transition: "opacity 0.15s",
        }}>
          シミュレーションを実行
        </button>
      </div>

      {/* 結果エリア */}
      {result && (
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* 差額バナー */}
          <div style={{
            borderRadius: 16,
            padding: isMobile ? "20px 18px" : "22px 28px",
            background: C.surface,
            border: `1px solid ${diff > 0 ? C.green + "44" : C.red + "44"}`,
            marginBottom: 12,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600,
              color: diff > 0 ? C.green : C.red,
              letterSpacing: "0.06em", textTransform: "uppercase",
              marginBottom: 8,
            }}>
              社宅制度による年間手取り変化
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 14 : 0,
            }}>
              <div>
                <div style={{
                  color: diff > 0 ? C.green : C.red,
                  fontSize: isMobile ? 32 : 30,
                  fontWeight: 700, lineHeight: 1,
                  letterSpacing: "-0.03em",
                }}>
                  {diff > 0 ? "+" : "−"}{yen2(Math.abs(diff))}
                </div>
                <div style={{ color: C.labelSecond, fontSize: 12, marginTop: 5 }}>
                  月換算 {diff > 0 ? "+" : "−"}{yen(Math.abs(diff / 12))}　概算
                </div>
              </div>
              <div style={{ textAlign: isMobile ? "left" : "right" }}>
                <div style={{ color: C.labelThird, fontSize: 11, fontWeight: 500, marginBottom: 4 }}>会社年間コスト</div>
                <div style={{ color: C.labelSecond, fontSize: 13 }}>
                  社宅なし　{yen2(result.no.companyTotal * 12)}
                </div>
                <div style={{ color: C.labelPrimary, fontSize: 13, fontWeight: 600 }}>
                  社宅あり　{yen2(result.yes.companyTotal * 12)}
                </div>
              </div>
            </div>
          </div>

          {/* 理論年収・年間負担内訳 */}
          <CostSummaryTable
            no={result.no} yes={result.yes}
            nenshu={nenshu}
            isMobile={isMobile}
          />

          {/* グラフ */}
          <CompareChart no={result.no} yes={result.yes} isMobile={isMobile} />

          {/* 2カード */}
          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 12, marginBottom: 14,
          }}>
            <PatternCard
              title="社宅なし"
              data={result.no}
              coRatio={coRatio}
              isMobile={isMobile}
            />
            <PatternCard
              title="社宅あり"
              isRecommended
              data={result.yes}
              coRatio={coRatio}
              isMobile={isMobile}
            />
          </div>

          {/* アクションボタン */}
          <div style={{
            display: "flex", gap: 10,
            flexDirection: isMobile ? "column" : "row",
            marginBottom: 14,
          }}>
            <button onClick={handleCopyResult} style={{
              flex: 1,
              padding: isMobile ? "14px" : "12px",
              borderRadius: 10,
              background: copied === "text" ? C.green : C.surface,
              color: copied === "text" ? "#fff" : C.labelPrimary,
              fontWeight: 500, fontSize: isMobile ? 14 : 13,
              border: `1px solid ${copied === "text" ? C.green : C.separator}`,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.25s",
              letterSpacing: "-0.01em",
            }}>
              {copied === "text" ? "コピーしました" : "結果テキストをコピー"}
            </button>
            <button onClick={handleExportCSV} style={{
              flex: isMobile ? "none" : "0 0 auto",
              padding: isMobile ? "14px" : "12px 18px",
              borderRadius: 10,
              background: "transparent",
              color: C.gray, fontWeight: 500,
              fontSize: isMobile ? 14 : 13,
              border: `1px solid ${C.separator}`,
              cursor: "pointer", fontFamily: "inherit",
              letterSpacing: "-0.01em",
            }}>
              CSV 出力
            </button>
            <button onClick={handleCopyURL} style={{
              flex: 1,
              padding: isMobile ? "14px" : "12px",
              borderRadius: 10,
              background: copied === "url" ? C.green : C.blue,
              color: "#fff", fontWeight: 500,
              fontSize: isMobile ? 14 : 13,
              border: "none", cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.25s",
              letterSpacing: "-0.01em",
            }}>
              {copied === "url" ? "URL をコピーしました" : "共有 URL をコピー"}
            </button>
            <button onClick={handlePrint} style={{
              flex: isMobile ? "none" : "0 0 auto",
              padding: isMobile ? "14px" : "12px 20px",
              borderRadius: 10,
              background: "transparent",
              color: C.gray, fontWeight: 500,
              fontSize: isMobile ? 14 : 13,
              border: `1px solid ${C.separator}`,
              cursor: "pointer", fontFamily: "inherit",
              letterSpacing: "-0.01em",
            }}>
              印刷
            </button>
          </div>

          {/* SNS シェア（候補者モードのみ） */}
          {mode === "candidate" && (
            <div style={{
              display: "flex", gap: 10, marginBottom: 14,
              flexDirection: isMobile ? "column" : "row",
            }}>
              <button
                onClick={() => {
                  // 個人の年収・家賃等を含むbuildShareURL()はシェア投稿には使わない（第三者に公開されるため）
                  const sign = diff >= 0 ? "+" : "";
                  const text = encodeURIComponent(
                    `社宅条件をシミュレーションしました。社宅あり/なしの手取り差額は年間${sign}${yen2(diff)}。\n#転職 #社宅シミュレーター`
                  );
                  window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
                }}
                style={{
                  flex: 1, padding: isMobile ? "14px" : "12px",
                  borderRadius: 10, background: "#000", color: "#fff",
                  fontWeight: 500, fontSize: isMobile ? 14 : 13,
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                  letterSpacing: "-0.01em",
                }}
              >
                X（旧Twitter）でシェア
              </button>
              <button
                onClick={() => {
                  // 個人の年収・家賃等を含むbuildShareURL()はシェア投稿には使わない（第三者に公開されるため）
                  // パラメータを含まないツールの入口URLのみを共有する
                  const baseUrl = encodeURIComponent(window.location.href.split("#")[0]);
                  window.open(`https://social-plugins.line.me/lineit/share?url=${baseUrl}`, "_blank", "noopener,noreferrer");
                }}
                style={{
                  flex: 1, padding: isMobile ? "14px" : "12px",
                  borderRadius: 10, background: "#06C755", color: "#fff",
                  fontWeight: 500, fontSize: isMobile ? 14 : 13,
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                  letterSpacing: "-0.01em",
                }}
              >
                LINE でシェア
              </button>
            </div>
          )}

          {/* 凡例 */}
          <div style={{
            display: "flex", justifyContent: "center",
            gap: 20, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 11, color: C.gray }}>
              <Badge approx={false} /> 法令計算による確定値
            </span>
            <span style={{ fontSize: 11, color: C.gray }}>
              <Badge approx={true} /> 住民税は前年所得ベースのため概算
            </span>
          </div>

          {/* 複数シナリオ比較（HR モードのみ） */}
          {mode === "hr" && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                borderRadius: 16,
                background: C.surface,
                border: `1px solid ${C.separator}`,
                overflow: "hidden",
              }}>
                {/* ヘッダー */}
                <div style={{
                  padding: "14px 20px",
                  borderBottom: `1px solid ${C.separator}`,
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 12,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.orange }} />
                    <span style={{ color: C.labelPrimary, fontSize: 14, fontWeight: 600 }}>複数シナリオ比較</span>
                    <span style={{ color: C.labelSecond, fontSize: 12 }}>家賃・負担割合の条件を変えて比べる</span>
                  </div>
                  {extraScenarios.length < 2 && (
                    <button
                      onClick={() => setExtraScenarios(prev => [
                        ...prev,
                        { id: Date.now(), label: `シナリオ ${prev.length + 2}`, yachin, coRatio },
                      ])}
                      style={{
                        padding: "6px 14px", borderRadius: 8,
                        border: `1px solid ${C.blue}`, background: "rgba(10,132,255,0.12)",
                        color: C.blue, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      }}
                    >
                      ＋ シナリオを追加
                    </button>
                  )}
                </div>

                {/* シナリオ入力行 */}
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* メインシナリオ（編集不可、参照用） */}
                  {(() => {
                    const mainResult = result.yes;
                    return (
                      <div style={{
                        padding: "12px 16px", borderRadius: 12,
                        background: "rgba(10,132,255,0.08)",
                        border: `1px solid ${C.blue}44`,
                        display: "flex", flexWrap: "wrap", gap: 10,
                        alignItems: "center", justifyContent: "space-between",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                            background: C.blue + "22", color: C.blue, letterSpacing: "0.04em",
                          }}>シナリオ 1（現在）</span>
                          <span style={{ fontSize: 13, color: C.labelSecond }}>
                            家賃 <strong style={{ color: C.labelPrimary }}>{yachin}万円</strong>
                            　会社負担 <strong style={{ color: C.labelPrimary }}>{coRatio}%</strong>
                            　本人負担 <strong style={{ color: C.labelPrimary }}>{Math.round(yachin * (1 - coRatio / 100) * 10) / 10}万/月</strong>
                          </span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.blue, whiteSpace: "nowrap" }}>
                          手取り {yen2(mainResult.annual_tedori)}/年
                        </span>
                      </div>
                    );
                  })()}

                  {/* 追加シナリオ */}
                  {extraScenarios.map((sc, idx) => {
                    const n = nenshu * 10000, y = sc.yachin * 10000;
                    const scResult = calcPattern(n, y, age, dep, true, kenpoRate, bonus, sc.coRatio);
                    const scDiff = scResult.annual_tedori - result.no.annual_tedori;
                    return (
                      <div key={sc.id} style={{
                        padding: "12px 16px", borderRadius: 12,
                        background: C.surface2,
                        border: `1px solid ${C.separator}`,
                      }}>
                        <div style={{
                          display: "flex", alignItems: "center",
                          justifyContent: "space-between", marginBottom: 10, gap: 8,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                              padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                              background: C.orange + "22", color: C.orange, letterSpacing: "0.04em",
                            }}>シナリオ {idx + 2}</span>
                            <input
                              aria-label="シナリオ名"
                              value={sc.label}
                              onChange={e => setExtraScenarios(prev =>
                                prev.map(s => s.id === sc.id ? { ...s, label: e.target.value } : s)
                              )}
                              style={{
                                background: "transparent", border: "none",
                                color: C.labelPrimary, fontSize: 13, fontWeight: 600,
                                fontFamily: "inherit", outline: "none", width: 120,
                              }}
                              placeholder="ラベル"
                            />
                          </div>
                          <button
                            type="button"
                            aria-label="シナリオを削除"
                            onClick={() => setExtraScenarios(prev => prev.filter(s => s.id !== sc.id))}
                            style={{
                              background: "none", border: "none", color: C.gray,
                              cursor: "pointer", fontSize: 16, padding: "2px 6px",
                              fontFamily: "inherit",
                            }}
                          >×</button>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                          <div style={{ flex: "1 1 140px" }}>
                            <div style={{ fontSize: 10, color: C.gray, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                              家賃・月額（万円）
                            </div>
                            <div style={{
                              display: "flex", alignItems: "center",
                              border: `1px solid ${C.separator}`, borderRadius: 8, overflow: "hidden",
                              background: C.surface3,
                            }}>
                              <button type="button" aria-label="家賃を減らす" onClick={() => setExtraScenarios(prev => prev.map(s => s.id === sc.id ? { ...s, yachin: Math.max(1, +(s.yachin - 0.5).toFixed(1)) } : s))}
                                style={{ padding: "8px 12px", background: "none", border: "none", color: C.blue, fontSize: 16, cursor: "pointer", borderRight: `1px solid ${C.separator}`, fontFamily: "inherit" }}>−</button>
                              <input
                                aria-label="家賃・月額（万円）"
                                type="number" value={sc.yachin} min={1} max={100} step={0.5}
                                onChange={e => {
                                  const n = +e.target.value;
                                  if (Number.isFinite(n)) {
                                    setExtraScenarios(prev => prev.map(s => s.id === sc.id ? { ...s, yachin: n } : s));
                                  }
                                }}
                                onBlur={e => {
                                  const n = +e.target.value;
                                  const clamped = Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 1;
                                  setExtraScenarios(prev => prev.map(s => s.id === sc.id ? { ...s, yachin: clamped } : s));
                                }}
                                style={{ flex: 1, padding: "8px 4px", border: "none", background: "transparent", textAlign: "center", fontSize: 13, color: C.labelPrimary, outline: "none", fontFamily: "inherit" }}
                              />
                              <button type="button" aria-label="家賃を増やす" onClick={() => setExtraScenarios(prev => prev.map(s => s.id === sc.id ? { ...s, yachin: Math.min(100, +(s.yachin + 0.5).toFixed(1)) } : s))}
                                style={{ padding: "8px 12px", background: "none", border: "none", color: C.blue, fontSize: 16, cursor: "pointer", borderLeft: `1px solid ${C.separator}`, fontFamily: "inherit" }}>＋</button>
                            </div>
                          </div>
                          <div style={{ flex: "1 1 180px" }}>
                            <div style={{ fontSize: 10, color: C.gray, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                              会社負担割合
                            </div>
                            <div role="group" aria-label="会社負担割合" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {[50, 60, 70, 75, 80, 85, 90, 100].map(r => (
                                <button key={r}
                                  type="button"
                                  aria-pressed={sc.coRatio === r}
                                  onClick={() => setExtraScenarios(prev => prev.map(s => s.id === sc.id ? { ...s, coRatio: r } : s))}
                                  style={{
                                    padding: "5px 10px", borderRadius: 6,
                                    border: `1px solid ${sc.coRatio === r ? C.orange : C.separator}`,
                                    background: sc.coRatio === r ? C.orange + "22" : "transparent",
                                    color: sc.coRatio === r ? C.orange : C.labelSecond,
                                    fontWeight: sc.coRatio === r ? 600 : 400,
                                    fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                                  }}
                                >{r}%</button>
                              ))}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 11, color: C.gray, marginBottom: 3 }}>
                              本人負担 {Math.round(sc.yachin * (1 - sc.coRatio / 100) * 10) / 10}万/月
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.orange }}>
                              手取り {yen2(scResult.annual_tedori)}/年
                            </div>
                            <div style={{ fontSize: 11, color: scDiff >= 0 ? C.green : C.red }}>
                              社宅なし比 {scDiff >= 0 ? "+" : ""}{yen2(scDiff)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {extraScenarios.length === 0 && (
                    <div style={{ padding: "8px 0 4px", fontSize: 12, color: C.gray, textAlign: "center" }}>
                      「＋ シナリオを追加」で異なる条件を並べて比較できます（最大 2 つ追加）
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* 利用マニュアル */}
      <div style={{ maxWidth: 680, margin: "48px auto 0" }}>
        <div style={{
          borderTop: `1px solid ${C.separator}`,
          paddingTop: 32, marginBottom: 12,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600,
            color: C.labelSecond,
            letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 16,
          }}>利用マニュアル</div>

          {[
            {
              key: "hr",
              title: "人事担当の方向け",
              tag: "HR",
              showIn: "hr",
              color: C.blue,
              steps: [
                {
                  label: "HR設定モードに切り替える",
                  desc: "画面上部のモード切替で「HR 設定モード」を選択します。",
                },
                {
                  label: "健康保険の種類を選択する",
                  desc: "自社が協会けんぽの場合は都道府県を選択してください。健保組合・共済組合の場合は「健保組合・共済」を選び、業種プリセットまたは実際の被保険者折半率（%）を入力します。",
                },
                {
                  label: "社宅会社負担割合を設定する",
                  desc: "自社の社宅規定に合わせて会社負担割合を選択します（50〜100%）。",
                },
                {
                  label: "候補者の情報を入力する",
                  desc: "提示年収・想定家賃・賞与月数・年齢・扶養家族の人数を入力してください。",
                },
                {
                  label: "シミュレーションを実行する",
                  desc: "「シミュレーションを実行」ボタンを押すと、社宅あり/なしの手取り比較が表示されます。",
                },
                {
                  label: "共有 URL を候補者に送付する",
                  desc: "HR設定パネル内の「候補者への共有 URL をコピー」ボタンを押してURLをコピーし、メール等で候補者に送付します。URLには入力内容が全て含まれているため、候補者はそのまま結果を確認できます。",
                },
              ],
            },
            {
              key: "user",
              title: "候補者・利用者の方向け",
              tag: "候補者",
              showIn: "candidate",
              color: C.green,
              steps: [
                {
                  label: "URLを開く",
                  desc: "人事担当から送られてきた URL をブラウザで開きます。条件が入力済みの状態でシミュレーション結果が表示されます。",
                },
                {
                  label: "条件を確認・調整する",
                  desc: "年収・家賃・年齢・扶養家族の人数などは自分でも変更できます。変更後は「シミュレーションを実行」ボタンを押してください。",
                },
                {
                  label: "手取り比較を確認する",
                  desc: "「社宅なし」と「社宅あり」の月間・年間手取りを比較できます。棒グラフで内訳（社保・税金・家賃）も一目で確認できます。",
                },
                {
                  label: "内訳を確認する",
                  desc: "「理論年収・年間負担内訳」テーブルで企業側・個人側それぞれの年間負担額を確認できます。",
                },
                {
                  label: "結果を保存・共有する",
                  desc: "「結果テキストをコピー」ボタンで全ての試算内容をテキスト形式でコピーできます。メモ帳や Notion 等への貼り付けにご利用ください。",
                },
              ],
            },
          ].filter(({ showIn }) => showIn === mode).map(({ key, title, tag, color, steps }) => {
            const isOpen = manualOpen === key;
            return (
              <div key={key} style={{
                marginBottom: 10,
                borderRadius: 14,
                border: `1px solid ${isOpen ? color + "55" : C.separator}`,
                background: C.surface,
                overflow: "hidden",
                transition: "border-color 0.2s",
              }}>
                {/* アコーディオンヘッダー */}
                <button
                  onClick={() => setManualOpen(isOpen ? null : key)}
                  style={{
                    width: "100%", padding: "16px 18px",
                    background: "none", border: "none",
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 10,
                    textAlign: "left",
                  }}
                >
                  <span style={{
                    padding: "2px 9px", borderRadius: 6,
                    background: color + "22",
                    color, fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.04em", whiteSpace: "nowrap",
                  }}>{tag}</span>
                  <span style={{
                    flex: 1,
                    color: C.labelPrimary,
                    fontSize: 14, fontWeight: 600,
                  }}>{title}</span>
                  <span style={{
                    color: C.gray, fontSize: 18, lineHeight: 1,
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    display: "inline-block",
                  }}>⌄</span>
                </button>

                {/* アコーディオンボディ */}
                {isOpen && (
                  <div style={{ padding: "0 18px 18px" }}>
                    <div style={{
                      borderTop: `1px solid ${C.separator}`,
                      paddingTop: 16,
                    }}>
                      {steps.map((step, i) => (
                        <div key={i} style={{
                          display: "flex", gap: 14, marginBottom: 16,
                        }}>
                          {/* ステップ番号 */}
                          <div style={{
                            flexShrink: 0,
                            width: 26, height: 26,
                            borderRadius: "50%",
                            background: color + "22",
                            border: `1.5px solid ${color}55`,
                            color,
                            fontSize: 11, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>{i + 1}</div>
                          {/* 内容 */}
                          <div style={{ flex: 1, paddingTop: 3 }}>
                            <div style={{
                              color: C.labelPrimary,
                              fontSize: 13, fontWeight: 600, marginBottom: 4,
                            }}>{step.label}</div>
                            <div style={{
                              color: C.labelSecond,
                              fontSize: 12, lineHeight: 1.75,
                            }}>{step.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 680, margin: "24px auto 0" }}>
        <div style={{
          borderTop: `1px solid ${C.separator}`,
          paddingTop: 32,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600,
            color: C.labelSecond,
            letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 16,
          }}>よくある質問</div>
          {[
            [
              "社宅制度で年収が下がるのに手取りが増えるのはなぜ？",
              "社宅家賃の一部を会社負担にすることで、その分が社会保険料・所得税・住民税の計算ベースから外れます。結果、各種控除額が下がり実質手取りが増加します。",
            ],
            [
              "賞与月数はどこに影響しますか？",
              "賞与がある場合、月収が変わり標準報酬月額が変わります。また賞与にも社会保険料が別途かかります（健保・厚生年金・雇用保険）。このツールでは賞与時の社保控除も考慮しています。",
            ],
            [
              "どのくらい正確ですか？",
              "所得税・厚生年金・雇用保険は確定値に近い計算です。住民税は概算です（前年所得ベース・均等割含む）。実際の金額は年末調整・確定申告・各種控除によって変わります。",
            ],
          ].map(([q, a]) => (
            <div key={q} style={{
              marginBottom: 12,
              padding: "14px 18px",
              background: C.surface,
              borderRadius: 12,
              border: `1px solid ${C.separator}`,
            }}>
              <div style={{
                color: C.labelPrimary,
                fontSize: 13, fontWeight: 600, marginBottom: 6,
              }}>
                {q}
              </div>
              <div style={{
                color: C.labelSecond,
                fontSize: 12, lineHeight: 1.7,
              }}>
                {a}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* フッター */}
      <div style={{
        textAlign: "center", marginTop: 32,
        color: C.gray, fontSize: 11, lineHeight: 1.8,
      }}>
        <div>本ツールは概算シミュレーション用です。実際の金額は状況により異なります。</div>
        <div>協会けんぽ {RATE_YEAR} 年度料率を使用。厚生年金 18.30% · 雇用保険 0.50%（被保険者・一般事業）· 介護保険 1.62%（折半）。</div>
        <div>所得税の基礎控除は令和7・8年度税制改正に対応（基礎控除58万円＋給与所得に応じた時限上乗せ措置、給与所得控除最低65万円）。令和9年分以降は時限措置が終了するため再計算ロジックの見直しが必要です。</div>
      </div>

      <style>{`
        @media print {
          body { background: #fff !important; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
