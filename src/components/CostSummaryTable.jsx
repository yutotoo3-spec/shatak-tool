import { C } from "../theme.js";
import { yen2 } from "../format.js";
import { SectionLabel } from "./primitives.jsx";

export const CostSummaryTable = ({ no, yes, nenshu, isMobile }) => {
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
