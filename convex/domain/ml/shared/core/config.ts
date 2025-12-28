// ============================================================================
// UNIFIED ML CONFIGURATION
// All configuration constants centralized in one place
// ============================================================================

import type { ModelType } from "./modelTypes";

/**
 * Valid passenger terminal abbreviations
 */
export const VALID_PASSENGER_TERMINALS = new Set([
  "ANA",
  "BBI",
  "BRE",
  "CLI",
  "COU",
  "EDM",
  "FAU",
  "FRH",
  "KIN",
  "LOP",
  "MUK",
  "ORI",
  "P52",
  "POT",
  "PTD",
  "SHI",
  "SID",
  "SOU",
  "TAH",
  "VAI",
]);

/**
 * Terminal name mapping for WSF API responses
 */
export const TERMINAL_NAME_MAPPING: Record<string, string> = {
  // Puget Sound region
  Bainbridge: "BBI",
  "Bainbridge Island": "BBI",
  Bremerton: "BRE",
  Kingston: "KIN",
  Edmonds: "EDM",
  Mukilteo: "MUK",
  Clinton: "CLI",
  Fauntleroy: "FAU",
  Vashon: "VAI",
  "Vashon Island": "VAI",
  Colman: "P52",
  Seattle: "P52",
  Southworth: "SOU",
  "Pt. Defiance": "PTD",
  "Point Defiance": "PTD",
  Tahlequah: "TAH",

  // San Juan Islands
  Anacortes: "ANA",
  Friday: "FRH",
  "Friday Harbor": "FRH",
  Shaw: "SHI",
  "Shaw Island": "SHI",
  Orcas: "ORI",
  "Orcas Island": "ORI",
  Lopez: "LOP",
  "Lopez Island": "LOP",

  // Other
  "Port Townsend": "POT",
  Keystone: "COU",
};

/**
 * Mean at-dock duration (in minutes) for each terminal pair
 */
export const MEAN_AT_DOCK_DURATION: Record<string, number> = {
  "ANA->FRH": 26.74,
  "ANA->LOP": 26.65,
  "ANA->ORI": 26.33,
  "ANA->SHI": 23.2,
  "BBI->P52": 18.5,
  "BRE->P52": 18.55,
  "CLI->MUK": 16.38,
  "COU->POT": 17.94,
  "EDM->KIN": 23.94,
  "FAU->SOU": 15.99,
  "FAU->VAI": 15.42,
  "FRH->ANA": 26.28,
  "FRH->LOP": 27.22,
  "FRH->ORI": 23.39,
  "FRH->SHI": 20.82,
  "KIN->EDM": 24.18,
  "LOP->ANA": 12.63,
  "LOP->FRH": 10.02,
  "LOP->ORI": 12.87,
  "LOP->SHI": 10.7,
  "MUK->CLI": 15.4,
  "ORI->ANA": 19.52,
  "ORI->FRH": 12.09,
  "ORI->LOP": 20.88,
  "ORI->SHI": 21.99,
  "P52->BBI": 21.17,
  "P52->BRE": 18.93,
  "POT->COU": 21.07,
  "PTD->TAH": 17.39,
  "SHI->ANA": 6.23,
  "SHI->LOP": 6.2,
  "SHI->ORI": 6.76,
  "SOU->FAU": 10.55,
  "SOU->VAI": 14.67,
  "TAH->PTD": 13.68,
  "VAI->FAU": 14.12,
  "VAI->SOU": 10.99,
} as const;

/**
 * Duration thresholds for data quality filtering
 */
export const DURATION_THRESHOLDS = {
  AT_SEA: {
    MIN: 2.0,
    MAX: 90.0,
  },
  AT_DOCK: {
    MIN: 2.0,
    MAX: 30.0,
  },
  ARRIVE_ARRIVE_TOTAL: {
    MAX: 120.0,
  },
} as const;

/**
 * Pipeline configuration settings
 */
export const PIPELINE_CONFIG = {
  // Data loading
  DAYS_BACK: 720,
  MAX_RECORDS_PER_VESSEL: 5000,
  MAX_SAMPLES_PER_ROUTE: 2500,
  SAMPLING_STRATEGY: "recent_first",

  // Model training
  COEFFICIENT_ROUNDING_ZERO_THRESHOLD: 1e-6,

  // Evaluation
  EVALUATION: {
    enabled: true,
    trainRatio: 0.8,
    minTrainExamples: 200,
  },
} as const;

/**
 * Terminal pair utilities
 */
export const formatTerminalPairKey = (
  departing: string,
  arriving: string
): string => `${departing}->${arriving}`;

export const parseTerminalPairKey = (key: string): [string, string] => {
  const parts = key.split("->");
  if (parts.length !== 2) {
    throw new Error(`Invalid terminal pair key format: ${key}`);
  }
  return [parts[0], parts[1]];
};

/**
 * Backward compatibility exports for old constant names
 */
export const MIN_DURATION_THRESHOLDS = {
  AT_SEA: DURATION_THRESHOLDS.AT_SEA.MIN,
  AT_DOCK: DURATION_THRESHOLDS.AT_DOCK.MIN,
};
export const MAX_DURATION_THRESHOLDS = {
  AT_DOCK: DURATION_THRESHOLDS.AT_DOCK.MAX,
  AT_SEA: DURATION_THRESHOLDS.AT_SEA.MAX,
  ARRIVE_ARRIVE_TOTAL: DURATION_THRESHOLDS.ARRIVE_ARRIVE_TOTAL.MAX,
};
