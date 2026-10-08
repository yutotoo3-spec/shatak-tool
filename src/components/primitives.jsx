import { C } from "../theme.js";

// ─────────────────────────────────────────────────────────────
// 汎用UIプリミティブ（App.jsx / KiteiApp.jsx の両方から利用）
// ─────────────────────────────────────────────────────────────

export const SectionLabel = ({ children, light }) => (
  <div style={{
    fontSize: 11, fontWeight: 600,
    color: light ? C.formSecond : C.labelSecond,
    letterSpacing: "0.06em", textTransform: "uppercase",
    marginBottom: 12,
  }}>
    {children}
  </div>
);

export const Badge = ({ approx }) => (
  <span style={{
    fontSize: 9, padding: "2px 6px", borderRadius: 4, marginLeft: 5,
    background: approx ? "rgba(255,159,10,0.15)" : "rgba(10,132,255,0.15)",
    color: approx ? C.orange : C.blue,
    fontWeight: 600, letterSpacing: "0.03em", verticalAlign: "middle",
  }}>{approx ? "概算" : "確定"}</span>
);

// 結果カード内 Row（ダークカード用）
export const Row = ({ label, value, approx, bold, muted, green }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: bold ? "10px 12px" : "7px 0",
    borderBottom: `1px solid ${C.separator}`,
    background: bold ? (green ? "rgba(48,209,88,0.1)" : "rgba(10,132,255,0.1)") : "transparent",
    borderRadius: bold ? 8 : 0,
    marginBottom: bold ? 2 : 0,
  }}>
    <span style={{
      fontSize: muted ? 12 : 13,
      color: muted ? C.gray : C.labelSecond,
      fontWeight: bold ? 600 : 400,
    }}>
      {label}{approx !== undefined && <Badge approx={approx} />}
    </span>
    <span style={{
      fontSize: muted ? 12 : 13,
      fontWeight: bold ? 700 : 500,
      color: bold ? (green ? C.green : C.blue) : C.labelPrimary,
    }}>
      {value}
    </span>
  </div>
);

// +/- 数値入力（フォーム用）
// 入力中（onChange）は自由に打てるようにし、確定時（onBlur）にmin〜maxへクランプ・NaNガードする
export const NumInput = ({ val, setter, min, max, step = 1, onDone, isMobile, label, id }) => {
  const clamp = (v) => Math.min(max, Math.max(min, v));
  return (
    <div style={{
      display: "flex", alignItems: "center",
      border: `1px solid ${C.formBorder}`,
      borderRadius: 10, overflow: "hidden",
      background: C.formSurface,
    }}>
      <button
        type="button"
        aria-label={label ? `${label}を減らす` : "減らす"}
        onClick={() => { setter(v => +(clamp(+v - step).toFixed(2))); onDone(); }}
        style={{
          padding: isMobile ? "13px 18px" : "10px 16px",
          background: "none", border: "none",
          fontSize: 18, color: C.blue, cursor: "pointer",
          borderRight: `1px solid ${C.formBorder}`,
          lineHeight: 1, fontFamily: "inherit", fontWeight: 300,
        }}>−</button>
      <input
        id={id}
        aria-label={label}
        type="number" value={val}
        onChange={e => {
          const n = +e.target.value;
          if (Number.isFinite(n)) { setter(n); onDone(); }
        }}
        onBlur={e => {
          const n = +e.target.value;
          setter(Number.isFinite(n) ? clamp(n) : min);
          onDone();
        }}
        style={{
          flex: 1, padding: isMobile ? "13px 4px" : "10px 4px",
          border: "none", background: "transparent",
          textAlign: "center",
          fontSize: isMobile ? 16 : 14,
          color: C.formLabel, outline: "none",
          fontFamily: "inherit", fontWeight: 500,
        }}
        min={min} max={max} step={step}
      />
      <button
        type="button"
        aria-label={label ? `${label}を増やす` : "増やす"}
        onClick={() => { setter(v => +(clamp(+v + step).toFixed(2))); onDone(); }}
        style={{
          padding: isMobile ? "13px 18px" : "10px 16px",
          background: "none", border: "none",
          fontSize: 18, color: C.blue, cursor: "pointer",
          borderLeft: `1px solid ${C.formBorder}`,
          lineHeight: 1, fontFamily: "inherit", fontWeight: 300,
        }}>＋</button>
    </div>
  );
};

// セグメントコントロール風ボタングループ
export const SegBtn = ({ active, onClick, children, isMobile }) => (
  <button type="button" onClick={onClick} aria-pressed={active} style={{
    flex: 1,
    padding: isMobile ? "10px 0" : "8px 0",
    border: "none", borderRadius: 7, cursor: "pointer",
    fontFamily: "inherit",
    fontSize: isMobile ? 14 : 13,
    fontWeight: active ? 600 : 400,
    background: active ? C.formBg : "transparent",
    color: active ? C.blue : C.gray,
    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
    transition: "all 0.15s",
  }}>{children}</button>
);
