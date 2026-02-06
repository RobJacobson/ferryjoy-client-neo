/**
 * Official crossing time configuration for ScheduledTrips synthetic arrival estimates.
 *
 * These values are used only when WSF schedule data does not provide `ArrivingTime`.
 * We prefer this curated, defensible set of “official” crossing times over ML-derived
 * historical averages for scheduled departure calculations.
 *
 * Notes:
 * - Keys use the terminal pair format "FROM->TO" (see `formatTerminalPairKey`).
 * - Some pairs are route-sensitive (e.g., FAU<->SOU differs between direct and
 *   via-Vashon sailings). For those, we key by route abbrev + pair.
 */

import { formatTerminalPairKey } from "../../ml/shared/config";

export type OfficialCrossingTimeRouteAbbrev =
  | "ed-king"
  | "muk-cl"
  | "pt-key"
  | "pd-tal"
  | "sea-bi"
  | "sea-br"
  | "s-v"
  | "f-s"
  | "f-v-s";

export type OfficialCrossingTimeKey =
  | `${OfficialCrossingTimeRouteAbbrev}:${string}`
  | string;

/**
 * Official crossing time minutes keyed by route+pair when needed.
 * For most routes, the value is the same in both directions.
 */
export const OFFICIAL_CROSSING_TIME_MINUTES: Record<
  OfficialCrossingTimeKey,
  number
> = {
  // Edmonds / Kingston: 30 min
  "ed-king:EDM->KIN": 30,
  "ed-king:KIN->EDM": 30,

  // Mukilteo / Clinton: 20 min
  "muk-cl:MUK->CLI": 20,
  "muk-cl:CLI->MUK": 20,

  // Port Townsend / Coupeville: 35 min
  "pt-key:POT->COU": 35,
  "pt-key:COU->POT": 35,

  // Pt Defiance / Tahlequah: 15 min
  "pd-tal:PTD->TAH": 15,
  "pd-tal:TAH->PTD": 15,

  // Seattle / Bainbridge Island: 35 min
  "sea-bi:P52->BBI": 35,
  "sea-bi:BBI->P52": 35,

  // Seattle / Bremerton: 60 min
  "sea-br:P52->BRE": 60,
  "sea-br:BRE->P52": 60,

  // Southworth / Vashon: 10 min
  "s-v:SOU->VAI": 10,
  "s-v:VAI->SOU": 10,

  // Fauntleroy / Vashon: 20 min
  "f-v-s:FAU->VAI": 20,
  "f-v-s:VAI->FAU": 20,

  // Fauntleroy / Southworth (direct): 30 min
  "f-s:FAU->SOU": 30,
  "f-s:SOU->FAU": 30,

  // Fauntleroy / Southworth (via Vashon): 40 min
  "f-v-s:FAU->SOU": 40,
  "f-v-s:SOU->FAU": 40,

  // Fauntleroy / Vashon also appears on the direct F-S route as an option at times.
  "f-s:FAU->VAI": 20,
  "f-s:VAI->FAU": 20,

  // Southworth / Vashon also appears on the F-V-S route.
  "f-v-s:SOU->VAI": 10,
  "f-v-s:VAI->SOU": 10,
};

/**
 * Get the official crossing time minutes for a scheduled trip.
 *
 * @param params - Lookup parameters
 * @param params.routeAbbrev - Route abbreviation for the trip (e.g. "sea-bi")
 * @param params.departingTerminalAbbrev - Departing terminal abbreviation (e.g. "P52")
 * @param params.arrivingTerminalAbbrev - Arriving terminal abbreviation (e.g. "BBI")
 * @returns Crossing time in minutes, or undefined if not configured
 */
export const getOfficialCrossingTimeMinutes = (params: {
  routeAbbrev: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
}): number | undefined => {
  const pairKey = formatTerminalPairKey(
    params.departingTerminalAbbrev,
    params.arrivingTerminalAbbrev
  );

  // Prefer route-specific values (handles FAU<->SOU direct vs via-Vashon).
  const routeKey = `${params.routeAbbrev}:${pairKey}`;
  const byRoute = OFFICIAL_CROSSING_TIME_MINUTES[routeKey];
  if (byRoute !== undefined) return byRoute;

  // No non-route-scoped fallback for now: if it isn't explicitly configured,
  // we treat it as unknown and return undefined.
  return undefined;
};
