import { useState, useMemo, useEffect, useCallback } from "react";

// ── 計算ロジック ──────────────────────────────────────────────
const HYOJUN_TABLE = [
  [88000,93000],[98000,101000],[104000,107000],[110000,114000],
  [118000,122000],[126000,130000],[134000,138000],[142000,146000],
  [150000,155000],[160000,165000],[170000,175000],[180000,185000],
  [190000,195000],[200000,210000],[220000,230000],[240000,250000],
  [260000,270000],[280000,290000],[300000,310000],[320000,330000],
  [340000,350000],[360000,370000],[380000,395000],[410000,425000],
  [440000,455000],[470000,485000],[500000,515000],[530000,545000],
  [560000,575000],[590000,605000],[620000,635000],[650000,Infinity],
];
const getHyojun = (m) => {
  for (const [h, u] of HYOJUN_TABLE) if (m < u) return h;
  return 650000;
};
const kyuyoKojo = (y) => {
  if (y <= 1625000) return 550000;
  if (y <= 1800000) return y * 0.4 - 100000;
  if (y <= 3600000) return y * 0.3 + 80000;
  if (y <= 6600000) return y * 0.2 + 440000;
  if (y <= 8500000) return y * 0.1 + 1100000;
  return 1950000;
};
const calcShotoku = (k) => {
  if (k <= 0) return 0;
  let t;
  if (k <= 1950000) t = k * 0.05;
  else if (k <= 3300000) t = k * 0.1 - 97500;
  else if (k <= 6950000) t = k * 0.2 - 427500;
  else if (k <= 9000000) t = k * 0.23 - 636000;
  else if (k <= 18000000) t = k * 0.33 - 1536000;
  else t = k * 0.4 - 2796000;
  return Math.floor(t * 1.021);
};
const calcJumin = (nenshu, shakai, dep) => {
  const s = nenshu - kyuyoKojo(nenshu);
  return Math.floor(Math.max(0, s - shakai - 430000 - 330000 * dep) * 0.1 + 5500);
};
const calcPattern = (nenshu, yachin, age, dep, withShatak) => {
  const teiji = withShatak ? nenshu - yachin * 0.8 * 12 : nenshu;
  const monthly = teiji / 12;
  const h = getHyojun(monthly);
  const kenpo  = Math.round(h * 0.0500);
  const kaigo  = age >= 40 ? Math.round(h * 0.0080) : 0;
  const kosei  = Math.round(h * 0.0915);
  const koyo   = Math.round(monthly * 0.0060);
  const shakai = kenpo + kaigo + kosei + koyo;
  const kazei  = Math.max(0, teiji - kyuyoKojo(teiji) - shakai - 480000 - 380000 * dep);
  const shotoku = Math.floor(calcShotoku(kazei) / 12);
  const jumin   = Math.floor(calcJumin(teiji, shakai, dep) / 12);
  const selfYachin = withShatak ? Math.round(yachin * 0.2) : yachin;
  const tedori = monthly - shakai - shotoku - jumin - selfYachin;
  const co_shakai = kenpo + kaigo + kosei + Math.round(monthly * 0.0085);
  const co_yachin = withShatak ? Math.round(yachin * 0.8) : 0;
  return {
    teiji, monthly, h, kenpo, kaigo, kosei, koyo, shakai,
    shotoku, jumin, selfYachin, tedori, co_shakai, co_yachin,
    companyTotal: monthly + co_shakai + co_yachin,
  };
};
const yen  = (v) => Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(1)}万円` : `${v.toLocaleString()}円`;
const yen2 = (v) => `${Math.round(v / 10000).toLocaleString()}万円`;

// ── サブコンポーネント ────────────────────────────────────────
const Badge = ({ approx }) => (
  <span style={{
    fontSize: 9, padding: "1px 5px", borderRadius: 3, marginLeft: 4,
    background: approx ? "#fef3c7" : "#dbeafe",
    color: approx ? "#92400e" : "#1e40af",
    fontWeight: 700, letterSpacing: "0.04em", verticalAlign: "middle",
  }}>{approx ? "概算" : "確定"}</span>
);

const Row = ({ label, value, approx, bold, muted }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: bold ? "10px 10px" : "6px 2px",
    borderBottom: "1px solid #f1f5f9",
    background: bold ? "#eff6ff" : "transparent",
    borderRadius: bold ? 6 : 0,
  }}>
    <span style={{ fontSize: muted ? 11 : 13, color: muted ? "#94a3b8" : "#475569", fontWeight: bold ? 700 : 400 }}>
      {label}{approx !== undefined && <Badge approx={approx} />}
    </span>
    <span style={{ fontSize: muted ? 11 : 13, fontWeight: bold ? 800 : 500, color: bold ? "#1d4ed8" : "#1e293b" }}>
      {value}
    </span>
  </div>
);

const NumInput = ({ val, setter, min, max, step = 1, onDone, isMobile }) => (
  <div style={{
    display: "flex", alignItems: "center",
    border: "1.5px solid #e2e8f0", borderRadius: 8, overflow: "hidden", background: "#f8fafc",
  }}>
    <button
      onClick={() => { setter(v => Math.max(min, +(+v - step).toFixed(2))); onDone(); }}
      style={{
        padding: isMobile ? "13px 18px" : "9px 14px", background: "none", border: "none",
        fontSize: 18, color: "#64748b", cursor: "pointer",
        borderRight: "1px solid #e2e8f0", lineHeight: 1, fontFamily: "inherit",
      }}>−</button>
    <input
      type="number" value={val}
      onChange={e => { setter(+e.target.value); onDone(); }}
      style={{
        flex: 1, padding: isMobile ? "13px 4px" : "9px 4px", border: "none", borderRadius: 0,
        textAlign: "center", fontSize: isMobile ? 16 : 14, background: "#f8fafc",
        outline: "none", fontFamily: "inherit",
      }}
      min={min} max={max} step={step}
    />
    <button
      onClick={() => { setter(v => Math.min(max, +(+v + step).toFixed(2))); onDone(); }}
      style={{
        padding: isMobile ? "13px 18px" : "9px 14px", background: "none", border: "none",
        fontSize: 18, color: "#64748b", cursor: "pointer",
        borderLeft: "1px solid #e2e8f0", lineHeight: 1, fontFamily: "inherit",
      }}>＋</button>
  </div>
);

const PatternCard = ({ title, subtitle, accent, data, badge }) => (
  <div style={{
    flex: 1, minWidth: 0, borderRadius: 14, overflow: "hidden",
    border: badge ? `2px solid ${accent}` : "1px solid #e2e8f0",
    background: "#fff",
    boxShadow: badge ? `0 6px 28px ${accent}28` : "0 2px 10px rgba(0,0,0,0.06)",
  }}>
    <div style={{ background: accent, padding: "14px 18px", position: "relative" }}>
      {badge && (
        <div style={{
          position: "absolute", top: 10, right: 12,
          background: "rgba(255,255,255,0.2)", color: "#fff",
          fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 8, letterSpacing: "0.08em",
        }}>推奨</div>
      )}
      <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{title}</div>
      <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 3 }}>{subtitle}</div>
    </div>
    <div style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 4, letterSpacing: "0.08em" }}>社会保険料（本人負担）</div>
      <Row label="健康保険" value={`−${yen(data.kenpo)}/月`} muted />
      {data.kaigo > 0 && <Row label="介護保険" value={`−${yen(data.kaigo)}/月`} muted />}
      <Row label="厚生年金" value={`−${yen(data.kosei)}/月`} muted />
      <Row label="雇用保険" value={`−${yen(data.koyo)}/月`} muted />
      <Row label="社保合計" value={`−${yen(data.shakai)}/月`} />
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, margin: "10px 0 4px", letterSpacing: "0.08em" }}>税金</div>
      <Row label="所得税" value={`−${yen(data.shotoku)}/月`} approx={false} muted />
      <Row label="住民税" value={`−${yen(data.jumin)}/月`} approx={true} muted />
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, margin: "10px 0 4px", letterSpacing: "0.08em" }}>家賃</div>
      <Row label="自己負担" value={`−${yen(data.selfYachin)}/月`} muted />
      <div style={{ margin: "12px 0 0", borderTop: "2px solid #e2e8f0", paddingTop: 10 }}>
        <Row label="月間手取り（実質）" value={yen(data.tedori)} approx={true} bold />
        <Row label="年間手取り（実質）" value={yen2(data.tedori * 12)} approx={true} bold />
      </div>
      <div style={{ marginTop: 12, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px dashed #e2e8f0" }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>会社コスト（月間）</div>
        <Row label="給与" value={yen(data.monthly)} muted />
        <Row label="会社負担社保" value={`+${yen(data.co_shakai)}`} muted />
        {data.co_yachin > 0 && <Row label="社宅家賃負担" value={`+${yen(data.co_yachin)}`} muted />}
        <Row label="合計" value={yen(data.companyTotal)} bold />
      </div>
    </div>
  </div>
);

// ── メインアプリ ─────────────────────────────────────────────
export default function App() {
  const [nenshu, setNenshu] = useState(500);
  const [yachin, setYachin] = useState(10);
  const [age,    setAge]    = useState(30);
  const [dep,    setDep]    = useState(0);
  const [ran,    setRan]    = useState(false);
  const [mode,   setMode]   = useState("candidate");
  const [copied, setCopied] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // URLハッシュからパラメータ読み込み（候補者が開いたとき自動実行）
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    try {
      const p = new URLSearchParams(hash);
      if (p.get("n")) setNenshu(+p.get("n"));
      if (p.get("y")) setYachin(+p.get("y"));
      if (p.get("a")) setAge(+p.get("a"));
      if (p.get("d")) setDep(+p.get("d"));
      setRan(true);
      setMode("candidate");
    } catch (e) {}
  }, []);

  const result = useMemo(() => {
    if (!ran) return null;
    const n = nenshu * 10000, y = yachin * 10000;
    return { no: calcPattern(n, y, age, dep, false), yes: calcPattern(n, y, age, dep, true) };
  }, [ran, nenshu, yachin, age, dep]);

  const diff = result ? (result.yes.tedori - result.no.tedori) * 12 : 0;

  const buildShareURL = useCallback(() => {
    const params = new URLSearchParams({ n: nenshu, y: yachin, a: age, d: dep });
    return `${window.location.href.split("#")[0]}#${params.toString()}`;
  }, [nenshu, yachin, age, dep]);

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
    const text = [
      "【借り上げ社宅制度 オファー比較シミュレーション】",
      "",
      "■ 社宅なし",
      `  月給（手取り前）: ${yen2(no.monthly)}`,
      `  月間手取り（実質）: ${yen(no.tedori)}　※概算`,
      `  年間手取り（実質）: ${yen2(no.tedori * 12)}　※概算`,
      "",
      "■ 社宅あり（推奨）",
      `  月給（手取り前）: ${yen2(yes.monthly)}`,
      `  社宅家賃うち自己負担: ${yen(yes.selfYachin)}/月`,
      `  月間手取り（実質）: ${yen(yes.tedori)}　※概算`,
      `  年間手取り（実質）: ${yen2(yes.tedori * 12)}　※概算`,
      "",
      `▶ 社宅を利用すると年間手取りが約 ${yen2(Math.abs(diff))} 増加します（概算）`,
      "",
      "※ 住民税は概算値を含みます。実際の金額は確定申告・年末調整により異なります。",
      "※ 協会けんぽ京都支部の料率にて計算しています。",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("text"); setTimeout(() => setCopied(""), 2500);
    } catch {
      alert("コピーに失敗しました。");
    }
  }, [result, diff]);

  const resetRan = () => setRan(false);
  const lbl = { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6, display: "block", letterSpacing: "0.05em" };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(150deg,#0a1628 0%,#172040 55%,#0a1628 100%)",
      padding: isMobile ? "18px 14px 48px" : "28px 20px",
      fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',sans-serif",
    }}>

      {/* ── ヘッダー ── */}
      <div style={{ textAlign: "center", marginBottom: isMobile ? 18 : 24 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8,
          padding: "3px 12px", borderRadius: 20,
          background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
          color: "#93c5fd", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#60a5fa", display: "inline-block" }} />
          HR TOOL ／ 借り上げ社宅制度
        </div>
        <h1 style={{ color: "#f1f5f9", fontSize: isMobile ? 19 : 22, fontWeight: 900, margin: "0 0 4px", lineHeight: 1.3 }}>
          オファー比較シミュレーター
        </h1>
        <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>協会けんぽ 京都支部　/　社宅自己負担 20% 固定</p>

        {/* モード切替 */}
        <div style={{
          display: "inline-flex", marginTop: 14, borderRadius: 10, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)",
        }}>
          {[["candidate", "👤 候補者モード"], ["hr", "⚙️ HR設定モード"]].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: isMobile ? "9px 16px" : "8px 20px", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: mode === m ? 800 : 400,
              background: mode === m ? "rgba(255,255,255,0.18)" : "transparent",
              color: mode === m ? "#f1f5f9" : "#64748b", letterSpacing: "0.03em", transition: "all 0.2s",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── HR設定モード パネル ── */}
      {mode === "hr" && (
        <div style={{
          maxWidth: 640, margin: "0 auto 20px", borderRadius: 14, overflow: "hidden",
          border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.05)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          <div style={{ background: "linear-gradient(90deg,#78350f,#92400e)", padding: "12px 18px" }}>
            <div style={{ color: "#fde68a", fontSize: 13, fontWeight: 800 }}>⚙️ HR設定モード</div>
            <div style={{ color: "rgba(253,230,138,0.7)", fontSize: 11, marginTop: 2 }}>
              候補者ごとの入力値を設定して、共有URLを生成してください
            </div>
          </div>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 12, color: "#d97706", fontWeight: 600, marginBottom: 12, lineHeight: 1.7 }}>
              ① 下のフォームで候補者の情報を入力<br />
              ② 「シミュレーションを実行」を押す<br />
              ③ 「共有URLをコピー」して候補者にメール・Slackで送付
            </div>
            {result ? (
              <button onClick={handleCopyURL} style={{
                width: "100%", padding: isMobile ? "14px" : "12px", borderRadius: 9,
                background: copied === "url" ? "#065f46" : "linear-gradient(90deg,#b45309,#d97706)",
                color: "#fff", fontWeight: 800, fontSize: isMobile ? 15 : 13,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                letterSpacing: "0.04em", boxShadow: "0 3px 14px rgba(217,119,6,0.4)",
                transition: "background 0.3s",
              }}>
                {copied === "url" ? "✓ URLをコピーしました！" : "🔗 候補者への共有URLをコピー"}
              </button>
            ) : (
              <div style={{
                padding: "10px 14px", background: "rgba(255,255,255,0.05)",
                borderRadius: 8, color: "#94a3b8", fontSize: 12, textAlign: "center",
              }}>
                先にシミュレーションを実行してください
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 入力フォーム ── */}
      <div style={{
        maxWidth: 640, margin: "0 auto 20px", background: "#fff", borderRadius: 16,
        padding: isMobile ? "18px 16px" : "22px 24px",
        boxShadow: "0 12px 48px rgba(0,0,0,0.4)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ background: "#1d4ed8", color: "#fff", borderRadius: 5, padding: "2px 7px", fontSize: 9, letterSpacing: "0.06em" }}>STEP 1</span>
          あなたの情報を入力してください
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "14px" : "16px 24px" }}>
          <div>
            <label style={lbl}>提示年収（万円）</label>
            <NumInput val={nenshu} setter={setNenshu} min={100} max={3000} step={10} onDone={resetRan} isMobile={isMobile} />
          </div>
          <div>
            <label style={lbl}>想定する家賃・月額（万円）</label>
            <NumInput val={yachin} setter={setYachin} min={1} max={100} step={0.5} onDone={resetRan} isMobile={isMobile} />
          </div>
          <div>
            <label style={lbl}>年齢</label>
            <NumInput val={age} setter={setAge} min={18} max={70} step={1} onDone={resetRan} isMobile={isMobile} />
            {age >= 40 && (
              <div style={{ marginTop: 5, fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>
                ⚠ 40歳以上：介護保険料が加算されます
              </div>
            )}
          </div>
          <div>
            <label style={lbl}>扶養家族の人数</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2, 3].map(n => (
                <button key={n} onClick={() => { setDep(n); setRan(false); }} style={{
                  flex: 1, padding: isMobile ? "13px 0" : "10px 0", borderRadius: 8,
                  fontSize: isMobile ? 15 : 13, border: "1.5px solid", cursor: "pointer",
                  borderColor: dep === n ? "#3b82f6" : "#e2e8f0",
                  background: dep === n ? "#eff6ff" : "#f8fafc",
                  color: dep === n ? "#1d4ed8" : "#64748b",
                  fontWeight: dep === n ? 800 : 400, fontFamily: "inherit",
                }}>
                  {n === 3 ? "3+" : n}人
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 固定条件 */}
        <div style={{
          marginTop: 14, padding: "10px 12px", background: "#f8fafc",
          borderRadius: 8, border: "1px solid #e9eef4", display: "flex", gap: "8px 16px", flexWrap: "wrap",
        }}>
          {[["健康保険", "協会けんぽ 京都"], ["賞与", "なし"], ["社宅負担", "会社80% / 本人20%"], ["居住地", "京都府"]].map(([k, v]) => (
            <span key={k} style={{ fontSize: 11, color: "#64748b" }}>
              <span style={{ color: "#94a3b8" }}>{k}：</span>{v}
            </span>
          ))}
        </div>

        <button onClick={() => setRan(true)} style={{
          marginTop: 16, width: "100%", padding: isMobile ? "16px" : "13px",
          background: "linear-gradient(90deg,#1e40af,#2563eb,#3b82f6)",
          color: "#fff", fontWeight: 800, fontSize: isMobile ? 16 : 14, borderRadius: 10,
          border: "none", cursor: "pointer", letterSpacing: "0.06em", fontFamily: "inherit",
          boxShadow: "0 4px 18px rgba(59,130,246,0.5)",
          WebkitTapHighlightColor: "transparent",
        }}>
          ▶ シミュレーションを実行
        </button>
      </div>

      {/* ── 結果エリア ── */}
      {result && (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>

          {/* 差額バナー */}
          <div style={{
            borderRadius: 14, padding: isMobile ? "16px" : "16px 22px",
            background: "linear-gradient(90deg,#064e3b,#065f46)",
            boxShadow: "0 4px 20px rgba(4,120,87,0.4)", marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>
              社宅制度を利用すると年間手取りが
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 0,
            }}>
              <div style={{ color: "#fff", fontSize: isMobile ? 26 : 24, fontWeight: 900, lineHeight: 1 }}>
                +{yen2(Math.abs(diff))}
                <span style={{ fontSize: 11, color: "#6ee7b7", marginLeft: 6, fontWeight: 500 }}>概算</span>
              </div>
              <div style={{ textAlign: isMobile ? "left" : "right" }}>
                <div style={{ color: "#6ee7b7", fontSize: 10, fontWeight: 700 }}>会社年間コスト比較</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 }}>社宅なし {yen2(result.no.companyTotal * 12)}</div>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>社宅あり {yen2(result.yes.companyTotal * 12)}</div>
              </div>
            </div>
          </div>

          {/* 2カード */}
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
            <PatternCard
              title="社宅なし"
              subtitle={`月給 ${yen2(result.no.monthly)}　家賃は全額自己負担`}
              accent="#64748b" data={result.no}
            />
            <PatternCard
              title="✦ 社宅あり（推奨）"
              subtitle={`月給 ${yen2(result.yes.monthly)}　家賃の80%を会社負担`}
              accent="#1d4ed8" data={result.yes} badge
            />
          </div>

          {/* アクションボタン */}
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row" }}>
            <button onClick={handleCopyResult} style={{
              flex: 1, padding: isMobile ? "15px" : "12px", borderRadius: 10,
              background: copied === "text" ? "#065f46" : "#fff",
              color: copied === "text" ? "#fff" : "#1e293b",
              fontWeight: 700, fontSize: isMobile ? 14 : 13,
              border: "1.5px solid", borderColor: copied === "text" ? "#065f46" : "#e2e8f0",
              cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.03em",
              transition: "all 0.3s", boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            }}>
              {copied === "text" ? "✓ コピーしました！" : "📋 結果テキストをコピー"}
            </button>
            {mode === "hr" && (
              <button onClick={handleCopyURL} style={{
                flex: 1, padding: isMobile ? "15px" : "12px", borderRadius: 10,
                background: copied === "url" ? "#065f46" : "linear-gradient(90deg,#b45309,#d97706)",
                color: "#fff", fontWeight: 700, fontSize: isMobile ? 14 : 13,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                transition: "background 0.3s", boxShadow: "0 3px 14px rgba(217,119,6,0.4)",
              }}>
                {copied === "url" ? "✓ URLコピー完了！" : "🔗 共有URLをコピー"}
              </button>
            )}
          </div>

          {/* 凡例 */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#475569" }}><Badge approx={false} /> 法令計算による確定値</span>
            <span style={{ fontSize: 10, color: "#475569" }}><Badge approx={true} /> 住民税は前年所得ベースのため概算</span>
          </div>
        </div>
      )}

      {/* フッター */}
      <div style={{ textAlign: "center", marginTop: 40, color: "#334155", fontSize: 10 }}>
        ※ 本ツールは概算シミュレーション用です。実際の金額は状況により異なります。
      </div>
    </div>
  );
}
