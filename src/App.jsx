import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";

// ─────────────────────────────────────────────────────────────
// 協会けんぽ 都道府県別 健康保険料率（2024年度・被保険者折半率 %）
// ─────────────────────────────────────────────────────────────
const KENPO_RATES = {
  "北海道":5.105,"青森":4.850,"岩手":4.860,"宮城":5.055,"秋田":4.975,
  "山形":4.990,"福島":4.780,"茨城":4.775,"栃木":4.890,"群馬":4.860,
  "埼玉":4.910,"千葉":4.945,"東京":4.990,"神奈川":5.010,"新潟":4.730,
  "富山":4.845,"石川":4.995,"福井":4.940,"山梨":4.980,"長野":4.730,
  "岐阜":4.955,"静岡":4.875,"愛知":4.995,"三重":4.855,"滋賀":4.900,
  "京都":5.005,"大阪":5.145,"兵庫":5.085,"奈良":4.980,"和歌山":4.995,
  "鳥取":4.905,"島根":4.930,"岡山":5.085,"広島":4.975,"山口":4.985,
  "徳島":5.050,"香川":5.145,"愛媛":4.955,"高知":4.975,"福岡":5.175,
  "佐賀":5.245,"長崎":4.985,"熊本":4.985,"大分":4.985,"宮崎":4.925,
  "鹿児島":5.020,"沖縄":4.890,
};
const PREFS = Object.keys(KENPO_RATES);

// ─────────────────────────────────────────────────────────────
// 計算ロジック
// ─────────────────────────────────────────────────────────────
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

const calcPattern = (nenshu, yachin, age, dep, withShatak, kenpoRate, bonusMonths, coRatio) => {
  const coR = coRatio / 100; // 会社負担割合（例：80 → 0.80）
  // 社宅あり：給与年収から社宅会社負担分を差し引いた額が提示年収
  const teiji = withShatak ? nenshu - yachin * coR * 12 : nenshu;

  // 月収・賞与の分離（提示年収 ÷ (12 + 賞与月数) = 月収）
  const monthly = teiji / (12 + bonusMonths);
  const annualBonus = monthly * bonusMonths;

  // 月次社会保険（標準報酬月額ベース）
  const h = getHyojun(monthly);
  const kenpo = Math.round(h * kenpoRate);
  const kaigo = age >= 40 ? Math.round(h * 0.0080) : 0;
  const kosei = Math.round(h * 0.0915);
  const koyo  = Math.round(monthly * 0.0060);
  const monthly_shakai = kenpo + kaigo + kosei + koyo;

  // 賞与時の社会保険（千円以下切捨て、厚生年金は上限150万/回）
  const bh = Math.floor(annualBonus / 1000) * 1000;
  const bonus_shakai =
    Math.round(bh * kenpoRate) +
    (age >= 40 ? Math.round(bh * 0.0080) : 0) +
    Math.round(Math.min(bh, 1500000) * 0.0915) +
    Math.round(annualBonus * 0.0060);

  const annual_shakai = monthly_shakai * 12 + bonus_shakai;

  // 税（年間）
  const kazei = Math.max(0, teiji - kyuyoKojo(teiji) - annual_shakai - 480000 - 380000 * dep);
  const annual_shotoku = calcShotoku(kazei);
  const annual_jumin   = calcJumin(teiji, annual_shakai, dep);

  const selfYachin    = withShatak ? Math.round(yachin * (1 - coR)) : yachin;
  const annual_yachin = selfYachin * 12;

  const annual_tedori = teiji - annual_shakai - annual_shotoku - annual_jumin - annual_yachin;

  // 月換算（表示用）
  const m_shakai  = Math.round(annual_shakai / 12);
  const m_shotoku = Math.round(annual_shotoku / 12);
  const m_jumin   = Math.round(annual_jumin / 12);
  const m_tedori  = Math.round(annual_tedori / 12);

  // 会社負担
  const co_shakai = Math.round(h * kenpoRate) + (age >= 40 ? Math.round(h * 0.0080) : 0)
    + Math.round(h * 0.0915) + Math.round(monthly * 0.0085);
  const co_yachin = withShatak ? Math.round(yachin * coR) : 0;

  return {
    teiji, monthly, annualBonus, h,
    kenpo, kaigo, kosei, koyo, monthly_shakai,
    bonus_shakai, annual_shakai,
    m_shakai, m_shotoku, m_jumin, m_tedori,
    annual_tedori, annual_shotoku, annual_jumin,
    selfYachin, annual_yachin,
    co_shakai, co_yachin,
    companyTotal: monthly + co_shakai + co_yachin,
  };
};

