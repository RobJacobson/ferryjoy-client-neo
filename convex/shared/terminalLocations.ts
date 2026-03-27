/**
 * Compact terminal metadata shared by the Convex backend.
 */

export type ConvexTerminalLocation = {
  TerminalName: string;
  TerminalAbbrev: string;
  Latitude: number;
  Longitude: number;
};

/**
 * Minimal terminal metadata used by the Convex backend.
 */
export const terminalLocations: Record<string, ConvexTerminalLocation> = {
  ANA: {
    TerminalName: "Anacortes",
    TerminalAbbrev: "ANA",
    Latitude: 48.507351,
    Longitude: -122.677,
  },
  BBI: {
    TerminalName: "Bainbridge Island",
    TerminalAbbrev: "BBI",
    Latitude: 47.622339,
    Longitude: -122.509617,
  },
  BRE: {
    TerminalName: "Bremerton",
    TerminalAbbrev: "BRE",
    Latitude: 47.561847,
    Longitude: -122.624089,
  },
  CLI: {
    TerminalName: "Clinton",
    TerminalAbbrev: "CLI",
    Latitude: 47.9754,
    Longitude: -122.349581,
  },
  COU: {
    TerminalName: "Coupeville ",
    TerminalAbbrev: "COU",
    Latitude: 48.159008,
    Longitude: -122.672603,
  },
  EDM: {
    TerminalName: "Edmonds",
    TerminalAbbrev: "EDM",
    Latitude: 47.813378,
    Longitude: -122.385378,
  },
  EAH: {
    TerminalName: "Eagle Harbor",
    TerminalAbbrev: "EAH",
    Latitude: 47.620552,
    Longitude: -122.514245,
  },
  FAU: {
    TerminalName: "Fauntleroy",
    TerminalAbbrev: "FAU",
    Latitude: 47.5232,
    Longitude: -122.3967,
  },
  FRH: {
    TerminalName: "Friday Harbor",
    TerminalAbbrev: "FRH",
    Latitude: 48.535783,
    Longitude: -123.013844,
  },
  KIN: {
    TerminalName: "Kingston",
    TerminalAbbrev: "KIN",
    Latitude: 47.794606,
    Longitude: -122.494328,
  },
  LOP: {
    TerminalName: "Lopez Island",
    TerminalAbbrev: "LOP",
    Latitude: 48.570928,
    Longitude: -122.882764,
  },
  MUK: {
    TerminalName: "Mukilteo",
    TerminalAbbrev: "MUK",
    Latitude: 47.9506,
    Longitude: -122.297,
  },
  ORI: {
    TerminalName: "Orcas Island",
    TerminalAbbrev: "ORI",
    Latitude: 48.597333,
    Longitude: -122.943494,
  },
  PTD: {
    TerminalName: "Point Defiance",
    TerminalAbbrev: "PTD",
    Latitude: 47.306519,
    Longitude: -122.514053,
  },
  POT: {
    TerminalName: "Port Townsend",
    TerminalAbbrev: "POT",
    Latitude: 48.110847,
    Longitude: -122.759039,
  },
  P52: {
    TerminalName: "Seattle",
    TerminalAbbrev: "P52",
    Latitude: 47.602501,
    Longitude: -122.340472,
  },
  SHI: {
    TerminalName: "Shaw Island",
    TerminalAbbrev: "SHI",
    Latitude: 48.584792,
    Longitude: -122.92965,
  },
  SID: {
    TerminalName: "Sidney B.C.",
    TerminalAbbrev: "SID",
    Latitude: 48.643114,
    Longitude: -123.396739,
  },
  SOU: {
    TerminalName: "Southworth",
    TerminalAbbrev: "SOU",
    Latitude: 47.513064,
    Longitude: -122.495742,
  },
  TAH: {
    TerminalName: "Tahlequah",
    TerminalAbbrev: "TAH",
    Latitude: 47.331961,
    Longitude: -122.507786,
  },
  VAI: {
    TerminalName: "Vashon Island",
    TerminalAbbrev: "VAI",
    Latitude: 47.51095,
    Longitude: -122.463639,
  },
};

/**
 * Returns terminal metadata by abbreviation.
 *
 * @param abbrev - Terminal abbreviation, case-insensitive
 * @returns Terminal metadata or `null` when unknown
 */
export const getTerminalLocationByAbbrev = (
  abbrev: string
): ConvexTerminalLocation | null =>
  terminalLocations[abbrev.toUpperCase()] || null;

/**
 * Returns the full terminal name for an abbreviation.
 *
 * @param abbrev - Terminal abbreviation, case-insensitive
 * @returns Terminal name or `null` when unknown
 */
export const getTerminalNameByAbbrev = (abbrev: string): string | null =>
  getTerminalLocationByAbbrev(abbrev)?.TerminalName || null;

/**
 * Returns the terminal abbreviation for a full terminal name.
 *
 * @param terminalName - Full terminal name
 * @returns Terminal abbreviation or an empty string when unknown
 */
export const getTerminalAbbreviation = (terminalName: string): string =>
  Object.values(terminalLocations).find(
    (terminal) => terminal.TerminalName === terminalName
  )
    ?.TerminalAbbrev || "";
