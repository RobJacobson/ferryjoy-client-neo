/**
 * Terminal-to-route mapping for WSF ferry schedules.
 *
 * Maps departing/arriving terminal pairs to internal route abbreviations.
 * Triangle terminals (FAU, SOU, VAI) always map to "f-v-s".
 * Key "*" denotes all destinations from a terminal.
 */

import type { SelectedTerminalPair } from "@/data/contexts/SelectedTerminalPairContext";

/** Routes for a specific terminal pair. Key "*" = all destinations from that terminal. */
type RoutesByArrivingTerminal = Record<string, string[]>;

/** departingTerminal -> (arrivingTerminal | "*") -> routeAbbrevs (internal) */
export const ROUTE_ABBREVS_BY_TERMINAL: Record<
  string,
  RoutesByArrivingTerminal
> = {
  P52: { BBI: ["sea-bi"], BRE: ["sea-br"], "*": ["sea-bi", "sea-br"] },
  BBI: { P52: ["sea-bi"], "*": ["sea-bi"] },
  BRE: { P52: ["sea-br"], "*": ["sea-br"] },
  EDM: { KIN: ["ed-king"], "*": ["ed-king"] },
  KIN: { EDM: ["ed-king"], "*": ["ed-king"] },
  MUK: { CLI: ["muk-cl"], "*": ["muk-cl"] },
  CLI: { MUK: ["muk-cl"], "*": ["muk-cl"] },
  POT: { COU: ["pt-key"], "*": ["pt-key"] },
  COU: { POT: ["pt-key"], "*": ["pt-key"] },
  PTD: { TAH: ["pd-tal"], "*": ["pd-tal"] },
  TAH: { PTD: ["pd-tal"], "*": ["pd-tal"] },
  FAU: { SOU: ["f-v-s"], VAI: ["f-v-s"], "*": ["f-v-s"] },
  SOU: { FAU: ["f-v-s"], VAI: ["f-v-s"], "*": ["f-v-s"] },
  VAI: { FAU: ["f-v-s"], SOU: ["f-v-s"], "*": ["f-v-s"] },
  ANA: {
    FRH: ["ana-sj"],
    LOP: ["ana-sj"],
    ORI: ["ana-sj"],
    SHI: ["ana-sj"],
    "*": ["ana-sj"],
  },
  FRH: {
    ANA: ["ana-sj"],
    LOP: ["ana-sj"],
    ORI: ["ana-sj"],
    SHI: ["ana-sj"],
    "*": ["ana-sj"],
  },
  LOP: {
    ANA: ["ana-sj"],
    FRH: ["ana-sj"],
    ORI: ["ana-sj"],
    SHI: ["ana-sj"],
    "*": ["ana-sj"],
  },
  ORI: {
    ANA: ["ana-sj"],
    FRH: ["ana-sj"],
    LOP: ["ana-sj"],
    SHI: ["ana-sj"],
    "*": ["ana-sj"],
  },
  SHI: {
    ANA: ["ana-sj"],
    FRH: ["ana-sj"],
    LOP: ["ana-sj"],
    ORI: ["ana-sj"],
    "*": ["ana-sj"],
  },
};

/**
 * Returns route abbreviations for a departing terminal and optional arriving terminal.
 *
 * @param departingTerminalAbbrev - Departure terminal (e.g. "P52")
 * @param arrivingTerminalAbbrev - Optional destination; omit for "all" destinations
 * @returns Array of internal route abbreviations
 */
export const getRouteAbbrevs = (
  departingTerminalAbbrev: string,
  arrivingTerminalAbbrev?: string
): string[] => {
  const byArriving =
    ROUTE_ABBREVS_BY_TERMINAL[departingTerminalAbbrev.toUpperCase()];
  if (!byArriving) return [];
  const key = arrivingTerminalAbbrev?.toUpperCase() ?? "*";
  return byArriving[key] ?? byArriving["*"] ?? [];
};

/** Default route abbrevs when no selection (P52 -> BBI). */
const DEFAULT_ROUTE_ABBREVS = ["sea-bi"];

/**
 * Derives route abbreviations from SelectedTerminalPair.
 *
 * @param selectedTerminalPair - Current selection from SelectedTerminalPairContext
 * @returns Array of route abbreviations; default ["sea-bi"] when null
 */
export const getRouteAbbrevsForSelection = (
  selectedTerminalPair: SelectedTerminalPair
): string[] => {
  if (!selectedTerminalPair) return DEFAULT_ROUTE_ABBREVS;
  if (selectedTerminalPair.kind === "pair") {
    return getRouteAbbrevs(
      selectedTerminalPair.from,
      selectedTerminalPair.dest
    );
  }
  return getRouteAbbrevs(selectedTerminalPair.terminal, undefined);
};
