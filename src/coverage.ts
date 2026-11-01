import { listCountries, type CountryProfile } from "./data.js";

export type CountryState = "verified" | "partial" | "unverified";

export function countryState(p: CountryProfile): CountryState {
  // `verified`  : authority, every listed law and the Art. 8 age are verified against primary text.
  // `partial`   : at least one national-law fact (a law or the Art. 8 age) is verified/inferred.
  // `unverified`: only the supervisory authority is verified; national law still to be researched.
  const national = [p.digitalConsentAge.status, ...p.laws.map((l) => l.status)];
  if (p.laws.length && p.authority.status === "verified" && p.digitalConsentAge.status === "verified" && p.laws.every((l) => l.status === "verified")) return "verified";
  if (national.some((s) => s === "verified" || s === "inferred")) return "partial";
  return "unverified";
}

/** Honest coverage report: what is verified against primary sources and what is not. */
export function coverage() {
  const byCountry: Record<string, CountryState> = {};
  for (const c of listCountries()) byCountry[c.code] = countryState(c);
  const vals = Object.values(byCountry);
  return {
    total: vals.length,
    verified: vals.filter((v) => v === "verified").length,
    partial: vals.filter((v) => v === "partial").length,
    unverified: vals.filter((v) => v === "unverified").length,
    byCountry,
  };
}
