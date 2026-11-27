import { useState, useMemo, useEffect, useCallback } from "react";
import { C } from "./theme.js";
import { SectionLabel, Row, NumInput, SegBtn } from "./components/primitives.jsx";
import { TAIDO_RATIO, KITEI_COMPANY_RATIO, calcLimits, splitShatak, calcChintairyoSoutou } from "./calc";

// ─────────────────────────────────────────────────────────────
// 借上社宅管理規程 第9条・第11条 準拠の計算ロジック
// 端数処理: 円未満切り捨て（暫定ルール。社内ルール確定後に見直し）
// TAIDO_RATIO・calcLimits（基本給から家賃の目安を算出する部分）は
// 概算ツール（App.jsx）とも共有するため calc.ts に定義している
// ─────────────────────────────────────────────────────────────

// 実賃料が決まった段階での会社負担・本人負担の算出
// 会社負担70%／本人負担30%は借上社宅管理規程 第11条に定める確定値であり、設定変更はできない。
// 按分ロジック（splitShatak）は概算ツール（App.jsx）と共通。
// soutougaku（賃貸料相当額）を渡すと、第11条ただし書きにより本人負担の下限として適用する。
const companyPct = Math.round(KITEI_COMPANY_RATIO * 100);
const personalPct = 100 - companyPct;
const calcKitei = (kihonkyu, taido, chinryo, soutougaku = 0) => {
  const { genzai, warnThreshold } = calcLimits(kihonkyu, taido);
  const split = splitShatak(chinryo, genzai, KITEI_COMPANY_RATIO);
  let { company, personal } = split;
  const floorApplied = soutougaku > 0 && personal < soutougaku;
  if (floorApplied) {
    personal = Math.min(chinryo, soutougaku);
    company = chinryo - personal;
  }
  const needsConsultation = chinryo > warnThreshold;
  // baseCompany/basePersonal: 賃貸料相当額で調整する前の按分（計算過程の表示用）
  return { genzai, isOver: split.isOver, company, personal, warnThreshold, needsConsultation, floorApplied,
    baseCompany: split.company, basePersonal: split.personal };
};

const yen = (v) => `${Math.round(v).toLocaleString()}円`;

// 計算ロジックをユニットテストから利用するための再エクスポート（UIからは未使用）
export { TAIDO_RATIO, KITEI_COMPANY_RATIO, calcLimits, calcKitei };

