import { C } from "../theme.js";
import { SectionLabel } from "./primitives.jsx";

const TOOLS = [
  {
    key: "candidate",
    badge: "候補者向け",
    badgeColor: C.green,
    title: "候補者モード",
    who: "候補者（オファーを受けた方）",
    when: "人事担当から共有URLを受け取ったとき、または条件を自分で試算してみたいとき",
    what: [
      "社宅あり／なしの手取り額を比較できる",
      "月収の内訳（社会保険・税金・家賃）をグラフで確認できる",
      "年収・家賃・年齢などの条件は自分でも調整できる",
    ],
  },
  {
    key: "hr",
    badge: "人事担当向け",
    badgeColor: C.blue,
    title: "HR設定モード",
    who: "人事担当",
    when: "内定条件を検討している段階（まだ入居物件の家賃が決まっていなくてもOK）",
    what: [
      "自社の健康保険料率・社宅会社負担割合を設定できる",
      "候補者ごとの条件（年収・想定家賃など）でシミュレーションできる",
      "結果を共有URLとして発行し、候補者に送付できる",
      "複数シナリオ（負担割合違い等）を並べて比較できる",
    ],
  },
  {
    key: "kitei",
    badge: "人事担当向け・社内用",
    badgeColor: C.orange,
    title: "規定通り（/kitei）",
    who: "人事担当（社内用）",
    when: "入社が確定し、入居物件の家賃も確定した段階",
    what: [
      "借上社宅管理規程（第9条・第11条）に基づく正式な金額を算出する",
      "会社負担70%／本人負担30%の確定値で計算する（概算ツールの負担割合設定とは別）",
      "規程上の上限を超える場合の要相談ラインも表示する",
    ],
    href: "/kitei",
  },
];

export const IntroPanel = ({ setMode, isMobile }) => (
  <div style={{
    maxWidth: 680, margin: "0 auto 20px",
    borderRadius: 16,
    background: C.surface,
    border: `1px solid ${C.separator}`,
    overflow: "hidden",
  }}>
    <div style={{ padding: isMobile ? "18px 16px" : "22px 24px" }}>
      <SectionLabel>はじめに</SectionLabel>
      <div style={{ color: C.labelPrimary, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        このツールには3つの使い方があります
      </div>
      <div style={{ color: C.labelSecond, fontSize: 12, lineHeight: 1.7, marginBottom: 20 }}>
        内定条件を検討している段階（家賃は仮の金額でよい）では「候補者モード」「HR設定モード」の<strong style={{ color: C.labelPrimary }}>概算ツール</strong>を、
        入社が確定し入居物件の家賃が決まった段階では「規定通り」の<strong style={{ color: C.labelPrimary }}>社内規程準拠ツール</strong>を使ってください。
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {TOOLS.map(tool => {
          const Card = tool.href ? "a" : "button";
          return (
            <Card
              key={tool.key}
              type={tool.href ? undefined : "button"}
              href={tool.href}
              onClick={tool.href ? undefined : () => setMode(tool.key)}
              style={{
                display: "block", textAlign: "left", textDecoration: "none",
                border: `1px solid ${C.separator}`, borderRadius: 12,
                padding: "16px 18px",
                background: C.surface2,
                cursor: "pointer", fontFamily: "inherit",
                width: "100%",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.labelPrimary }}>{tool.title}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: tool.badgeColor,
                  background: tool.badgeColor + "22", padding: "2px 7px", borderRadius: 5,
                  letterSpacing: "0.02em",
                }}>{tool.badge}</span>
                <span style={{ fontSize: 11, color: C.labelThird, marginLeft: "auto" }}>
                  {tool.href ? "開く →" : "このモードを開く →"}
                </span>
              </div>

              <div style={{ fontSize: 12, color: C.labelSecond, lineHeight: 1.8, marginBottom: 8 }}>
                <span style={{ color: C.gray }}>いつ使う：</span>{tool.when}
              </div>

              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.labelSecond, lineHeight: 1.8 }}>
                {tool.what.map(line => <li key={line}>{line}</li>)}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  </div>
);
