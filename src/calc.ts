import { getHyojun, getKenpoHyojun } from "./rates";

// ─────────────────────────────────────────────────────────────
// 所得税・住民税の計算ロジック
// ─────────────────────────────────────────────────────────────

// 給与所得控除（令和7年度税制改正で最低保証額55万円→65万円・適用上限1,625,000円→1,900,000円に変更。
// 国税庁「令和7年分の年末調整のしかた」速算表に準拠。所得税・住民税の両方で共通して使う給与所得の算出に使用）
export const kyuyoKojo = (y: number): number => {
  if (y <= 1900000) return 650000;
  if (y <= 3600000) return y * 0.3 + 80000;
  if (y <= 6600000) return y * 0.2 + 440000;
  if (y <= 8500000) return y * 0.1 + 1100000;
  return 1950000;
};
// 所得税の基礎控除（令和7年度税制改正）
// ベースは48万円→58万円に恒久的に引き上げ。さらに令和7・8年分（2025・2026年）に限り、
// 給与所得（合計所得金額相当）に応じて最大37万円を上乗せする時限措置が設けられている。
// 令和9年分以降は上乗せ特例が終了するため、その時点で baseKisoKojo の分岐は見直しが必要。
// 合計所得2,400万円超の段階的減少・消失ルールは本措置以前から存在する恒久ルール。
// 出典: 国税庁「令和7年度税制改正による所得税の基礎控除の見直し」
export const kisoKojoTokurei = (shotokuGaku: number): number => {
  if (shotokuGaku <= 1320000) return 370000;
  if (shotokuGaku <= 3360000) return 300000;
  if (shotokuGaku <= 4890000) return 100000;
  if (shotokuGaku <= 6550000) return 50000;
  return 0;
};
export const kisoKojoShotoku = (shotokuGaku: number): number => {
  if (shotokuGaku > 25000000) return 0;
  if (shotokuGaku > 24500000) return 160000;
  if (shotokuGaku > 24000000) return 320000;
  return 580000 + kisoKojoTokurei(shotokuGaku);
};
export const calcShotoku = (k: number): number => {
  if (k <= 0) return 0;
  let t: number;
  if (k <= 1950000) t = k * 0.05;
  else if (k <= 3300000) t = k * 0.1 - 97500;
  else if (k <= 6950000) t = k * 0.2 - 427500;
  else if (k <= 9000000) t = k * 0.23 - 636000;
  else if (k <= 18000000) t = k * 0.33 - 1536000;
  else t = k * 0.4 - 2796000;
  return Math.floor(t * 1.021);
};
// 住民税の基礎控除（43万円）は所得税と異なり令和7年度税制改正の対象外で変更なし。
// ただし給与所得控除（kyuyoKojo）の見直しは住民税にも共通して適用される。
export const calcJumin = (nenshu: number, shakai: number, dep: number): number => {
  const s = nenshu - kyuyoKojo(nenshu);
  return Math.floor(Math.max(0, s - shakai - 430000 - 330000 * dep) * 0.1 + 5000);
};

// ─────────────────────────────────────────────────────────────
// その他の社会保険料率（被保険者負担分・年度更新が必要な値）
// ・厚生年金保険料率 18.30%（折半9.15%）: 平成29年9月以降固定。法律上の上限のため年度改定なし。
//   出典: 日本年金機構 https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/index.html
// ・介護保険料率（第2号被保険者）1.62%（折半0.81%）: 令和8年度・協会けんぽ全国一律。
//   出典: https://www.kyoukaikenpo.or.jp/file/202510200923.pdf
// ・雇用保険料率 0.50%（被保険者負担・一般事業）: 令和8年度（令和8年4月〜令和9年3月）。
//   農林水産・清酒製造業・建設業は被保険者負担0.60%と異なるため、本ツールは一般事業を前提とする。
//   出典: https://jsite.mhlw.go.jp/yamanashi-roudoukyoku/koyouhoken_R8.html
// ・健康保険・介護保険の標準賞与額上限は「年度（4月〜翌3月）累計573万円」。
//   厚生年金の上限（1回の賞与ごとに150万円）とは算定単位が異なるため区別すること。
//   出典: 全国健康保険協会（協会けんぽ） https://www.kyoukaikenpo.or.jp/
// ─────────────────────────────────────────────────────────────
export const KENPO_BONUS_ANNUAL_CAP: number = 5730000;

