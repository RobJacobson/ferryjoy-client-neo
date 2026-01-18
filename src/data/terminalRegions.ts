/**
 * Terminal Regions Configuration
 *
 * Maps region names to arrays of TerminalIDs for filtering terminals by region.
 * Used by the homepage carousel to filter terminal cards.
 */

/**
 * Valid region names for terminal filtering.
 */
export type TerminalRegion =
  | "All Terminals"
  | "San Juan Islands"
  | "Seattle/Central"
  | "Edmonds/Kingston"
  | "Mukiteo/Whidby Islands"
  | "South Sound/Vashon";

/**
 * Mapping of region names to arrays of TerminalIDs.
 *
 * TerminalID mappings:
 * - San Juan Islands: Anacortes (1), Friday Harbor (10), Lopez Island (13), Orcas Island (15), Shaw Island (18)
 * - Seattle/Central: Seattle/P52 (7), Bainbridge Island (3), Bremerton (4)
 * - Edmonds/Kingston: Edmonds (8), Kingston (12)
 * - Mukiteo/Whidby Islands: Clinton (5), Coupeville (11), Mukilteo (14), Port Townsend (17)
 * - South Sound/Vashon: Fauntleroy (9), Point Defiance (16), Southworth (20), Tahlequah (21), Vashon Island (22)
 */
export const TERMINAL_REGIONS: Record<TerminalRegion, number[]> = {
  "All Terminals": [],
  "San Juan Islands": [1, 10, 13, 15, 18],
  "Seattle/Central": [7, 3, 4],
  "Edmonds/Kingston": [8, 12],
  "Mukiteo/Whidby Islands": [5, 11, 14, 17],
  "South Sound/Vashon": [9, 16, 20, 21, 22],
} as const;
