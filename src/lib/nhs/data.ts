// NHS budget reference data, sourced from King's Fund, Nuffield Trust, IFS,
// House of Commons Library, NHS Confederation, Health Foundation, NHS England.

export const FISCAL_YEAR = "2024/25";

export const NHS_HEADLINE = {
  fiscalYear: FISCAL_YEAR,
  totalBudgetGbp: 192_000_000_000, // ~£192bn DEL for DHSC, NHS England share
  nhsEnglandGbp: 168_800_000_000,
  perCapitaGbp: 3_385,
  yoyRealGrowthPct: 0.7,
  trustDeficitGbp: 1_400_000_000, // aggregate provider deficit 2023/24 (King's Fund)
};

export const SPEND_BY_CATEGORY = [
  { name: "Staff", gbp: 76_000_000_000 },
  { name: "Drugs & clinical supplies", gbp: 24_000_000_000 },
  { name: "Estates & facilities", gbp: 11_000_000_000 },
  { name: "Commissioned services", gbp: 42_000_000_000 },
  { name: "Other operating", gbp: 15_800_000_000 },
];

export const ICBS = [
  { code: "NEY", name: "North East and Yorkshire", allocationGbp: 19_600_000_000 },
  { code: "NW", name: "North West", allocationGbp: 17_400_000_000 },
  { code: "MID", name: "Midlands", allocationGbp: 23_100_000_000 },
  { code: "EOE", name: "East of England", allocationGbp: 14_800_000_000 },
  { code: "LDN", name: "London", allocationGbp: 21_900_000_000 },
  { code: "SE", name: "South East", allocationGbp: 19_700_000_000 },
  { code: "SW", name: "South West", allocationGbp: 13_500_000_000 },
];

export const TRUSTS = [
  { code: "GSTT", name: "Guy's and St Thomas'", icb: "LDN", deficitGbp: -38_000_000 },
  { code: "MFT", name: "Manchester University FT", icb: "NW", deficitGbp: -52_000_000 },
  { code: "LTH", name: "Leeds Teaching Hospitals", icb: "NEY", deficitGbp: 4_000_000 },
  { code: "UHB", name: "University Hospitals Birmingham", icb: "MID", deficitGbp: -71_000_000 },
  { code: "OUH", name: "Oxford University Hospitals", icb: "SE", deficitGbp: -12_000_000 },
  { code: "UHBW", name: "University Hospitals Bristol & Weston", icb: "SW", deficitGbp: -27_000_000 },
  { code: "CUH", name: "Cambridge University Hospitals", icb: "EOE", deficitGbp: -9_000_000 },
];

export const DEFICIT_TREND = [
  { year: "2019/20", gbp: -560_000_000 },
  { year: "2020/21", gbp: 130_000_000 },
  { year: "2021/22", gbp: -180_000_000 },
  { year: "2022/23", gbp: -880_000_000 },
  { year: "2023/24", gbp: -1_400_000_000 },
  { year: "2024/25", gbp: -1_900_000_000 },
];

export const SOURCES = [
  { label: "King's Fund — NHS budget in a nutshell", url: "https://www.kingsfund.org.uk/insight-and-analysis/data-and-charts/nhs-budget-nutshell" },
  { label: "King's Fund — NHS trusts deficit", url: "https://www.kingsfund.org.uk/insight-and-analysis/data-and-charts/nhs-trusts-deficit" },
  { label: "Nuffield Trust — Where does the NHS money go", url: "https://www.nuffieldtrust.org.uk/resource/where-does-the-nhs-money-go" },
  { label: "IFS — Past and future UK health spending", url: "https://ifs.org.uk/publications/past-and-future-uk-health-spending" },
  { label: "House of Commons Library CBP-10458", url: "https://commonslibrary.parliament.uk/research-briefings/cbp-10458/" },
  { label: "Health Foundation — Health care funding", url: "https://www.health.org.uk/reports-and-analysis/analysis/health-care-funding" },
  { label: "NHS Confederation — Funding data & analysis", url: "https://www.nhsconfed.org/articles/advice-and-support/nhs-delivery-and-workforce/funding/health-funding-data-analysis" },
  { label: "NHS England — 2022/23 business plan funding", url: "https://www.england.nhs.uk/publications/business-plan/our-2022-23-business-plan/our-funding/" },
  { label: "One NHS Finance reports", url: "https://onenhsfinance.nhs.uk/?s=Report+" },
];

export function partyDhsc() {
  return process.env.CANTON_PARTY_DHSC ?? "DHSC";
}
export function partyNhsE() {
  return process.env.CANTON_PARTY_NHSE ?? "NHSEngland";
}
export function partyAuditor() {
  return process.env.CANTON_PARTY_AUDITOR ?? "Auditor";
}
export function partyIcb(code: string) {
  return `ICB-${code}`;
}
export function partyTrust(code: string) {
  return `Trust-${code}`;
}

export function gbp(n: number | string) {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (Math.abs(v) >= 1e9) return `£${(v / 1e9).toFixed(2)}bn`;
  if (Math.abs(v) >= 1e6) return `£${(v / 1e6).toFixed(1)}m`;
  if (Math.abs(v) >= 1e3) return `£${(v / 1e3).toFixed(0)}k`;
  return `£${v.toFixed(0)}`;
}
