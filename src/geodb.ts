import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { openGeoDatabase } from "./locale.js";

/** DB-IP "IP to Country Lite": monthly MMDB, Creative Commons Attribution licence (https://db-ip.com/db/download/ip-to-country-lite). */
export const DBIP_ATTRIBUTION = "IP Geolocation by DB-IP (https://db-ip.com), licença Creative Commons Attribution: credite a DB-IP e confira as condições em https://db-ip.com/db/download/ip-to-country-lite";

export interface GeoDownload {
  file: string;
  month: string;
  bytes: number;
  smokeTest: string;
  attribution: string;
}

/** Downloads the current (or previous) month's free DB-IP Country Lite database. Run on demand only: nothing else in the project calls the network for GeoIP. */
export async function downloadDbipCountryLite(outFile: string, now = new Date()): Promise<GeoDownload> {
  const months = [0, 1].map((back) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  let lastStatus = 0;
  for (const month of months) {
    const url = `https://download.db-ip.com/free/dbip-country-lite-${month}.mmdb.gz`;
    const r = await fetch(url);
    lastStatus = r.status;
    if (!r.ok) continue;
    const raw = gunzipSync(Buffer.from(await r.arrayBuffer()));
    mkdirSync(path.dirname(outFile), { recursive: true });
    const tmp = outFile + ".tmp";
    writeFileSync(tmp, raw);
    try {
      const g = await openGeoDatabase(tmp); // refuses anything that is not a readable MMDB
      const probe = g.lookup("8.8.8.8");
      renameSync(tmp, outFile);
      return { file: outFile, month, bytes: raw.length, smokeTest: `8.8.8.8 -> ${probe ?? "not found"}`, attribution: DBIP_ATTRIBUTION };
    } catch (e) {
      throw new Error(`Downloaded file is not a valid MMDB: ${(e as Error).message}`);
    }
  }
  throw new Error(`Could not download the DB-IP database (HTTP ${lastStatus}). Download it manually from https://db-ip.com/db/download/ip-to-country-lite`);
}
