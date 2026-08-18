import { useState, useMemo, useEffect, useCallback } from "react";
import { C, SectionLabel, Row, NumInput, SegBtn } from "./App.jsx";

// ─────────────────────────────────────────────────────────────
// 借上社宅管理規程 第9条・第11条 準拠の計算ロジック
// 端数処理: 円未満切り捨て（暫定ルール。社内ルール確定後に見直し）
// ─────────────────────────────────────────────────────────────
const TAIDO_RATIO = { tanshin: 1 / 5, kazoku: 1 / 4 };

const calcKitei = (kihonkyu, taido, chinryo) => {
  const genzai = Math.floor(kihonkyu * TAIDO_RATIO[taido]); // 補助対象限度額
  const isOver = chinryo > genzai;

  let company, personal;
  if (!isOver) {
    company = Math.floor(chinryo * 0.7);
    personal = chinryo - company;
  } else {
    company = Math.floor(genzai * 0.7);
    const personalWithinLimit = genzai - company;
    personal = personalWithinLimit + (chinryo - genzai);
  }

  const warnThreshold = genzai * 1.5;
  const needsConsultation = chinryo > warnThreshold;

  return { genzai, isOver, company, personal, warnThreshold, needsConsultation };
};

const yen = (v) => `${Math.round(v).toLocaleString()}円`;

// ─────────────────────────────────────────────────────────────
// ページ
// ─────────────────────────────────────────────────────────────
export default function KiteiApp() {
  const [kihonkyu, setKihonkyu] = useState(709220);
  const [taido, setTaido] = useState("kazoku");
  const [chinryo, setChinryo] = useState(200000);
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

  const error = useMemo(() => {
    if (kihonkyu <= 0) return "基本給（月額）を入力してください";
    if (chinryo <= 0) return "実賃料を入力してください";
    return null;
  }, [kihonkyu, chinryo]);

  const result = useMemo(() => {
    if (!ran || error) return null;
    return calcKitei(kihonkyu, taido, chinryo);
  }, [ran, error, kihonkyu, taido, chinryo]);

  const handleCalc = useCallback(() => setRan(true), []);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const taidoLabel = taido === "tanshin" ? "単身" : "配偶者・扶養家族と同居（家族帯同）";
    const text = [
      "【借上社宅 会社負担・本人負担 計算結果（規程準拠）】",
      "",
      `基本給（月額）　: ${yen(kihonkyu)}`,
      `帯同区分　　　　: ${taidoLabel}`,
      `実賃料　　　　　: ${yen(chinryo)}`,
      "",
      `補助対象限度額　: ${yen(result.genzai)}`,
      `適用ケース　　　: ${result.isOver ? "超過ケース" : "通常ケース"}`,
      "",
      `会社負担額（月額）: ${yen(result.company)}`,
      `本人負担額（月額）: ${yen(result.personal)}`,
      ...(result.needsConsultation
        ? ["", "⚠ 実賃料が補助対象限度額の1.5倍を超えています。規程上、要相談な物件です。"]
        : []),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt("このテキストをコピーしてください", text);
    }
  }, [result, kihonkyu, taido, chinryo]);

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
      </div>

      {/* 入力フォーム */}
      <div style={{
        maxWidth: 480, margin: "0 auto 20px",
        background: C.formBg, borderRadius: 16, padding: isMobile ? "18px 16px" : "24px 24px",
      }}>
        <SectionLabel light>入力条件</SectionLabel>

        <div style={{ marginBottom: 18 }}>
          <div style={inputLabelStyle}>基本給（月額・円）</div>
          <NumInput
            val={kihonkyu}
            setter={(fn) => { setKihonkyu(fn); setRan(false); }}
            min={0} max={5000000} step={1000}
            onDone={() => {}} isMobile={isMobile}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={inputLabelStyle}>帯同区分</div>
          <div style={{
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

        <div style={{ marginBottom: 20 }}>
          <div style={inputLabelStyle}>実賃料（家賃＋共益費＋管理費・円）</div>
          <NumInput
            val={chinryo}
            setter={(fn) => { setChinryo(fn); setRan(false); }}
            min={0} max={2000000} step={1000}
            onDone={() => {}} isMobile={isMobile}
          />
        </div>

        {error && (
          <div style={{
            fontSize: 12, color: C.red, background: "rgba(255,69,58,0.1)",
            borderRadius: 8, padding: "8px 12px", marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <button onClick={handleCalc} style={{
          width: "100%", padding: isMobile ? "14px 0" : "12px 0",
          border: "none", borderRadius: 10, cursor: "pointer",
          fontFamily: "inherit", fontSize: 15, fontWeight: 600,
          background: C.blue, color: "#fff",
        }}>
          計算する
        </button>

        <div style={{ fontSize: 11, color: C.gray, marginTop: 12, lineHeight: 1.5 }}>
          ※ 現バージョンは月額の会社負担・本人負担のみを算出します。礼金・敷金・仲介手数料などの初回費用、駐輪場・駐車場使用料は対象外です。
        </div>
      </div>

      {/* 結果表示 */}
      {result && (
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          {result.needsConsultation && (
            <div style={{
              background: "rgba(255,159,10,0.15)", border: `1px solid ${C.orange}`,
              borderRadius: 12, padding: "12px 16px", marginBottom: 12,
              color: C.orange, fontSize: 13, fontWeight: 600,
            }}>
              ⚠ 実賃料が補助対象限度額の1.5倍（{yen(result.warnThreshold)}）を超えています。
              規程上、要相談な物件です。
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
                background: result.isOver ? "rgba(255,159,10,0.15)" : "rgba(48,209,88,0.15)",
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
                <Row label="① 補助対象限度額"
                  value={`${yen(kihonkyu)} × ${taido === "tanshin" ? "1/5" : "1/4"} = ${yen(result.genzai)}`} muted />
                <Row label="② ケース判定"
                  value={`実賃料 ${yen(chinryo)} ${result.isOver ? ">" : "≤"} 限度額 ${yen(result.genzai)}`} muted />
                {!result.isOver ? (
                  <>
                    <Row label="③ 会社負担" value={`実賃料 × 70% = ${yen(result.company)}`} muted />
                    <Row label="③ 本人負担" value={`実賃料 − 会社負担 = ${yen(result.personal)}`} muted />
                  </>
                ) : (
                  <>
                    <Row label="③ 会社負担" value={`限度額 × 70% = ${yen(result.company)}`} muted />
                    <Row label="③ 本人負担"
                      value={`(限度額 − 会社負担) + (実賃料 − 限度額) = ${yen(result.personal)}`} muted />
                  </>
                )}
                <Row label="④ 提供可否チェック"
                  value={`限度額 × 1.5 = ${yen(result.warnThreshold)}（${result.needsConsultation ? "超過・要相談" : "問題なし"}）`}
                  muted />
                <div style={{ fontSize: 11, color: C.gray, marginTop: 8 }}>
                  ※ 円未満は切り捨てで算出しています（暫定ルール）。
                </div>
              </div>
            )}
          </div>

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
