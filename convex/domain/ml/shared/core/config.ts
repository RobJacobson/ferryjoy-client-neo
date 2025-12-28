// ============================================================================
// FUNCTIONAL CONFIGURATION SYSTEM
// Centralized configuration with functional lenses
// ============================================================================

/**
 * Functional configuration access patterns
 * Simplified lens-like getters for nested configuration
 */

/**
 * Centralized ML Configuration
 * All configuration constants in a single nested structure
 */
export const ML_CONFIG = {
  terminals: {
    valid: new Set([
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
    ]),
    mapping: {
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
    } as Record<string, string>,
    meanDockDuration: {
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
    } as Record<string, number>,
  },
  thresholds: {
    duration: {
      atSea: { min: 2.0, max: 90.0 },
      atDock: { min: 2.0, max: 30.0 },
      arriveArriveTotal: { max: 120.0 },
    },
  },
  pipeline: {
    dataLoading: {
      daysBack: 720,
      maxRecordsPerVessel: 5000,
      maxSamplesPerRoute: 2500,
      samplingStrategy: "recent_first",
    },
    training: {
      coefficientRoundingZeroThreshold: 1e-6,
    },
    evaluation: {
      enabled: true,
      trainRatio: 0.8,
      minTrainExamples: 200,
    },
  },
} as const;

/**
 * Functional Configuration Access
 * Lens-like getters for accessing nested configuration values
 */

/**
 * Functional getters for common configuration access patterns
 */
export const getConfig = {
  // Terminal utilities
  isValidTerminal: (terminal: string) =>
    ML_CONFIG.terminals.valid.has(terminal),

  getTerminalAbbrev: (terminalName: string) =>
    ML_CONFIG.terminals.mapping[terminalName] || terminalName,

  getMeanDockDuration: (terminalPair: string) =>
    ML_CONFIG.terminals.meanDockDuration[terminalPair] || 0,

  // Threshold getters
  getMinAtSeaDuration: () => ML_CONFIG.thresholds.duration.atSea.min,

  getMaxAtSeaDuration: () => ML_CONFIG.thresholds.duration.atSea.max,

  getMinAtDockDuration: () => ML_CONFIG.thresholds.duration.atDock.min,

  getMaxAtDockDuration: () => ML_CONFIG.thresholds.duration.atDock.max,

  getMaxTotalDuration: () =>
    ML_CONFIG.thresholds.duration.arriveArriveTotal.max,

  // Pipeline getters
  getDaysBack: () => ML_CONFIG.pipeline.dataLoading.daysBack,

  getMaxRecordsPerVessel: () =>
    ML_CONFIG.pipeline.dataLoading.maxRecordsPerVessel,

  getMaxSamplesPerRoute: () =>
    ML_CONFIG.pipeline.dataLoading.maxSamplesPerRoute,

  getSamplingStrategy: () => ML_CONFIG.pipeline.dataLoading.samplingStrategy,

  getCoefficientRoundingThreshold: () =>
    ML_CONFIG.pipeline.training.coefficientRoundingZeroThreshold,

  isEvaluationEnabled: () => ML_CONFIG.pipeline.evaluation.enabled,

  getTrainRatio: () => ML_CONFIG.pipeline.evaluation.trainRatio,

  getMinTrainExamples: () => ML_CONFIG.pipeline.evaluation.minTrainExamples,
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
export const VALID_PASSENGER_TERMINALS = ML_CONFIG.terminals.valid;
export const TERMINAL_NAME_MAPPING = ML_CONFIG.terminals.mapping;
export const MEAN_AT_DOCK_DURATION = ML_CONFIG.terminals.meanDockDuration;
export const DURATION_THRESHOLDS = ML_CONFIG.thresholds.duration;
export const PIPELINE_CONFIG = {
  DAYS_BACK: ML_CONFIG.pipeline.dataLoading.daysBack,
  MAX_RECORDS_PER_VESSEL: ML_CONFIG.pipeline.dataLoading.maxRecordsPerVessel,
  MAX_SAMPLES_PER_ROUTE: ML_CONFIG.pipeline.dataLoading.maxSamplesPerRoute,
  SAMPLING_STRATEGY: ML_CONFIG.pipeline.dataLoading.samplingStrategy,
  COEFFICIENT_ROUNDING_ZERO_THRESHOLD:
    ML_CONFIG.pipeline.training.coefficientRoundingZeroThreshold,
  EVALUATION: ML_CONFIG.pipeline.evaluation,
} as const;

export const MIN_DURATION_THRESHOLDS = {
  AT_SEA: DURATION_THRESHOLDS.atSea.min,
  AT_DOCK: DURATION_THRESHOLDS.atDock.min,
};
export const MAX_DURATION_THRESHOLDS = {
  AT_DOCK: DURATION_THRESHOLDS.atDock.max,
  AT_SEA: DURATION_THRESHOLDS.atSea.max,
  ARRIVE_ARRIVE_TOTAL: DURATION_THRESHOLDS.arriveArriveTotal.max,
};
