import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { C } from "../theme.js";
import { man } from "../format.js";
import { SectionLabel } from "./primitives.jsx";

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

export const CompareChart = ({ no, yes, isMobile }) => {
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
