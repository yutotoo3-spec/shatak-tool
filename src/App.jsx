import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";

// 適用年度（毎年3月改定）
// 出典: https://www.kyoukaikenpo.or.jp/g7/cat330/sb3130/
const RATE_YEAR = "2026（令和8）";

// ─────────────────────────────────────────────────────────────
// 協会けんぽ 都道府県別 健康保険料率（令和8年度・被保険者折半率 %）
// ※ 令和8年3月分（4月納付分）から適用
// ※ 未確認の都道府県（★）は令和6年度値のまま。公式サイトで要確認。
// ─────────────────────────────────────────────────────────────
const KENPO_RATES = {
  "北海道":5.140,"青森":4.925,"岩手":4.755,"宮城":5.055/*★*/,"秋田":5.005,
  "山形":4.875,"福島":4.750,"茨城":4.760,"栃木":4.890/*★据置*/,"群馬":4.840,
  "埼玉":4.835,"千葉":4.865,"東京":4.925,"神奈川":5.010/*★据置*/,"新潟":4.605,
  "富山":4.845/*★*/,"石川":4.995/*★*/,"福井":4.940/*★*/,"山梨":4.980/*★*/,"長野":4.730/*★*/,
  "岐阜":4.955/*★*/,"静岡":4.875/*★*/,"愛知":4.995/*★*/,"三重":4.855/*★*/,"滋賀":4.900/*★*/,
  "京都":5.005/*★*/,"大阪":5.145/*★*/,"兵庫":5.085/*★*/,"奈良":4.980/*★*/,"和歌山":4.995/*★*/,
  "鳥取":4.905/*★*/,"島根":4.930/*★据置*/,"岡山":5.085/*★*/,"広島":4.975/*★*/,"山口":4.985/*★*/,
  "徳島":5.050/*★*/,"香川":5.145/*★*/,"愛媛":4.955/*★*/,"高知":4.975/*★*/,"福岡":5.175/*★*/,
  "佐賀":5.275,"長崎":4.985/*★*/,"熊本":4.985/*★*/,"大分":4.985/*★*/,"宮崎":4.925/*★*/,
  "鹿児島":5.020/*★*/,"沖縄":4.720,
};
const PREFS = Object.keys(KENPO_RATES);

// ─────────────────────────────────────────────────────────────
// 健康保険組合・共済組合 プリセット（被保険者折半率 %）
// ─────────────────────────────────────────────────────────────
const KUMIAI_PRESETS = [
  { name: "IT・通信系", rate: 4.50, desc: "例: 情報サービス産業健保" },
  { name: "製造業系",   rate: 4.80, desc: "例: 電機・機械系健保組合" },
  { name: "金融・保険", rate: 4.30, desc: "例: 銀行・生保系健保組合" },
  { name: "流通・小売", rate: 5.00, desc: "例: 小売業健保組合" },
  { name: "共済組合",   rate: 4.10, desc: "例: 公務員共済（標準的目安）" },
];

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
  return Math.floor(Math.max(0, s - shakai - 430000 - 330000 * dep) * 0.1 + 5000);
};