// ─────────────────────────────────────────────────────────────
// ページ
// ─────────────────────────────────────────────────────────────
export default function KiteiApp() {
  // 基本給の入力方法: 社宅なしで確定した理論年収から算出 / 基本給を直接入力
  const [inputMode, setInputMode] = useState("nenshu"); // "nenshu" | "kihonkyu"
  const [nenshuMan, setNenshuMan] = useState(850);       // 理論年収（社宅なし・万円）
  const [bonusMonths, setBonusMonths] = useState(0);     // 賞与月数
  const [kihonkyuDirect, setKihonkyuDirect] = useState(709220); // 基本給直接入力（円）
  const [taido, setTaido] = useState("kazoku");
  const [chinryo, setChinryo] = useState(0);             // 仮設定の実賃料（円）
  // 第11条ただし書き: 賃貸料相当額の算出用（任意入力・0は未入力）
  const [tatemonoKazei, setTatemonoKazei] = useState(0); // 建物の固定資産税課税標準額（円）
  const [shikichiKazei, setShikichiKazei] = useState(0); // 敷地の固定資産税課税標準額（円）
  const [yukaMenseki, setYukaMenseki] = useState(0);     // 床面積（㎡）
  // 社会保険の住宅の現物給与（任意）: 都道府県別の1㎡あたり単価（厚生労働大臣告示）×床面積
  const [genbutsuTanka, setGenbutsuTanka] = useState(0); // 円／㎡・月
  const [optOpen, setOptOpen] = useState(false);
  const [ran, setRan] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    document.title = "借上社宅 規程準拠計算ツール | 社内用";
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const derivedKihonkyu = useMemo(() => {
    if (inputMode === "kihonkyu") return kihonkyuDirect;
    return Math.floor((nenshuMan * 10000) / (12 + bonusMonths));
  }, [inputMode, kihonkyuDirect, nenshuMan, bonusMonths]);

  const baseError = useMemo(() => {
    if (inputMode === "nenshu" && nenshuMan <= 0) return "理論年収（社宅なし）を入力してください";
    if (inputMode === "kihonkyu" && kihonkyuDirect <= 0) return "基本給（月額）を入力してください";
    return null;
  }, [inputMode, nenshuMan, kihonkyuDirect]);

  // 実賃料が決まっていなくても表示できる「家賃の目安」
  const limits = useMemo(() => {
    if (baseError) return null;
    return calcLimits(derivedKihonkyu, taido);
  }, [baseError, derivedKihonkyu, taido]);

  const rentError = useMemo(() => {
    if (chinryo <= 0) return "実賃料（仮設定でも可）を入力してください";
    return null;
  }, [chinryo]);

  // 床面積と建物の課税標準額が入っていれば賃貸料相当額を計算する（敷地は0円でも可）
  const soutougaku = useMemo(() => {
    if (yukaMenseki <= 0 || tatemonoKazei <= 0) return 0;
    return calcChintairyoSoutou(tatemonoKazei, shikichiKazei, yukaMenseki);
  }, [tatemonoKazei, shikichiKazei, yukaMenseki]);

  const result = useMemo(() => {
    if (!ran || baseError || rentError) return null;
    return calcKitei(derivedKihonkyu, taido, chinryo, soutougaku);
  }, [ran, baseError, rentError, derivedKihonkyu, taido, chinryo, soutougaku]);

  // 社会保険の現物給与評価額が本人負担を上回る場合、差額が報酬月額に加算される
  const genbutsu = useMemo(() => {
    if (!result || genbutsuTanka <= 0 || yukaMenseki <= 0) return null;
    const hyokagaku = Math.floor(genbutsuTanka * yukaMenseki);
    return { hyokagaku, kasan: Math.max(0, hyokagaku - result.personal) };
  }, [result, genbutsuTanka, yukaMenseki]);

  const handleCalc = useCallback(() => setRan(true), []);

  const handleCopy = useCallback(async () => {
    if (!limits) return;
    const taidoLabel = taido === "tanshin" ? "単身" : "配偶者・扶養家族と同居（家族帯同）";
    const baseLine = inputMode === "nenshu"
      ? `理論年収（社宅なし）: ${nenshuMan}万円　賞与${bonusMonths}ヶ月　→　基本給（月額）: ${yen(derivedKihonkyu)}`
      : `基本給（月額）　: ${yen(derivedKihonkyu)}`;
    const lines = [
      "【借上社宅 会社負担・本人負担 計算結果（規程準拠）】",
      "",
      baseLine,
      `帯同区分　　　　: ${taidoLabel}`,
      "",
      `補助対象限度額　: ${yen(limits.genzai)}（家賃がこれ以下なら会社${companyPct}%／本人${personalPct}%）`,
      `提供可能な家賃上限（目安）: ${yen(limits.warnThreshold)}（これを超えると規程上、要相談）`,
    ];
    if (result) {
      lines.push(
        "",
        `実賃料　　　　　: ${yen(chinryo)}`,
        `適用ケース　　　: ${result.isOver ? "超過ケース" : "通常ケース"}`,
        `会社負担額（月額）: ${yen(result.company)}`,
        `本人負担額（月額）: ${yen(result.personal)}`,
      );
      if (soutougaku > 0) {
        lines.push(`賃貸料相当額　　: ${yen(soutougaku)}${result.floorApplied ? "（本人負担を賃貸料相当額まで引き上げ）" : "（本人負担が上回るため調整なし）"}`);
      }
      if (genbutsu) {
        lines.push(`社保の現物給与評価額: ${yen(genbutsu.hyokagaku)}${genbutsu.kasan > 0 ? `（本人負担との差額 ${yen(genbutsu.kasan)} を報酬月額に加算）` : "（本人負担以下のため加算なし）"}`);
      }
      if (result.needsConsultation) {
        lines.push("", "⚠ 実賃料が提供可能な家賃上限を超えています。規程上、要相談な物件です。");
      }
    }
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt("このテキストをコピーしてください", text);
    }
  }, [limits, result, inputMode, nenshuMan, bonusMonths, derivedKihonkyu, taido, chinryo, soutougaku, genbutsu]);

  const inputLabelStyle = {
    fontSize: 13, fontWeight: 500, color: C.formLabel, marginBottom: 8,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      padding: isMobile ? "24px 16px 64px" : "40px 24px 56px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Hiragino Sans', sans-serif",
    }}>
      <div style={{ textAlign: "center", marginBottom: isMobile ? 28 : 36 }}>
        <h1 style={{
          color: C.labelPrimary,
          fontSize: isMobile ? 20 : 26,
          fontWeight: 700,
          margin: "0 0 8px",
          lineHeight: 1.3,
          letterSpacing: "-0.02em",
        }}>
          借上社宅 規程準拠計算ツール
        </h1>
        <div style={{ color: C.labelSecond, fontSize: 13 }}>
          借上社宅管理規程 第9条・第11条に基づく正式な会社負担・本人負担の算出（社内用）
        </div>
        <div style={{ color: C.labelThird, fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
          会社負担{companyPct}%／本人負担{personalPct}%は社内規程に定める確定値で、変更できません。
          概算ツール（候補者モード・HR設定モード）の「社宅会社負担割合」はオファー比較のシナリオ検討用の仮の値で、この規程準拠ツールの値とは別の目的で使用します。
        </div>
      </div>

      {/* STEP1: 基本給の算出 */}
      <div style={{
        maxWidth: 480, margin: "0 auto 20px",
        background: C.formBg, borderRadius: 16, padding: isMobile ? "18px 16px" : "24px 24px",
      }}>
        <SectionLabel light>STEP 1　基本給の確定</SectionLabel>

        <div style={{
          display: "flex", padding: 3, borderRadius: 10,
          background: C.formSurface, gap: 2, marginBottom: 18,
        }}>
          {[["nenshu", "理論年収（社宅なし）から算出"], ["kihonkyu", "基本給を直接入力"]].map(([v, label]) => (
            <SegBtn key={v} active={inputMode === v} isMobile={isMobile}
              onClick={() => { setInputMode(v); setRan(false); }}>
              {label}
            </SegBtn>
          ))}
        </div>

        {inputMode === "nenshu" ? (
          <>
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="input-nenshu-man" style={inputLabelStyle}>理論年収（社宅なしで確定した金額・万円）</label>
              <NumInput
                id="input-nenshu-man"
                label="理論年収"
                val={nenshuMan}
                setter={(fn) => { setNenshuMan(fn); setRan(false); }}
                min={0} max={5000} step={10}
                onDone={() => {}} isMobile={isMobile}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <div id="label-bonus-months" style={inputLabelStyle}>賞与月数</div>
              <div role="group" aria-labelledby="label-bonus-months" style={{
                display: "flex", gap: 4, background: C.formSurface,
                borderRadius: 10, padding: 3,
              }}>
                {[0, 1, 2, 3, 4, 5, 6].map(n => (
                  <SegBtn key={n} active={bonusMonths === n} isMobile={isMobile}
                    onClick={() => { setBonusMonths(n); setRan(false); }}>
                    {n}
                  </SegBtn>
                ))}
              </div>
            </div>
            {!baseError && (
              <div style={{ fontSize: 12, color: C.formSecond, marginBottom: 4 }}>
                → 算出された基本給（月額）: <strong>{yen(derivedKihonkyu)}</strong>
              </div>
            )}
          </>
        ) : (
          <div style={{ marginBottom: 4 }}>
            <label htmlFor="input-kihonkyu-direct" style={inputLabelStyle}>基本給（月額・円）</label>
            <NumInput
              id="input-kihonkyu-direct"
              label="基本給"
              val={kihonkyuDirect}
              setter={(fn) => { setKihonkyuDirect(fn); setRan(false); }}
              min={0} max={5000000} step={1000}
              onDone={() => {}} isMobile={isMobile}
            />
          </div>
        )}

        <div style={{ margin: "18px 0" }}>
          <div id="label-taido" style={inputLabelStyle}>帯同区分</div>
          <div role="group" aria-labelledby="label-taido" style={{
            display: "flex", padding: 3, borderRadius: 10,
            background: C.formSurface, gap: 2,
          }}>
            {[["tanshin", "単身"], ["kazoku", "家族帯同"]].map(([v, label]) => (
              <SegBtn key={v} active={taido === v} isMobile={isMobile}
                onClick={() => { setTaido(v); setRan(false); }}>
                {label}
              </SegBtn>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 6 }}>
            単身: 基本給 × 1/5　／　配偶者・扶養家族と同居: 基本給 × 1/4
          </div>
        </div>

        {baseError && (
          <div style={{
            fontSize: 12, color: C.red, background: "rgba(255,59,48,0.1)",
            borderRadius: 8, padding: "8px 12px",
          }}>
            {baseError}
          </div>
        )}
      </div>

      {/* STEP2: 家賃の目安（実賃料が未確定でも表示） */}
      {limits && (
        <div style={{
          maxWidth: 480, margin: "0 auto 20px",
          background: C.surface, borderRadius: 16,
          padding: isMobile ? "18px 16px" : "22px 24px",
          border: `1px solid ${C.separator}`,
        }}>
          <SectionLabel>STEP 2　会社制度で支払える家賃の目安</SectionLabel>
          <Row label={`会社${companyPct}%／本人${personalPct}%で会社負担できる上限`} value={yen(limits.genzai)} bold green />
          <Row label="超過ケースとして提供可能な上限（要相談ライン）" value={yen(limits.warnThreshold)} bold />
          <div style={{ fontSize: 11, color: C.gray, marginTop: 10, lineHeight: 1.6 }}>
            家賃が {yen(limits.genzai)} 以下なら会社{companyPct}% / 本人{personalPct}%の通常ケース。
            それを超えても {yen(limits.warnThreshold)} までは超過ケースとして提供可能ですが、本人負担が増えます。
            {yen(limits.warnThreshold)} を超える物件は、規程上、会社が提供を断ることができます。
          </div>
        </div>
      )}

      {/* STEP3: 具体的な家賃での試算（任意） */}
      {limits && (
        <div style={{
          maxWidth: 480, margin: "0 auto 20px",
          background: C.formBg, borderRadius: 16, padding: isMobile ? "18px 16px" : "24px 24px",
        }}>
          <SectionLabel light>STEP 3　物件が決まったら実賃料で試算（任意）</SectionLabel>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="input-chinryo" style={inputLabelStyle}>実賃料（家賃＋共益費＋管理費・円／仮設定でも可）</label>
            <NumInput
              id="input-chinryo"
              label="実賃料"
              val={chinryo}
              setter={(fn) => { setChinryo(fn); setRan(false); }}
              min={0} max={2000000} step={1000}
              onDone={() => {}} isMobile={isMobile}
            />
          </div>
          {/* 任意: 賃貸料相当額・社保の現物給与 */}
          <div style={{ marginBottom: 14, borderRadius: 10, background: C.formSurface }}>
            <button type="button" onClick={() => setOptOpen(v => !v)} style={{
              width: "100%", padding: "10px 12px", border: "none", background: "none",
              cursor: "pointer", display: "flex", justifyContent: "space-between",
              fontFamily: "inherit", fontSize: 13, color: C.formLabel,
            }}>
              <span>賃貸料相当額・社保の現物給与（任意）</span>
              <span style={{ fontSize: 12, color: C.formSecond }}>{optOpen ? "閉じる ▲" : "開く ▼"}</span>
            </button>
            {optOpen && (
              <div style={{ padding: "4px 12px 12px" }}>
                <div style={{ fontSize: 11, color: C.formSecond, marginBottom: 10, lineHeight: 1.6 }}>
                  物件の固定資産税の課税標準額と床面積を入れると賃貸料相当額を計算し、本人負担がそれを下回る場合は賃貸料相当額まで引き上げます（第11条ただし書き）。
                </div>
                {[
                  ["input-tatemono", "建物の固定資産税課税標準額（円）", tatemonoKazei, setTatemonoKazei, 100000000, 10000],
                  ["input-shikichi", "敷地の固定資産税課税標準額（円）", shikichiKazei, setShikichiKazei, 100000000, 10000],
                  ["input-menseki", "床面積（㎡）", yukaMenseki, setYukaMenseki, 500, 1],
                  ["input-genbutsu", "社保の住宅の現物給与 単価（円／㎡・月、都道府県別の告示額）", genbutsuTanka, setGenbutsuTanka, 10000, 10],
                ].map(([id, label, val, setter, max, step]) => (
                  <div key={id} style={{ marginBottom: 12 }}>
                    <label htmlFor={id} style={inputLabelStyle}>{label}</label>
                    <NumInput id={id} label={label} val={val}
                      setter={(fn) => { setter(fn); setRan(false); }}
                      min={0} max={max} step={step} onDone={() => {}} isMobile={isMobile} />
                  </div>
                ))}
                {soutougaku > 0 && (
                  <div style={{ fontSize: 12, color: C.formSecond }}>
                    → 賃貸料相当額（月額）: <strong>{yen(soutougaku)}</strong>
                  </div>
                )}
                <div style={{ fontSize: 11, color: C.gray, marginTop: 8, lineHeight: 1.6 }}>
                  賃貸料相当額 = 建物の課税標準額 × 0.2% ＋ 12円 × (床面積 ÷ 3.3㎡) ＋ 敷地の課税標準額 × 0.22%（所得税基本通達36-41・36-45）。
                  現物給与の単価は2026年10月以降の都道府県別・1㎡あたりの告示額を入力してください。評価額が本人負担を上回る場合、差額が社会保険の報酬月額に加算されます。
                </div>
              </div>
            )}
          </div>
          <button onClick={handleCalc} style={{
            width: "100%", padding: isMobile ? "14px 0" : "12px 0",
            border: "none", borderRadius: 10, cursor: "pointer",
            fontFamily: "inherit", fontSize: 15, fontWeight: 600,
            background: C.blue, color: "#fff",
          }}>
            この家賃で計算する
          </button>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 12, lineHeight: 1.5 }}>
            ※ 月額の会社負担・本人負担を算出します。礼金・敷金・仲介手数料などの初回費用、駐輪場・駐車場使用料は対象外です。
          </div>
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          {result.needsConsultation && (
            <div style={{
              background: "rgba(255,149,0,0.15)", border: `1px solid ${C.orange}`,
              borderRadius: 12, padding: "12px 16px", marginBottom: 12,
              color: C.orange, fontSize: 13, fontWeight: 600,
            }}>
              ⚠ 実賃料が提供可能な家賃上限（{yen(result.warnThreshold)}）を超えています。
              規程上、要相談な物件です。
            </div>
          )}

          {result.floorApplied && (
            <div style={{
              background: "rgba(0,122,255,0.08)", border: `1px solid ${C.blue}`,
              borderRadius: 12, padding: "12px 16px", marginBottom: 12,
              color: C.blue, fontSize: 13, fontWeight: 600,
            }}>
              本人負担が賃貸料相当額（{yen(soutougaku)}）を下回るため、本人負担を賃貸料相当額まで引き上げました（第11条ただし書き）。
            </div>
          )}
          {genbutsu && genbutsu.kasan > 0 && (
            <div style={{
              background: "rgba(255,149,0,0.12)", border: `1px solid ${C.orange}`,
              borderRadius: 12, padding: "12px 16px", marginBottom: 12,
              color: C.orange, fontSize: 13, fontWeight: 600,
            }}>
              社保の現物給与評価額（{yen(genbutsu.hyokagaku)}）が本人負担を上回ります。差額 {yen(genbutsu.kasan)}／月 が報酬月額に加算されます。
            </div>
          )}

          {/* サマリー */}
          <div style={{
            background: C.surface, borderRadius: 16,
            padding: isMobile ? "18px 16px" : "22px 24px",
            marginBottom: 12, border: `1px solid ${C.separator}`,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 16,
            }}>
              <SectionLabel>結果サマリー</SectionLabel>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                background: result.isOver ? "rgba(255,149,0,0.15)" : "rgba(52,199,89,0.15)",
                color: result.isOver ? C.orange : C.green,
              }}>
                {result.isOver ? "超過ケース" : "通常ケース"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.labelSecond, marginBottom: 6 }}>会社負担額（月額）</div>
                <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: C.blue }}>
                  {yen(result.company)}
                </div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.labelSecond, marginBottom: 6 }}>本人負担額（月額）</div>
                <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: C.labelPrimary }}>
                  {yen(result.personal)}
                </div>
              </div>
            </div>
          </div>

          {/* 計算過程 */}
          <div style={{
            background: C.surface, borderRadius: 16,
            marginBottom: 12, border: `1px solid ${C.separator}`, overflow: "hidden",
          }}>
            <button onClick={() => setStepsOpen(v => !v)} style={{
              width: "100%", padding: "14px 20px", border: "none", background: "none",
              cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
              fontFamily: "inherit",
            }}>
              <span style={{ color: C.labelPrimary, fontSize: 14, fontWeight: 600 }}>計算過程</span>
              <span style={{ color: C.labelSecond, fontSize: 12 }}>{stepsOpen ? "閉じる ▲" : "開く ▼"}</span>
            </button>
            {stepsOpen && (
              <div style={{ padding: "0 20px 16px" }}>
                {inputMode === "nenshu" && (
                  <Row label="① 基本給の算出"
                    value={`${nenshuMan}万円 ÷ (12 + ${bonusMonths}ヶ月) = ${yen(derivedKihonkyu)}`} muted />
                )}
                <Row label="② 補助対象限度額"
                  value={`${yen(derivedKihonkyu)} × ${taido === "tanshin" ? "1/5" : "1/4"} = ${yen(result.genzai)}`} muted />
                <Row label="③ ケース判定"
                  value={`実賃料 ${yen(chinryo)} ${result.isOver ? ">" : "≤"} 限度額 ${yen(result.genzai)}`} muted />
                {!result.isOver ? (
                  <>
                    <Row label="④ 会社負担" value={`実賃料 × ${companyPct}% = ${yen(result.baseCompany)}`} muted />
                    <Row label="④ 本人負担" value={`実賃料 − 会社負担 = ${yen(result.basePersonal)}`} muted />
                  </>
                ) : (
                  <>
                    <Row label="④ 会社負担" value={`限度額 × ${companyPct}% = ${yen(result.baseCompany)}`} muted />
                    <Row label="④ 本人負担"
                      value={`(限度額 − 会社負担) + (実賃料 − 限度額) = ${yen(result.basePersonal)}`} muted />
                  </>
                )}
                {soutougaku > 0 && (
                  <Row label="④' 賃貸料相当額の下限"
                    value={result.floorApplied
                      ? `${yen(soutougaku)} > 本人負担 ${yen(result.basePersonal)} → 本人負担 ${yen(result.personal)}・会社負担 ${yen(result.company)}`
                      : `${yen(soutougaku)}（本人負担が上回るため調整なし）`} muted />
                )}
                {genbutsu && (
                  <Row label="④'' 社保の現物給与"
                    value={`${genbutsuTanka.toLocaleString()}円 × ${yukaMenseki}㎡ = ${yen(genbutsu.hyokagaku)}（報酬月額への加算 ${yen(genbutsu.kasan)}）`} muted />
                )}
                <Row label="⑤ 提供可否チェック"
                  value={`限度額 × 1.5 = ${yen(result.warnThreshold)}（${result.needsConsultation ? "超過・要相談" : "問題なし"}）`}
                  muted />
                <div style={{ fontSize: 11, color: C.gray, marginTop: 8 }}>
                  ※ 円未満は切り捨てで算出しています（暫定ルール）。
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {limits && (
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <button onClick={handleCopy} style={{
            width: "100%", padding: isMobile ? "13px 0" : "11px 0",
            border: `1px solid ${C.separator}`, borderRadius: 10, cursor: "pointer",
            fontFamily: "inherit", fontSize: 14, fontWeight: 600,
            background: C.surface, color: C.labelPrimary,
          }}>
            {copied ? "コピーしました" : "テキストとしてコピー"}
          </button>
        </div>
      )}
    </div>
  );
}
