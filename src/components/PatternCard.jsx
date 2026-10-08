import { C } from "../theme.js";
import { yen, yen2 } from "../format";
import { Row } from "./primitives.jsx";

// ── 詳細カード
export const PatternCard = ({ title, isRecommended, data, coRatio, isMobile }) => (
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
