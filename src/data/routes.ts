/**
 * Routes Data and Types
 *
 * Static data for all Washington State Ferry routes, terminals, and regions.
 * This file contains both type definitions and the actual data.
 */

/**
 * Type definition for route data
 */
export type RouteData = {
  routeId: number;
  routeAbbrev: string;
  description: string;
  regionId: number;
  terminals: string[];
};

/**
 * Type definition for terminal lookup data
 */
export type TerminalLookupData = {
  terminalId: number;
  terminalName: string;
  terminalAbbrev: string;
  regionId: number;
};

/**
 * Type definition for WSF routes data structure
 */
export type WsfRoutesData = {
  routes: Record<string, RouteData>;
  terminalLookup: Record<string, TerminalLookupData>;
  regions: Record<string, string>;
};

/**
 * WSF routes data containing all routes, terminal lookup, and regions
 */
export const wsfRoutesData: WsfRoutesData = {
  routes: {
    "1": {
      routeId: 1,
      routeAbbrev: "pd-tal",
      description: "Pt. Defiance / Tahlequah",
      regionId: 5,
      terminals: ["PTD", "TAH"],
    },
    "3": {
      routeId: 3,
      routeAbbrev: "sea-br",
      description: "Seattle / Bremerton",
      regionId: 4,
      terminals: ["P52", "BRE"],
    },
    "5": {
      routeId: 5,
      routeAbbrev: "sea-bi",
      description: "Seattle / Bainbridge Island",
      regionId: 4,
      terminals: ["P52", "BBI"],
    },
    "6": {
      routeId: 6,
      routeAbbrev: "ed-king",
      description: "Edmonds / Kingston",
      regionId: 3,
      terminals: ["EDM", "KIN"],
    },
    "7": {
      routeId: 7,
      routeAbbrev: "muk-cl",
      description: "Mukilteo / Clinton",
      regionId: 2,
      terminals: ["MUK", "CLI"],
    },
    "8": {
      routeId: 8,
      routeAbbrev: "pt-key",
      description: "Port Townsend / Coupeville",
      regionId: 2,
      terminals: ["POT", "COU"],
    },
    "9": {
      routeId: 9,
      routeAbbrev: "ana-sj",
      description: "Anacortes / San Juan Islands",
      regionId: 1,
      terminals: ["ANA", "FRH", "LOP", "ORI", "SHI"],
    },
    "13": {
      routeId: 13,
      routeAbbrev: "f-s",
      description: "Fauntleroy (West Seattle) / Southworth",
      regionId: 5,
      terminals: ["FAU", "SOU"],
    },
    "14": {
      routeId: 14,
      routeAbbrev: "f-v-s",
      description: "Fauntleroy (West Seattle) / Vashon",
      regionId: 5,
      terminals: ["FAU", "VAI"],
    },
    "15": {
      routeId: 15,
      routeAbbrev: "s-v",
      description: "Southworth / Vashon",
      regionId: 5,
      terminals: ["SOU", "VAI"],
    },
  },
  terminalLookup: {
    ANA: {
      terminalId: 1,
      terminalName: "Anacortes",
      terminalAbbrev: "ANA",
      regionId: 1,
    },
    BBI: {
      terminalId: 3,
      terminalName: "Bainbridge Island",
      terminalAbbrev: "BBI",
      regionId: 4,
    },
    BRE: {
      terminalId: 4,
      terminalName: "Bremerton",
      terminalAbbrev: "BRE",
      regionId: 4,
    },
    CLI: {
      terminalId: 5,
      terminalName: "Clinton",
      terminalAbbrev: "CLI",
      regionId: 2,
    },
    COU: {
      terminalId: 11,
      terminalName: "Coupeville",
      terminalAbbrev: "COU",
      regionId: 2,
    },
    EDM: {
      terminalId: 8,
      terminalName: "Edmonds",
      terminalAbbrev: "EDM",
      regionId: 3,
    },
    FAU: {
      terminalId: 9,
      terminalName: "Fauntleroy",
      terminalAbbrev: "FAU",
      regionId: 5,
    },
    FRH: {
      terminalId: 10,
      terminalName: "Friday Harbor",
      terminalAbbrev: "FRH",
      regionId: 1,
    },
    KIN: {
      terminalId: 12,
      terminalName: "Kingston",
      terminalAbbrev: "KIN",
      regionId: 3,
    },
    LOP: {
      terminalId: 13,
      terminalName: "Lopez Island",
      terminalAbbrev: "LOP",
      regionId: 1,
    },
    MUK: {
      terminalId: 14,
      terminalName: "Mukilteo",
      terminalAbbrev: "MUK",
      regionId: 2,
    },
    ORI: {
      terminalId: 15,
      terminalName: "Orcas Island",
      terminalAbbrev: "ORI",
      regionId: 1,
    },
    P52: {
      terminalId: 7,
      terminalName: "Seattle",
      terminalAbbrev: "P52",
      regionId: 4,
    },
    PTD: {
      terminalId: 16,
      terminalName: "Point Defiance",
      terminalAbbrev: "PTD",
      regionId: 5,
    },
    POT: {
      terminalId: 17,
      terminalName: "Port Townsend",
      terminalAbbrev: "POT",
      regionId: 2,
    },
    SHI: {
      terminalId: 18,
      terminalName: "Shaw Island",
      terminalAbbrev: "SHI",
      regionId: 1,
    },
    SOU: {
      terminalId: 20,
      terminalName: "Southworth",
      terminalAbbrev: "SOU",
      regionId: 5,
    },
    TAH: {
      terminalId: 21,
      terminalName: "Tahlequah",
      terminalAbbrev: "TAH",
      regionId: 5,
    },
    VAI: {
      terminalId: 22,
      terminalName: "Vashon Island",
      terminalAbbrev: "VAI",
      regionId: 5,
    },
  },
  regions: {
    "1": "San Juan Islands",
    "2": "Whidbey Island",
    "3": "Central Sound",
    "4": "Seattle",
    "5": "South Sound",
  },
};