export interface CalcPatternResult {
  teiji: number;
  monthly: number;
  annualBonus: number;
  h: number;
  kenpo: number;
  kaigo: number;
  kosei: number;
  koyo: number;
  monthly_shakai: number;
  bonus_shakai: number;
  annual_shakai: number;
  m_shakai: number;
  m_shotoku: number;
  m_jumin: number;
  m_tedori: number;
  annual_tedori: number;
  annual_shotoku: number;
  annual_jumin: number;
  selfYachin: number;
  annual_yachin: number;
  co_shakai: number;
  co_yachin: number;
  companyTotal: number;
}

export const calcPattern = (
  nenshu: number,
  yachin: number,
  age: number,
  dep: number,
  withShatak: boolean,
  kenpoRate: number,
  bonusMonths: number,
  coRatio: number,
): CalcPatternResult => {
  const coR = coRatio / 100;
  const teiji = withShatak ? nenshu - yachin * coR * 12 : nenshu;
  const monthly = teiji / (12 + bonusMonths);
  const annualBonus = monthly * bonusMonths;
  const h = getHyojun(monthly);           // 厚生年金用（上限65万円）
  const hKenpo = getKenpoHyojun(monthly); // 健康保険・介護保険用（上限139万円）
  const kenpo = Math.round(hKenpo * kenpoRate);
  const kaigo = age >= 40 ? Math.round(hKenpo * 0.0081) : 0;  // 介護保険0.81%（折半）
  const kosei = Math.round(h * 0.0915);                       // 厚生年金9.15%（折半）
  const koyo  = Math.round(monthly * 0.0050);                 // 雇用保険0.50%（被保険者・一般事業）
  const monthly_shakai = kenpo + kaigo + kosei + koyo;
  const bh = Math.floor(annualBonus / 1000) * 1000;
  const bhKenpo = Math.min(bh, KENPO_BONUS_ANNUAL_CAP); // 健保・介護保険は年度累計573万円で頭打ち
  const bonus_shakai =
    Math.round(bhKenpo * kenpoRate) +
    (age >= 40 ? Math.round(bhKenpo * 0.0081) : 0) +
    Math.round(Math.min(bh, 1500000) * 0.0915) + // 厚生年金は1回の賞与ごと150万円で頭打ち
    Math.round(annualBonus * 0.0050);
  const annual_shakai = monthly_shakai * 12 + bonus_shakai;
  const shotokuGaku = teiji - kyuyoKojo(teiji); // 給与所得（基礎控除の判定にも使用）
  const kazei = Math.max(0, shotokuGaku - annual_shakai - kisoKojoShotoku(shotokuGaku) - 380000 * dep);
  const annual_shotoku = calcShotoku(kazei);
  const annual_jumin   = calcJumin(teiji, annual_shakai, dep);
  const selfYachin    = withShatak ? Math.round(yachin * (1 - coR)) : yachin;
  const annual_yachin = selfYachin * 12;
  const annual_tedori = teiji - annual_shakai - annual_shotoku - annual_jumin - annual_yachin;
  const m_shakai  = Math.round(annual_shakai / 12);
  const m_shotoku = Math.round(annual_shotoku / 12);
  const m_jumin   = Math.round(annual_jumin / 12);
  const m_tedori  = Math.round(annual_tedori / 12);
  const co_shakai = Math.round(hKenpo * kenpoRate) + (age >= 40 ? Math.round(hKenpo * 0.0081) : 0)
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

// ─────────────────────────────────────────────────────────────
// 借上社宅管理規程 第9条: 基本給に対する補助対象限度額の比率
// 単身: 基本給×1/5 ／ 配偶者・扶養家族と同居（家族帯同）: 基本給×1/4
// 規定通りツール（KiteiApp）・概算ツール（App）の両方から参照する共通ロジック
// ─────────────────────────────────────────────────────────────
export type Taido = "tanshin" | "kazoku";

export const TAIDO_RATIO: Record<Taido, number> = { tanshin: 1 / 5, kazoku: 1 / 4 };

export interface KiteiLimits {
  genzai: number;
  warnThreshold: number;
}

// 基本給から補助対象限度額・提供上限（要相談ライン）を算出
// 実賃料が未確定の段階（物件探しの前）でも使える、家賃の目安算出
export const calcLimits = (kihonkyu: number, taido: Taido): KiteiLimits => {
  const genzai = Math.floor(kihonkyu * TAIDO_RATIO[taido]); // 補助対象限度額
  const warnThreshold = Math.floor(genzai * 1.5);           // 提供可否の目安ライン
  return { genzai, warnThreshold };
};