const calcPattern = (nenshu, yachin, age, dep, withShatak, kenpoRate, bonusMonths, coRatio) => {
  const coR = coRatio / 100;
  const teiji = withShatak ? nenshu - yachin * coR * 12 : nenshu;
  const monthly = teiji / (12 + bonusMonths);
  const annualBonus = monthly * bonusMonths;
  const h = getHyojun(monthly);
  const kenpo = Math.round(h * kenpoRate);
  const kaigo = age >= 40 ? Math.round(h * 0.0081) : 0;
  const kosei = Math.round(h * 0.0915);
  const koyo  = Math.round(monthly * 0.0060);
  const monthly_shakai = kenpo + kaigo + kosei + koyo;
  const bh = Math.floor(annualBonus / 1000) * 1000;
  const bonus_shakai =
    Math.round(bh * kenpoRate) +
    (age >= 40 ? Math.round(bh * 0.0081) : 0) +
    Math.round(Math.min(bh, 1500000) * 0.0915) +
    Math.round(annualBonus * 0.0060);
  const annual_shakai = monthly_shakai * 12 + bonus_shakai;
  const kazei = Math.max(0, teiji - kyuyoKojo(teiji) - annual_shakai - 480000 - 380000 * dep);
  const annual_shotoku = calcShotoku(kazei);
  const annual_jumin   = calcJumin(teiji, annual_shakai, dep);
  const selfYachin    = withShatak ? Math.round(yachin * (1 - coR)) : yachin;
  const annual_yachin = selfYachin * 12;
  const annual_tedori = teiji - annual_shakai - annual_shotoku - annual_jumin - annual_yachin;
  const m_shakai  = Math.round(annual_shakai / 12);
  const m_shotoku = Math.round(annual_shotoku / 12);
  const m_jumin   = Math.round(annual_jumin / 12);
  const m_tedori  = Math.round(annual_tedori / 12);
  const co_shakai = Math.round(h * kenpoRate) + (age >= 40 ? Math.round(h * 0.0081) : 0)
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
// Apple Design System カラー定数
// ─────────────────────────────────────────────────────────────
const C = {
  bg:           "#000000",
  surface:      "#1C1C1E",
  surface2:     "#2C2C2E",
  surface3:     "#3A3A3C",
  labelPrimary: "#FFFFFF",
  labelSecond:  "rgba(235,235,245,0.6)",
  labelThird:   "rgba(235,235,245,0.3)",
  separator:    "rgba(84,84,88,0.65)",
  blue:         "#0A84FF",
  green:        "#30D158",
  orange:       "#FF9F0A",
  red:          "#FF453A",
  gray:         "#8E8E93",
  gray2:        "#636366",
  formBg:       "#FFFFFF",
  formSurface:  "#F2F2F7",
  formLabel:    "#1C1C1E",
  formSecond:   "#3C3C43",
  formBorder:   "rgba(60,60,67,0.18)",
  formSep:      "rgba(60,60,67,0.1)",
};

// ─────────────────────────────────────────────────────────────
// UI コンポーネント
// ─────────────────────────────────────────────────────────────

const SectionLabel = ({ children, light }) => (
  <div style={{
    fontSize: 11, fontWeight: 600,
    color: light ? C.formSecond : C.labelSecond,
    letterSpacing: "0.06em", textTransform: "uppercase",
    marginBottom: 12,
  }}>
    {children}
  </div>
);

const Badge = ({ approx }) => (
  <span style={{
    fontSize: 9, padding: "2px 6px", borderRadius: 4, marginLeft: 5,
    background: approx ? "rgba(255,159,10,0.15)" : "rgba(10,132,255,0.15)",
    color: approx ? C.orange : C.blue,
    fontWeight: 600, letterSpacing: "0.03em", verticalAlign: "middle",
  }}>{approx ? "概算" : "確定"}</span>
);

// フォーム内 Row（白カード用）
const FormRow = ({ label, value, approx, bold, muted }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 0",
    borderBottom: `1px solid ${C.formSep}`,
  }}>
    <span style={{
      fontSize: muted ? 12 : 13,
      color: muted ? C.gray : C.formSecond,
      fontWeight: bold ? 600 : 400,
    }}>
      {label}{approx !== undefined && <Badge approx={approx} />}
    </span>
    <span style={{
      fontSize: muted ? 12 : 13,
      fontWeight: bold ? 700 : 500,
      color: bold ? C.blue : C.formLabel,
    }}>
      {value}
    </span>
  </div>
);