const yen  = (v) => Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(1)}万円` : `${Math.round(v).toLocaleString()}円`;
const yen2 = (v) => `${Math.round(v / 10000).toLocaleString()}万円`;
const man  = (v) => +(v / 10000).toFixed(1);

// ─────────────────────────────────────────────────────────────
// UI パーツ
// ─────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <div style={{
    fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: "0.12em",
    textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
  }}>
    <span style={{ width: 16, height: 1.5, background: "#334155", display: "inline-block" }} />
    {children}
  </div>
);

const Badge = ({ approx }) => (
  <span style={{
    fontSize: 9, padding: "1px 5px", borderRadius: 3, marginLeft: 4,
    background: approx ? "#fef3c7" : "#dbeafe",
    color: approx ? "#92400e" : "#1e40af",
    fontWeight: 700, letterSpacing: "0.04em", verticalAlign: "middle",
  }}>{approx ? "概算" : "確定"}</span>
);

const Row = ({ label, value, approx, bold, muted, highlight }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: bold ? "9px 10px" : "5px 2px",
    borderBottom: "1px solid #f1f5f9",
    background: bold ? (highlight ? "#f0fdf4" : "#eff6ff") : "transparent",
    borderRadius: bold ? 6 : 0,
    marginBottom: bold ? 2 : 0,
  }}>
    <span style={{ fontSize: muted ? 11 : 13, color: muted ? "#94a3b8" : "#475569", fontWeight: bold ? 700 : 400 }}>
      {label}{approx !== undefined && <Badge approx={approx} />}
    </span>
    <span style={{
      fontSize: muted ? 11 : 13,
      fontWeight: bold ? 800 : 500,
      color: bold ? (highlight ? "#166534" : "#1d4ed8") : "#1e293b",
    }}>
      {value}
    </span>
  </div>
);

const NumInput = ({ val, setter, min, max, step = 1, onDone, isMobile }) => (
  <div style={{
    display: "flex", alignItems: "center",
    border: "1.5px solid #e2e8f0", borderRadius: 8, overflow: "hidden", background: "#f8fafc",
    transition: "border-color 0.2s",
  }}>
    <button
      onClick={() => { setter(v => +(Math.max(min, +v - step).toFixed(2))); onDone(); }}
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
      onClick={() => { setter(v => +(Math.min(max, +v + step).toFixed(2))); onDone(); }}
      style={{
        padding: isMobile ? "13px 18px" : "9px 14px", background: "none", border: "none",
        fontSize: 18, color: "#64748b", cursor: "pointer",
        borderLeft: "1px solid #e2e8f0", lineHeight: 1, fontFamily: "inherit",
      }}>＋</button>
  </div>
);

// ── カスタムツールチップ（グラフ用）
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={{
      background: "#1e293b", border: "1px solid #334155", borderRadius: 10,
      padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 160,
    }}>
      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
          <span style={{ color: p.fill, fontSize: 11 }}>● {p.name}</span>
          <span style={{ color: "#f1f5f9", fontSize: 11, fontWeight: 600 }}>{p.value.toFixed(1)}万円</span>
        </div>
      ))}
      <div style={{ borderTop: "1px solid #334155", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#64748b", fontSize: 11 }}>月収合計</span>
        <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>{total.toFixed(1)}万円</span>
      </div>
    </div>
  );
};

// ── 理論年収・年間負担内訳テーブル
const CostSummaryTable = ({ no, yes, nenshu, coRatio, isMobile }) => {
  // 理論年収（提示年収）= 借上社宅の会社負担分を含まない純粋な給与オファー額
  // 社宅なし・社宅あり 両方とも同値（借上社宅は理論年収に含まない）
  const totalNenshu = nenshu * 10000;

  const noPersonal  = no.annual_yachin + no.annual_shakai + no.annual_shotoku + no.annual_jumin;
  const yesPersonal = yes.annual_yachin + yes.annual_shakai + yes.annual_shotoku + yes.annual_jumin;
  const noCompany   = no.companyTotal * 12;
  const yesCompany  = yes.companyTotal * 12;

  const TH = ({ children, accent }) => (
    <th style={{
      padding: isMobile ? "8px 6px" : "10px 14px",
      fontSize: isMobile ? 11 : 12, fontWeight: 800,
      color: accent ? "#fff" : "#475569",
      background: accent ?? "#f8fafc",
      textAlign: "center", borderBottom: "2px solid #e2e8f0",
      whiteSpace: "nowrap",
    }}>{children}</th>
  );

  const TD = ({ children, bold, highlight, sub, right }) => (
    <td style={{
      padding: isMobile ? "7px 6px" : "9px 14px",
      fontSize: isMobile ? 11 : 12,
      fontWeight: bold ? 800 : sub ? 400 : 500,
      color: highlight === "green" ? "#16a34a" : highlight === "blue" ? "#1d4ed8" : sub ? "#94a3b8" : "#1e293b",
      textAlign: right ? "right" : "left",
      borderBottom: "1px solid #f1f5f9",
      background: bold ? (highlight === "green" ? "#f0fdf4" : highlight === "blue" ? "#eff6ff" : "#f8fafc") : "transparent",
      whiteSpace: "nowrap",
    }}>{children}</td>
  );

  const SepRow = ({ label }) => (
    <tr>
      <td colSpan={3} style={{
        padding: "8px 14px 4px",
        fontSize: 10, fontWeight: 800, color: "#64748b",
        letterSpacing: "0.1em", background: "#f8fafc",
        borderBottom: "1px solid #e2e8f0",
      }}>{label}</td>
    </tr>
  );

  return (
    <div style={{
      background: "#fff", borderRadius: 14, overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16,
      border: "1px solid #e2e8f0",
    }}>
      <div style={{ padding: isMobile ? "14px 12px 10px" : "18px 20px 12px" }}>
        <SectionLabel>理論年収・年間負担内訳（概算）</SectionLabel>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: isMobile ? "42%" : "44%" }} />
            <col style={{ width: isMobile ? "29%" : "28%" }} />
            <col style={{ width: isMobile ? "29%" : "28%" }} />
          </colgroup>
          <thead>
            <tr>
              <TH> </TH>
              <TH accent="#475569">社宅なし</TH>
              <TH accent="#1d4ed8">社宅あり ✦</TH>
            </tr>
          </thead>
          <tbody>
            {/* 理論年収 */}
            <tr>
              <TD bold>理論年収（提示年収）</TD>
              <TD bold right highlight="blue">{yen2(totalNenshu)}</TD>
              <TD bold right highlight="blue">{yen2(totalNenshu)}</TD>
            </tr>

            {/* 企業支払い */}
            <SepRow label="▼ 企業支払い（年間）" />
            <tr>
              <TD sub>　給与</TD>
              <TD right>{yen2(no.teiji)}</TD>
              <TD right>{yen2(yes.teiji)}</TD>
            </tr>
            <tr>
              <TD sub>　会社負担社保</TD>
              <TD right>{yen2(no.co_shakai * 12)}</TD>
              <TD right>{yen2(yes.co_shakai * 12)}</TD>
            </tr>
            <tr>
              <TD sub>　社宅家賃（会社負担）</TD>
              <TD right sub>−</TD>
              <TD right>{yen2(yes.co_yachin * 12)}</TD>
            </tr>
            <tr>
              <TD bold>　＝ 企業合計</TD>
              <TD bold right>{yen2(noCompany)}</TD>
              <TD bold right>{yen2(yesCompany)}</TD>
            </tr>

            {/* 個人負担 */}
            <SepRow label="▼ 個人負担（年間）" />
            <tr>
              <TD sub>　家賃自己負担</TD>
              <TD right>{yen2(no.annual_yachin)}</TD>
              <TD right>{yen2(yes.annual_yachin)}</TD>
            </tr>
            <tr>
              <TD sub>　社保（本人）</TD>
              <TD right>{yen2(no.annual_shakai)}</TD>
              <TD right>{yen2(yes.annual_shakai)}</TD>
            </tr>
            <tr>
              <TD sub>　税金（所得税＋住民税）</TD>
              <TD right>{yen2(no.annual_shotoku + no.annual_jumin)}</TD>
              <TD right>{yen2(yes.annual_shotoku + yes.annual_jumin)}</TD>
            </tr>
            <tr>
              <TD bold>　＝ 個人負担合計</TD>
              <TD bold right>{yen2(noPersonal)}</TD>
              <TD bold right>{yen2(yesPersonal)}</TD>
            </tr>

            {/* 手取り */}
            <SepRow label="▼ 結果" />
            <tr>
              <TD bold>年間手取り（実質）概算</TD>
              <TD bold right>{yen2(no.annual_tedori)}</TD>
              <TD bold right highlight="green">{yen2(yes.annual_tedori)}</TD>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding: "8px 16px 12px", fontSize: 10, color: "#94a3b8", lineHeight: 1.6 }}>
        ※ 理論年収（提示年収）は借上社宅の会社負担分を含まない純粋な給与額。社宅ありの場合も同額を基準とし、企業は給与を下げた分を社宅費として別途負担します。住民税は概算。
      </div>
    </div>
  );
};

// ── 比較グラフ
const CompareChart = ({ no, yes, isMobile }) => {
  const data = [
    {
      name: "社宅なし",
      手取り: man(no.m_tedori),
      社保: man(no.m_shakai),
      所得税: man(no.m_shotoku),
      住民税: man(no.m_jumin),
      家賃: man(no.selfYachin),
    },
    {
      name: "社宅あり",
      手取り: man(yes.m_tedori),
      社保: man(yes.m_shakai),
      所得税: man(yes.m_shotoku),
      住民税: man(yes.m_jumin),
      家賃: man(yes.selfYachin),
    },
  ];

  const COLORS = {
    手取り: "#22c55e",
    社保: "#64748b",
    所得税: "#f97316",
    住民税: "#f59e0b",
    家賃: "#ef4444",
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: isMobile ? "18px 12px 12px" : "22px 24px 16px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16,
      border: "1px solid #e2e8f0",
    }}>
      <SectionLabel>月収内訳グラフ（万円）</SectionLabel>
      <ResponsiveContainer width="100%" height={isMobile ? 200 : 220}>
        <BarChart data={data} layout="vertical" barCategoryGap="30%" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
          <XAxis type="number" tickFormatter={v => `${v}万`} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 11 : 12, fill: "#475569", fontWeight: 700 }} axisLine={false} tickLine={false} width={52} />
          <Tooltip content={<CustomTooltip />} />
          {Object.entries(COLORS).map(([key, color]) => (
            <Bar key={key} dataKey={key} stackId="a" fill={color} radius={key === "家賃" ? [0, 4, 4, 0] : 0}>
              {key === "手取り" && (
                <LabelList dataKey={key} position="insideLeft" formatter={v => v > 3 ? `${v}万` : ""} style={{ fill: "#fff", fontSize: 10, fontWeight: 700 }} />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      {/* 凡例 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10, justifyContent: "center" }}>
        {Object.entries(COLORS).map(([k, c]) => (
          <span key={k} style={{ fontSize: 10, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── 詳細カード
const PatternCard = ({ title, subtitle, accent, data, badge, isMobile }) => (
  <div style={{
    flex: 1, minWidth: 0, borderRadius: 14, overflow: "hidden",
    border: badge ? `2px solid ${accent}` : "1px solid #e2e8f0",
    background: "#fff",
    boxShadow: badge ? `0 8px 32px ${accent}22` : "0 2px 12px rgba(0,0,0,0.06)",
    transition: "box-shadow 0.2s",
  }}>
    <div style={{ background: accent, padding: "14px 18px", position: "relative" }}>
      {badge && (
        <div style={{
          position: "absolute", top: 10, right: 12,
          background: "rgba(255,255,255,0.22)", color: "#fff",
          fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 8, letterSpacing: "0.08em",
        }}>推奨</div>
      )}
      <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{title}</div>
      <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 3 }}>{subtitle}</div>
    </div>
    <div style={{ padding: "14px 16px" }}>
      {/* 手取りハイライト */}
      <div style={{
        background: badge ? "#f0fdf4" : "#f8fafc",
        border: `1px solid ${badge ? "#bbf7d0" : "#e2e8f0"}`,
        borderRadius: 10, padding: "12px 14px", marginBottom: 12, textAlign: "center",
      }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 2 }}>月間手取り（実質）概算</div>
        <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 4 }}>※家賃支払い完了後</div>
        <div style={{ fontSize: isMobile ? 26 : 24, fontWeight: 900, color: badge ? "#16a34a" : "#1e293b" }}>
          {yen(data.m_tedori)}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>年間 {yen2(data.annual_tedori)}</div>
      </div>

      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 4, letterSpacing: "0.08em" }}>社会保険料（月次・本人負担）</div>
      <Row label="健康保険" value={`−${yen(data.kenpo)}`} muted />
      {data.kaigo > 0 && <Row label="介護保険" value={`−${yen(data.kaigo)}`} muted />}
      <Row label="厚生年金" value={`−${yen(data.kosei)}`} muted />
      <Row label="雇用保険" value={`−${yen(data.koyo)}`} muted />
      <Row label="月次社保合計" value={`−${yen(data.monthly_shakai)}`} />
      {data.annualBonus > 0 && (
        <Row label="賞与時社保（年間）" value={`−${yen(data.bonus_shakai)}`} muted />
      )}

      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, margin: "10px 0 4px", letterSpacing: "0.08em" }}>税金（月換算）</div>
      <Row label="所得税" value={`−${yen(data.m_shotoku)}`} approx={false} muted />
      <Row label="住民税" value={`−${yen(data.m_jumin)}`} approx={true} muted />

      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, margin: "10px 0 4px", letterSpacing: "0.08em" }}>家賃</div>
      <Row label="自己負担" value={`−${yen(data.selfYachin)}/月`} muted />

      {/* 会社コスト */}
      <div style={{
        marginTop: 12, padding: "10px 12px", background: "#f8fafc",
        borderRadius: 8, border: "1px dashed #e2e8f0",
      }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>会社コスト（月間）</div>
        <Row label="月給" value={yen(data.monthly)} muted />
        <Row label="会社負担社保" value={`+${yen(data.co_shakai)}`} muted />
        {data.co_yachin > 0 && <Row label="社宅家賃負担" value={`+${yen(data.co_yachin)}`} muted />}
        <Row label="合計" value={yen(data.companyTotal)} bold />
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// メインアプリ
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [nenshu,    setNenshu]    = useState(500);
  const [yachin,    setYachin]    = useState(10);
  const [age,       setAge]       = useState(30);
  const [dep,       setDep]       = useState(0);
  const [pref,      setPref]      = useState("京都");
  const [bonus,     setBonus]     = useState(2);
  const [coRatio,   setCoRatio]   = useState(80); // 社宅会社負担割合（%）
  const [ran,       setRan]       = useState(false);
  const [mode,      setMode]      = useState("candidate");
  const [copied,    setCopied]    = useState("");
  const [isMobile,  setIsMobile]  = useState(window.innerWidth < 640);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // URLハッシュからパラメータ読み込み
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    try {
      const p = new URLSearchParams(hash);
      if (p.get("n")) setNenshu(+p.get("n"));
      if (p.get("y")) setYachin(+p.get("y"));
      if (p.get("a")) setAge(+p.get("a"));
      if (p.get("d")) setDep(+p.get("d"));
      if (p.get("p") && KENPO_RATES[p.get("p")]) setPref(p.get("p"));
      if (p.get("b") !== null && p.get("b") !== undefined) setBonus(+p.get("b"));
      if (p.get("r")) setCoRatio(Math.min(100, Math.max(50, +p.get("r"))));
      setRan(true);
      setMode("candidate");
    } catch {}
  }, []);

  const kenpoRate = useMemo(() => (KENPO_RATES[pref] ?? 5.005) / 100, [pref]);

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
    const params = new URLSearchParams({ n: nenshu, y: yachin, a: age, d: dep, p: pref, b: bonus, r: coRatio });
    return `${window.location.href.split("#")[0]}#${params.toString()}`;
  }, [nenshu, yachin, age, dep, pref, bonus, coRatio]);

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
    const nenshuYen = nenshu * 10000; // 理論年収（提示年収）
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
      `  都道府県            : ${pref}（協会けんぽ ${KENPO_RATES[pref]}%）`,
      `  賞与                : ${bonus}ヶ月`,
      `  年齢                : ${age}歳${age >= 40 ? "（介護保険あり）" : ""}`,
      `  扶養家族            : ${dep}人`,
      "",
      "───────────────────────────────────────",
      "【社宅なし】",
      "───────────────────────────────────────",
      `  月給（額面）        : ${yen2(no.monthly)}${bonus > 0 ? `　賞与: ${yen2(no.annualBonus)}/年` : ""}`,
      `  家賃自己負担        : ${yen(no.selfYachin)}/月（年間 ${yen2(no.annual_yachin)}）`,
      "",
      "  ▼ 企業支払い（年間）",
      `    給与              : ${yen2(no.teiji)}`,
      `    会社負担社保      : ${yen2(no.co_shakai * 12)}`,
      `    社宅費用          : −（なし）`,
      `    ＝ 企業合計       : ${yen2(no.companyTotal * 12)}`,
      "",
      "  ▼ 個人負担（年間）",
      `    家賃              : ${yen2(no.annual_yachin)}`,
      `    社保（本人）      : ${yen2(no.annual_shakai)}`,
      `    税金（所得税+住民税）: ${yen2(no.annual_shotoku + no.annual_jumin)}`,
      `    ＝ 個人負担合計   : ${yen2(noPersonal)}`,
      "",
      `  年間手取り（実質）  : ${yen2(no.annual_tedori)}　※概算`,
      `  月間手取り（実質）  : ${yen(no.m_tedori)}　※家賃支払い後`,
      "",
      "───────────────────────────────────────",
      `【社宅あり（会社${coRatio}%負担）】`,
      "───────────────────────────────────────",
      `  月給（額面）        : ${yen2(yes.monthly)}${bonus > 0 ? `　賞与: ${yen2(yes.annualBonus)}/年` : ""}`,
      `  家賃自己負担        : ${yen(yes.selfYachin)}/月（年間 ${yen2(yes.annual_yachin)}）`,
      `  社宅会社負担        : ${yen(yes.co_yachin)}/月（年間 ${yen2(yes.co_yachin * 12)}）`,
      "",
      "  ▼ 企業支払い（年間）",
      `    給与              : ${yen2(yes.teiji)}`,
      `    会社負担社保      : ${yen2(yes.co_shakai * 12)}`,
      `    社宅費用          : ${yen2(yes.co_yachin * 12)}`,
      `    ＝ 企業合計       : ${yen2(yes.companyTotal * 12)}`,
      "",
      "  ▼ 個人負担（年間）",
      `    家賃（${100 - coRatio}%分）     : ${yen2(yes.annual_yachin)}`,
      `    社保（本人）      : ${yen2(yes.annual_shakai)}`,
      `    税金（所得税+住民税）: ${yen2(yes.annual_shotoku + yes.annual_jumin)}`,
      `    ＝ 個人負担合計   : ${yen2(yesPersonal)}`,
      "",
      `  年間手取り（実質）  : ${yen2(yes.annual_tedori)}　※概算`,
      `  月間手取り（実質）  : ${yen(yes.m_tedori)}　※家賃支払い後`,
      "",
      "═══════════════════════════════════════",
      `▶ 社宅制度により年間手取りが ${diff > 0 ? "+" : ""}${yen2(diff)}（月間 ${diff > 0 ? "+" : ""}${yen(diff / 12)}）`,
      "═══════════════════════════════════════",
      "",
      "※ 住民税は概算値です（前年所得ベース）。",
      `※ 協会けんぽ${pref}支部の料率を使用。厚生年金18.30%・雇用保険0.60%。`,
      "※ 実際の金額は年末調整・確定申告・各種控除により異なります。",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("text"); setTimeout(() => setCopied(""), 2500);
    } catch {
      alert("コピーに失敗しました。");
    }
  }, [result, diff, pref, bonus, age, dep, nenshu, yachin, coRatio]);

  const handlePrint = () => window.print();
  const resetRan = () => setRan(false);

  const lbl = {
    fontSize: 11, fontWeight: 700, color: "#64748b",
    marginBottom: 6, display: "block", letterSpacing: "0.05em",
  };
  const selectStyle = {
    width: "100%", padding: isMobile ? "12px 10px" : "9px 10px",
    border: "1.5px solid #e2e8f0", borderRadius: 8, background: "#f8fafc",
    fontSize: isMobile ? 15 : 14, color: "#1e293b", outline: "none",
    fontFamily: "inherit", cursor: "pointer",
    appearance: "none", WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
    paddingRight: 32,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(150deg,#060e1f 0%,#0f1e3d 45%,#091428 100%)",
      padding: isMobile ? "16px 12px 56px" : "28px 20px 48px",
      fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',sans-serif",
    }}>

      {/* ── ヘッダー ── */}
      <div style={{ textAlign: "center", marginBottom: isMobile ? 20 : 28 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10,
          padding: "4px 14px", borderRadius: 20,
          background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)",
          color: "#93c5fd", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", display: "inline-block", boxShadow: "0 0 6px #60a5fa" }} />
          HR TOOL ／ 借り上げ社宅制度
        </div>
        <h1 style={{ color: "#f1f5f9", fontSize: isMobile ? 20 : 24, fontWeight: 900, margin: "0 0 6px", lineHeight: 1.3 }}>
          オファー比較シミュレーター
        </h1>
        <p style={{ color: "#475569", fontSize: 11, margin: "0 0 16px" }}>
          協会けんぽ 全47都道府県対応　／　社宅自己負担20%固定　／　賞与考慮あり
        </p>

        {/* モード切替 */}
        <div style={{
          display: "inline-flex", borderRadius: 10, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
        }}>
          {[["candidate", "👤 候補者モード"], ["hr", "⚙️ HR設定モード"]].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: isMobile ? "9px 14px" : "8px 20px", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: mode === m ? 800 : 400,
              background: mode === m ? "rgba(255,255,255,0.16)" : "transparent",
              color: mode === m ? "#f1f5f9" : "#64748b", transition: "all 0.2s",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── HR設定モード パネル ── */}
      {mode === "hr" && (
        <div style={{
          maxWidth: 680, margin: "0 auto 20px", borderRadius: 14, overflow: "hidden",
          border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.05)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          <div style={{ background: "linear-gradient(90deg,#78350f,#92400e)", padding: "12px 18px" }}>
            <div style={{ color: "#fde68a", fontSize: 13, fontWeight: 800 }}>⚙️ HR設定モード</div>
            <div style={{ color: "rgba(253,230,138,0.7)", fontSize: 11, marginTop: 2 }}>
              候補者の情報を入力し、共有URLを生成して送付してください
            </div>
          </div>
          <div style={{ padding: "14px 18px" }}>
            {/* 社宅会社負担割合 */}
            <div style={{
              marginBottom: 16, padding: "14px 16px",
              background: "rgba(255,255,255,0.06)", borderRadius: 10,
              border: "1px solid rgba(251,191,36,0.2)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#fde68a", marginBottom: 10, letterSpacing: "0.05em" }}>
                🏠 社宅会社負担割合
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[50, 60, 70, 75, 80, 85, 90, 100].map(r => (
                  <button key={r} onClick={() => { setCoRatio(r); resetRan(); }} style={{
                    padding: "8px 12px", borderRadius: 7, border: "1.5px solid", cursor: "pointer",
                    borderColor: coRatio === r ? "#f59e0b" : "rgba(255,255,255,0.15)",
                    background: coRatio === r ? "#f59e0b" : "rgba(255,255,255,0.05)",
                    color: coRatio === r ? "#fff" : "#d97706",
                    fontWeight: coRatio === r ? 800 : 500, fontFamily: "inherit", fontSize: 13,
                    transition: "all 0.15s",
                  }}>
                    {r}%
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(253,230,138,0.7)" }}>
                現在：会社 <strong style={{ color: "#fde68a" }}>{coRatio}%</strong> ／ 本人 <strong style={{ color: "#fde68a" }}>{100 - coRatio}%</strong>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#d97706", fontWeight: 600, marginBottom: 12, lineHeight: 1.8 }}>
              ① 社宅会社負担割合・都道府県・年収・家賃・賞与・年齢・扶養を入力<br />
              ② 「シミュレーションを実行」を押す<br />
              ③ 「共有URLをコピー」して候補者にメール・Slackで送付
            </div>
            {result ? (
              <button onClick={handleCopyURL} style={{
                width: "100%", padding: isMobile ? "14px" : "12px", borderRadius: 9,
                background: copied === "url" ? "#065f46" : "linear-gradient(90deg,#b45309,#d97706)",
                color: "#fff", fontWeight: 800, fontSize: isMobile ? 15 : 13,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                letterSpacing: "0.04em", boxShadow: "0 3px 14px rgba(217,119,6,0.35)",
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
        maxWidth: 680, margin: "0 auto 20px", background: "#fff", borderRadius: 16,
        padding: isMobile ? "18px 14px" : "24px 28px",
        boxShadow: "0 16px 56px rgba(0,0,0,0.45)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: "#1d4ed8", color: "#fff", borderRadius: 5, padding: "2px 8px", fontSize: 9, letterSpacing: "0.06em" }}>STEP 1</span>
          候補者の情報を入力してください
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 14 : "16px 24px" }}>

          {/* 都道府県 */}
          <div>
            <label style={lbl}>居住都道府県（健保料率に影響）</label>
            <div style={{ position: "relative" }}>
              <select value={pref} onChange={e => { setPref(e.target.value); resetRan(); }} style={selectStyle}>
                {PREFS.map(p => (
                  <option key={p} value={p}>{p}　（{KENPO_RATES[p]}%）</option>
                ))}
              </select>
            </div>
          </div>

          {/* 賞与月数 */}
          <div>
            <label style={lbl}>賞与月数（月）</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => { setBonus(n); resetRan(); }} style={{
                  flex: 1, padding: isMobile ? "11px 0" : "8px 0", borderRadius: 7,
                  fontSize: isMobile ? 14 : 12, border: "1.5px solid", cursor: "pointer",
                  borderColor: bonus === n ? "#3b82f6" : "#e2e8f0",
                  background: bonus === n ? "#eff6ff" : "#f8fafc",
                  color: bonus === n ? "#1d4ed8" : "#64748b",
                  fontWeight: bonus === n ? 800 : 400, fontFamily: "inherit",
                }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* 提示年収 */}
          <div>
            <label style={lbl}>提示年収（万円）</label>
            <NumInput val={nenshu} setter={setNenshu} min={100} max={3000} step={10} onDone={resetRan} isMobile={isMobile} />
            {bonus > 0 && (
              <div style={{ marginTop: 5, fontSize: 10, color: "#64748b" }}>
                月給 約{Math.round(nenshu / (12 + bonus))}万 ＋ 賞与 約{Math.round(nenshu * bonus / (12 + bonus))}万/年
              </div>
            )}
          </div>

          {/* 家賃 */}
          <div>
            <label style={lbl}>想定家賃・月額（万円）</label>
            <NumInput val={yachin} setter={setYachin} min={1} max={100} step={0.5} onDone={resetRan} isMobile={isMobile} />
          </div>

          {/* 年齢 */}
          <div>
            <label style={lbl}>年齢</label>
            <NumInput val={age} setter={setAge} min={18} max={70} step={1} onDone={resetRan} isMobile={isMobile} />
            {age >= 40 && (
              <div style={{ marginTop: 5, fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>
                ⚠ 40歳以上：介護保険料が加算されます
              </div>
            )}
          </div>

          {/* 扶養 */}
          <div>
            <label style={lbl}>扶養家族の人数</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2, 3].map(n => (
                <button key={n} onClick={() => { setDep(n); resetRan(); }} style={{
                  flex: 1, padding: isMobile ? "11px 0" : "8px 0", borderRadius: 8,
                  fontSize: isMobile ? 14 : 13, border: "1.5px solid", cursor: "pointer",
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
          marginTop: 16, padding: "10px 14px", background: "#f8fafc",
          borderRadius: 8, border: "1px solid #e9eef4", display: "flex", gap: "6px 16px", flexWrap: "wrap",
        }}>
          {[
            ["健康保険", `協会けんぽ ${pref}（${KENPO_RATES[pref]}%）`],
            ["社宅負担", `会社${coRatio}% / 本人${100 - coRatio}%`],
            ["厚生年金", "18.30%（折半）"],
            ["雇用保険", "0.60%（本人）"],
          ].map(([k, v]) => (
            <span key={k} style={{ fontSize: 10, color: "#64748b" }}>
              <span style={{ color: "#94a3b8" }}>{k}：</span>{v}
            </span>
          ))}
        </div>

        <button onClick={() => setRan(true)} style={{
          marginTop: 18, width: "100%", padding: isMobile ? "16px" : "13px",
          background: "linear-gradient(90deg,#1e3a8a,#1e40af,#2563eb)",
          color: "#fff", fontWeight: 800, fontSize: isMobile ? 16 : 14, borderRadius: 10,
          border: "none", cursor: "pointer", letterSpacing: "0.06em", fontFamily: "inherit",
          boxShadow: "0 4px 20px rgba(37,99,235,0.45)",
          WebkitTapHighlightColor: "transparent",
          transition: "opacity 0.2s",
        }}>
          ▶ シミュレーションを実行
        </button>
      </div>

      {/* ── 結果エリア ── */}
      {result && (
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* 差額バナー */}
          <div style={{
            borderRadius: 14, padding: isMobile ? "18px 16px" : "18px 24px",
            background: diff > 0
              ? "linear-gradient(90deg,#064e3b,#065f46,#047857)"
              : "linear-gradient(90deg,#7f1d1d,#991b1b)",
            boxShadow: diff > 0
              ? "0 4px 24px rgba(4,120,87,0.4)"
              : "0 4px 24px rgba(153,27,27,0.4)",
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, color: diff > 0 ? "#6ee7b7" : "#fca5a5", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>
              社宅制度を利用すると年間手取りが
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0,
            }}>
              <div>
                <div style={{ color: "#fff", fontSize: isMobile ? 28 : 26, fontWeight: 900, lineHeight: 1 }}>
                  {diff > 0 ? "+" : "−"}{yen2(Math.abs(diff))}
                  <span style={{ fontSize: 11, color: diff > 0 ? "#6ee7b7" : "#fca5a5", marginLeft: 8, fontWeight: 500 }}>概算</span>
                </div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 4 }}>
                  月換算 {diff > 0 ? "+" : "−"}{yen(Math.abs(diff / 12))}
                </div>
              </div>
              <div style={{ textAlign: isMobile ? "left" : "right" }}>
                <div style={{ color: diff > 0 ? "#6ee7b7" : "#fca5a5", fontSize: 10, fontWeight: 700 }}>会社年間コスト比較</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 3 }}>社宅なし {yen2(result.no.companyTotal * 12)}</div>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>社宅あり {yen2(result.yes.companyTotal * 12)}</div>
              </div>
            </div>
          </div>

          {/* 理論年収・年間負担内訳 */}
          <CostSummaryTable no={result.no} yes={result.yes} nenshu={nenshu} coRatio={coRatio} isMobile={isMobile} />

          {/* グラフ */}
          <CompareChart no={result.no} yes={result.yes} isMobile={isMobile} />

          {/* 2カード */}
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 16 }}>
            <PatternCard
              title="社宅なし"
              subtitle={`月給 ${yen2(result.no.monthly)}　家賃全額自己負担`}
              accent="#475569" data={result.no} isMobile={isMobile}
            />
            <PatternCard
              title="✦ 社宅あり（推奨）"
              subtitle={`月給 ${yen2(result.yes.monthly)}　家賃の${coRatio}%を会社負担`}
              accent="#1d4ed8" data={result.yes} badge isMobile={isMobile}
            />
          </div>

          {/* アクションボタン */}
          <div style={{ display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row", marginBottom: 12 }}>
            <button onClick={handleCopyResult} style={{
              flex: 1, padding: isMobile ? "14px" : "12px", borderRadius: 10,
              background: copied === "text" ? "#065f46" : "#fff",
              color: copied === "text" ? "#fff" : "#1e293b",
              fontWeight: 700, fontSize: isMobile ? 14 : 13,
              border: "1.5px solid", borderColor: copied === "text" ? "#065f46" : "#e2e8f0",
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.3s",
              boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            }}>
              {copied === "text" ? "✓ コピーしました！" : "📋 結果テキストをコピー"}
            </button>
            {mode === "hr" && (
              <button onClick={handleCopyURL} style={{
                flex: 1, padding: isMobile ? "14px" : "12px", borderRadius: 10,
                background: copied === "url" ? "#065f46" : "linear-gradient(90deg,#b45309,#d97706)",
                color: "#fff", fontWeight: 700, fontSize: isMobile ? 14 : 13,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                transition: "background 0.3s", boxShadow: "0 3px 14px rgba(217,119,6,0.35)",
              }}>
                {copied === "url" ? "✓ URLコピー完了！" : "🔗 共有URLをコピー"}
              </button>
            )}
            <button onClick={handlePrint} style={{
              flex: isMobile ? "none" : "0 0 auto", padding: isMobile ? "14px" : "12px 18px",
              borderRadius: 10, background: "rgba(255,255,255,0.08)",
              color: "#94a3b8", fontWeight: 700, fontSize: isMobile ? 14 : 13,
              border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.2s",
            }}>
              🖨️ 印刷
            </button>
          </div>

          {/* 凡例 */}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#475569" }}><Badge approx={false} /> 法令計算による確定値</span>
            <span style={{ fontSize: 10, color: "#475569" }}><Badge approx={true} /> 住民税は前年所得ベースのため概算</span>
          </div>
        </div>
      )}

      {/* ── FAQ ── */}
      <div style={{ maxWidth: 680, margin: "40px auto 0" }}>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 28 }}>
          <div style={{ color: "#334155", fontSize: 11, fontWeight: 700, marginBottom: 14, letterSpacing: "0.06em" }}>よくある質問</div>
          {[
            ["社宅制度で年収が下がるのに手取りが増えるのはなぜ？",
              "社宅家賃の80%を会社負担にすることで、その分が「現物給与」として非課税扱いになります。結果、社会保険料・所得税・住民税の計算ベースが下がり、実質手取りが増加します。"],
            ["賞与月数はどこに影響しますか？",
              "賞与がある場合、月収が変わり標準報酬月額が変わります。また賞与にも社会保険料が別途かかります（健保・厚生年金・雇用保険）。このツールでは賞与時の社保控除も考慮しています。"],
            ["どのくらい正確ですか？",
              "所得税・厚生年金・雇用保険は確定値に近い計算です。住民税は概算です（前年所得ベース・均等割含む）。実際の金額は年末調整・確定申告・各種控除によって変わります。"],
          ].map(([q, a]) => (
            <div key={q} style={{ marginBottom: 14, padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color: "#93c5fd", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Q. {q}</div>
              <div style={{ color: "#64748b", fontSize: 11, lineHeight: 1.7 }}>{a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── フッター ── */}
      <div style={{ textAlign: "center", marginTop: 28, color: "#334155", fontSize: 10, lineHeight: 1.8 }}>
        <div>※ 本ツールは概算シミュレーション用です。実際の金額は状況により異なります。</div>
        <div>※ 協会けんぽ2024年度料率を使用。厚生年金18.30%・雇用保険0.60%（被保険者）。</div>
      </div>

      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