// 結果カード内 Row（ダークカード用）
const Row = ({ label, value, approx, bold, muted, green }) => (
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
const NumInput = ({ val, setter, min, max, step = 1, onDone, isMobile }) => (
  <div style={{
    display: "flex", alignItems: "center",
    border: `1px solid ${C.formBorder}`,
    borderRadius: 10, overflow: "hidden",
    background: C.formSurface,
  }}>
    <button
      onClick={() => { setter(v => +(Math.max(min, +v - step).toFixed(2))); onDone(); }}
      style={{
        padding: isMobile ? "13px 18px" : "10px 16px",
        background: "none", border: "none",
        fontSize: 18, color: C.blue, cursor: "pointer",
        borderRight: `1px solid ${C.formBorder}`,
        lineHeight: 1, fontFamily: "inherit", fontWeight: 300,
      }}>−</button>
    <input
      type="number" value={val}
      onChange={e => { setter(+e.target.value); onDone(); }}
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
      onClick={() => { setter(v => +(Math.min(max, +v + step).toFixed(2))); onDone(); }}
      style={{
        padding: isMobile ? "13px 18px" : "10px 16px",
        background: "none", border: "none",
        fontSize: 18, color: C.blue, cursor: "pointer",
        borderLeft: `1px solid ${C.formBorder}`,
        lineHeight: 1, fontFamily: "inherit", fontWeight: 300,
      }}>＋</button>
  </div>
);

// セグメントコントロール風ボタングループ
const SegBtn = ({ active, onClick, children, isMobile }) => (
  <button onClick={onClick} style={{
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

// ── カスタムチャートツールチップ
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={{
      background: C.surface2,
      border: `1px solid ${C.separator}`,
      borderRadius: 12,
      padding: "10px 14px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      minWidth: 160,
    }}>
      <div style={{ color: C.labelSecond, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{
          display: "flex", justifyContent: "space-between",
          gap: 16, marginBottom: 4,
        }}>
          <span style={{ color: p.fill, fontSize: 11 }}>● {p.name}</span>
          <span style={{ color: C.labelPrimary, fontSize: 11, fontWeight: 600 }}>{p.value.toFixed(1)}万円</span>
        </div>
      ))}
      <div style={{
        borderTop: `1px solid ${C.separator}`,
        marginTop: 8, paddingTop: 8,
        display: "flex", justifyContent: "space-between",
      }}>
        <span style={{ color: C.labelSecond, fontSize: 11 }}>合計</span>
        <span style={{ color: C.labelPrimary, fontSize: 11, fontWeight: 700 }}>{total.toFixed(1)}万円</span>
      </div>
    </div>
  );
};

// ── 月収内訳グラフ
const CHART_COLORS = {
  手取り: C.green,
  社保:   C.gray2,
  所得税: C.orange,
  住民税: "#FF6B00",
  家賃:   C.red,
};

const CompareChart = ({ no, yes, isMobile }) => {
  const data = [
    {
      name: "社宅なし",
      手取り: man(no.m_tedori),
      社保:   man(no.m_shakai),
      所得税: man(no.m_shotoku),
      住民税: man(no.m_jumin),
      家賃:   man(no.selfYachin),
    },
    {
      name: "社宅あり",
      手取り: man(yes.m_tedori),
      社保:   man(yes.m_shakai),
      所得税: man(yes.m_shotoku),
      住民税: man(yes.m_jumin),
      家賃:   man(yes.selfYachin),
    },
  ];

  return (
    <div style={{
      background: C.surface,
      borderRadius: 16,
      padding: isMobile ? "18px 12px 14px" : "22px 24px 16px",
      marginBottom: 12,
      border: `1px solid ${C.separator}`,
    }}>
      <SectionLabel>月収内訳グラフ（万円）</SectionLabel>
      <ResponsiveContainer width="100%" height={isMobile ? 190 : 210}>
        <BarChart data={data} layout="vertical" barCategoryGap="30%"
          margin={{ left: 8, right: 36, top: 0, bottom: 0 }}>
          <XAxis type="number"
            tickFormatter={v => `${v}万`}
            tick={{ fontSize: 10, fill: C.gray }}
            axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name"
            tick={{ fontSize: isMobile ? 12 : 13, fill: C.labelSecond, fontWeight: 500 }}
            axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<ChartTooltip />} />
          {Object.entries(CHART_COLORS).map(([key, color]) => (
            <Bar key={key} dataKey={key} stackId="a" fill={color}
              radius={key === "家賃" ? [0, 4, 4, 0] : 0}>
              {key === "手取り" && (
                <LabelList dataKey={key} position="insideLeft"
                  formatter={v => v > 3 ? `${v}万` : ""}
                  style={{ fill: "#fff", fontSize: 10, fontWeight: 600 }} />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div style={{
        display: "flex", flexWrap: "wrap",
        gap: "6px 16px", marginTop: 12,
        justifyContent: "center",
      }}>
        {Object.entries(CHART_COLORS).map(([k, c]) => (
          <span key={k} style={{
            fontSize: 11, color: C.labelSecond,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 2,
              background: c, display: "inline-block",
            }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── 理論年収・年間負担内訳テーブル
const CostSummaryTable = ({ no, yes, nenshu, coRatio, isMobile }) => {
  // 理論年収（提示年収）= 借上社宅の会社負担分を含まない純粋な給与オファー額
  const totalNenshu = nenshu * 10000;
  const noPersonal  = no.annual_yachin + no.annual_shakai + no.annual_shotoku + no.annual_jumin;
  const yesPersonal = yes.annual_yachin + yes.annual_shakai + yes.annual_shotoku + yes.annual_jumin;
  const noCompany   = no.companyTotal * 12;
  const yesCompany  = yes.companyTotal * 12;

  const TH = ({ children, accent, right }) => (
    <th style={{
      padding: isMobile ? "8px 8px" : "11px 16px",
      fontSize: isMobile ? 11 : 12,
      fontWeight: 600,
      color: accent ? C.labelPrimary : C.labelSecond,
      background: accent === "no" ? C.surface3
                : accent === "yes" ? C.blue
                : C.surface2,
      textAlign: right ? "right" : "left",
      borderBottom: `1px solid ${C.separator}`,
      whiteSpace: "nowrap",
    }}>{children}</th>
  );

  const TD = ({ children, bold, green, blue, muted, right }) => (
    <td style={{
      padding: isMobile ? "7px 8px" : "9px 16px",
      fontSize: isMobile ? 11 : 12,
      fontWeight: bold ? 700 : muted ? 400 : 500,
      color: green ? C.green : blue ? C.blue : muted ? C.gray : C.labelPrimary,
      textAlign: right ? "right" : "left",
      borderBottom: `1px solid ${C.separator}`,
      background: bold && (green || blue) ? (green ? "rgba(48,209,88,0.08)" : "rgba(10,132,255,0.08)") : "transparent",
      whiteSpace: "nowrap",
    }}>{children}</td>
  );

  const SepRow = ({ label }) => (
    <tr>
      <td colSpan={3} style={{
        padding: isMobile ? "8px 8px 5px" : "10px 16px 6px",
        fontSize: 10, fontWeight: 600,
        color: C.labelSecond,
        letterSpacing: "0.08em",
        background: C.surface2,
        borderBottom: `1px solid ${C.separator}`,
        textTransform: "uppercase",
      }}>{label}</td>
    </tr>
  );

  return (
    <div style={{
      background: C.surface,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 12,
      border: `1px solid ${C.separator}`,
    }}>
      <div style={{ padding: isMobile ? "16px 16px 10px" : "20px 24px 12px" }}>
        <SectionLabel>理論年収・年間負担内訳（概算）</SectionLabel>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <colgroup>
            <col style={{ width: isMobile ? "42%" : "44%" }} />
            <col style={{ width: isMobile ? "29%" : "28%" }} />
            <col style={{ width: isMobile ? "29%" : "28%" }} />
          </colgroup>
          <thead>
            <tr>
              <TH> </TH>
              <TH accent="no" right>社宅なし</TH>
              <TH accent="yes" right>社宅あり</TH>
            </tr>
          </thead>
          <tbody>
            <tr>
              <TD bold blue>理論年収（提示年収）</TD>
              <TD bold blue right>{yen2(totalNenshu)}</TD>
              <TD bold blue right>{yen2(totalNenshu)}</TD>
            </tr>

            <SepRow label="企業支払い（年間）" />
            <tr>
              <TD muted>　給与</TD>
              <TD right>{yen2(no.teiji)}</TD>
              <TD right>{yen2(yes.teiji)}</TD>
            </tr>
            <tr>
              <TD muted>　会社負担社保</TD>
              <TD right>{yen2(no.co_shakai * 12)}</TD>
              <TD right>{yen2(yes.co_shakai * 12)}</TD>
            </tr>
            <tr>
              <TD muted>　社宅家賃（会社負担）</TD>
              <TD muted right>−</TD>
              <TD right>{yen2(yes.co_yachin * 12)}</TD>
            </tr>
            <tr>
              <TD bold>　企業合計</TD>
              <TD bold right>{yen2(noCompany)}</TD>
              <TD bold right>{yen2(yesCompany)}</TD>
            </tr>

            <SepRow label="個人負担（年間）" />
            <tr>
              <TD muted>　家賃自己負担</TD>
              <TD right>{yen2(no.annual_yachin)}</TD>
              <TD right>{yen2(yes.annual_yachin)}</TD>
            </tr>
            <tr>
              <TD muted>　社保（本人）</TD>
              <TD right>{yen2(no.annual_shakai)}</TD>
              <TD right>{yen2(yes.annual_shakai)}</TD>
            </tr>
            <tr>
              <TD muted>　税金（所得税＋住民税）</TD>
              <TD right>{yen2(no.annual_shotoku + no.annual_jumin)}</TD>
              <TD right>{yen2(yes.annual_shotoku + yes.annual_jumin)}</TD>
            </tr>
            <tr>
              <TD bold>　個人負担合計</TD>
              <TD bold right>{yen2(noPersonal)}</TD>
              <TD bold right>{yen2(yesPersonal)}</TD>
            </tr>

            <SepRow label="結果" />
            <tr>
              <TD bold green>年間手取り（実質）</TD>
              <TD bold right>{yen2(no.annual_tedori)}</TD>
              <TD bold green right>{yen2(yes.annual_tedori)}</TD>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{
        padding: isMobile ? "10px 16px 14px" : "10px 24px 16px",
        fontSize: 11, color: C.gray, lineHeight: 1.6,
      }}>
        理論年収は借上社宅の会社負担分を含まない提示給与額。住民税は概算。
      </div>
    </div>
  );
};

// ── 詳細カード
const PatternCard = ({ title, isRecommended, data, coRatio, isMobile }) => (
  <div style={{
    flex: 1, minWidth: 0,
    borderRadius: 16, overflow: "hidden",
    background: C.surface,
    border: isRecommended
      ? `1px solid ${C.blue}`
      : `1px solid ${C.separator}`,
    boxShadow: isRecommended ? `0 0 0 1px ${C.blue}22` : "none",
  }}>
    {/* カードヘッダー */}
    <div style={{
      background: isRecommended ? C.blue : C.surface2,
      padding: "14px 18px",
      position: "relative",
    }}>
      {isRecommended && (
        <div style={{
          position: "absolute", top: 10, right: 14,
          background: "rgba(255,255,255,0.2)",
          color: "#fff", fontSize: 9, fontWeight: 700,
          padding: "2px 8px", borderRadius: 6,
          letterSpacing: "0.08em",
        }}>推奨</div>
      )}
      <div style={{
        color: C.labelPrimary,
        fontWeight: 700, fontSize: 15, marginBottom: 3,
      }}>{title}</div>
      <div style={{
        color: isRecommended ? "rgba(255,255,255,0.65)" : C.labelSecond,
        fontSize: 11,
      }}>
        月給 {yen2(data.monthly)}
        {isRecommended ? `　家賃の${coRatio}%を会社負担` : "　家賃全額自己負担"}
      </div>
    </div>

    <div style={{ padding: "16px 18px" }}>
      {/* 手取りハイライト */}
      <div style={{
        background: isRecommended ? "rgba(48,209,88,0.1)" : C.surface2,
        border: `1px solid ${isRecommended ? "rgba(48,209,88,0.3)" : C.separator}`,
        borderRadius: 12, padding: "14px 16px",
        marginBottom: 16, textAlign: "center",
      }}>
        <div style={{ fontSize: 10, color: C.labelSecond, fontWeight: 600, marginBottom: 3 }}>
          月間手取り（実質）
        </div>
        <div style={{ fontSize: 10, color: C.gray, marginBottom: 8 }}>家賃支払い完了後</div>
        <div style={{
          fontSize: isMobile ? 26 : 24,
          fontWeight: 700,
          color: isRecommended ? C.green : C.labelPrimary,
          letterSpacing: "-0.02em",
        }}>
          {yen(data.m_tedori)}
        </div>
        <div style={{ fontSize: 11, color: C.labelSecond, marginTop: 4 }}>
          年間 {yen2(data.annual_tedori)}　概算
        </div>
      </div>

      {/* 社会保険 */}
      <div style={{ fontSize: 10, color: C.gray, fontWeight: 600, marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        社会保険料（月次・本人負担）
      </div>
      <Row label="健康保険" value={`−${yen(data.kenpo)}`} muted />
      {data.kaigo > 0 && <Row label="介護保険" value={`−${yen(data.kaigo)}`} muted />}
      <Row label="厚生年金" value={`−${yen(data.kosei)}`} muted />
      <Row label="雇用保険" value={`−${yen(data.koyo)}`} muted />
      <Row label="月次社保合計" value={`−${yen(data.monthly_shakai)}`} />
      {data.annualBonus > 0 && (
        <Row label="賞与時社保（年間）" value={`−${yen(data.bonus_shakai)}`} muted />
      )}

      {/* 税金 */}
      <div style={{ fontSize: 10, color: C.gray, fontWeight: 600, margin: "12px 0 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        税金（月換算）
      </div>
      <Row label="所得税" value={`−${yen(data.m_shotoku)}`} approx={false} muted />
      <Row label="住民税" value={`−${yen(data.m_jumin)}`} approx={true} muted />

      {/* 家賃 */}
      <div style={{ fontSize: 10, color: C.gray, fontWeight: 600, margin: "12px 0 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        家賃
      </div>
      <Row label="自己負担" value={`−${yen(data.selfYachin)}/月`} muted />

      {/* 会社コスト */}
      <div style={{
        marginTop: 14, padding: "12px 14px",
        background: C.surface2,
        borderRadius: 10,
        border: `1px solid ${C.separator}`,
      }}>
        <div style={{ fontSize: 10, color: C.gray, fontWeight: 600, marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          会社コスト（月間）
        </div>
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
      if (p.get("n")) setNenshu(+p.get("n"));
      if (p.get("y")) setYachin(+p.get("y"));
      if (p.get("a")) setAge(+p.get("a"));
      if (p.get("d")) setDep(+p.get("d"));
      if (p.get("p") && KENPO_RATES[p.get("p")]) setPref(p.get("p"));
      if (p.get("b") != null) setBonus(+p.get("b"));
      if (p.get("r")) setCoRatio(Math.min(100, Math.max(50, +p.get("r"))));
      if (p.get("it") === "kumiai") {
        setInsuranceType("kumiai");
        if (p.get("kr")) setCustomKenpoRate(Math.min(15, Math.max(1, +p.get("kr"))));
      }
      setRan(true);
      setMode("candidate");
    } catch {}
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
    const params = new URLSearchParams(base);
    return `${window.location.href.split("#")[0]}#${params.toString()}`;
  }, [nenshu, yachin, age, dep, pref, bonus, coRatio, insuranceType, customKenpoRate]);

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
        ? `健康保険組合・共済組合の被保険者折半率 ${customKenpoRate}% を使用。厚生年金18.30%・雇用保険0.60%・介護保険1.62%（折半）。`
        : `協会けんぽ${pref}支部 ${RATE_YEAR}年度料率を使用。厚生年金18.30%・雇用保険0.60%・介護保険1.62%（折半）。`,
      "実際の金額は年末調整・確定申告・各種控除により異なります。",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("text"); setTimeout(() => setCopied(""), 2500);
    } catch { alert("コピーに失敗しました。"); }
  }, [result, diff, pref, bonus, age, dep, nenshu, yachin, coRatio]);

  const handlePrint = () => window.print();
  const resetRan = () => setRan(false);

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
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: C.blue,
            }} />
            <div style={{ color: C.labelPrimary, fontSize: 14, fontWeight: 600 }}>HR 設定モード</div>
            <div style={{ color: C.labelSecond, fontSize: 12, marginLeft: 4 }}>
              候補者の情報を入力し、共有 URL を生成して送付してください
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
                  <button key={t} onClick={() => { setInsuranceType(t); resetRan(); }} style={{
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
                    <div style={{ fontSize: 11, color: C.labelSecond, marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      被保険者折半率を直接入力
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        flex: 1,
                        display: "flex", alignItems: "center",
                        border: `1px solid ${C.separator}`,
                        borderRadius: 10, overflow: "hidden",
                        background: C.surface3,
                      }}>
                        <button
                          onClick={() => { setCustomKenpoRate(v => +(Math.max(1, v - 0.1).toFixed(2))); resetRan(); }}
                          style={{
                            padding: "10px 16px", background: "none", border: "none",
                            fontSize: 18, color: C.blue, cursor: "pointer",
                            borderRight: `1px solid ${C.separator}`,
                            lineHeight: 1, fontFamily: "inherit", fontWeight: 300,
                          }}>−</button>
                        <input
                          type="number"
                          value={customKenpoRate}
                          onChange={e => { setCustomKenpoRate(+e.target.value); resetRan(); }}
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
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[50, 60, 70, 75, 80, 85, 90, 100].map(r => (
                  <button key={r} onClick={() => { setCoRatio(r); resetRan(); }} style={{
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
            <label style={lbl}>居住都道府県</label>
            <select value={pref} onChange={e => { setPref(e.target.value); resetRan(); }} style={selectStyle}>
              {PREFS.map(p => (
                <option key={p} value={p}>{p}　（{KENPO_RATES[p]}%）</option>
              ))}
            </select>
          </div>

          {/* 賞与月数 */}
          <div>
            <label style={lbl}>賞与月数</label>
            <div style={{
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
          </div>

          {/* 提示年収 */}
          <div>
            <label style={lbl}>提示年収（万円）</label>
            <NumInput val={nenshu} setter={setNenshu} min={100} max={3000} step={10} onDone={resetRan} isMobile={isMobile} />
            {bonus > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: C.gray }}>
                月給 約{Math.round(nenshu / (12 + bonus))}万　+　賞与 約{Math.round(nenshu * bonus / (12 + bonus))}万/年
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
              <div style={{ marginTop: 6, fontSize: 11, color: C.orange, fontWeight: 500 }}>
                40歳以上：介護保険料が加算されます
              </div>
            )}
          </div>

          {/* 扶養 */}
          <div>
            <label style={lbl}>扶養家族の人数</label>
            <div style={{
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
            ["雇用保険", "0.60%（本人）"],
            ["介護保険", "1.62%（折半・40歳以上）"],
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
            nenshu={nenshu} coRatio={coRatio}
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
            {mode === "hr" && (
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
            )}
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
        <div>協会けんぽ {RATE_YEAR} 年度料率を使用。厚生年金 18.30% · 雇用保険 0.60%（被保険者）· 介護保険 1.62%（折半）。</div>
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
