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
export const config = {
  // Terminal utilities
  isValidTerminal: (terminal: string) =>
    ML_CONFIG.terminals.valid.has(terminal),

  getTerminalAbbrev: (terminalName: string) =>
    ML_CONFIG.terminals.mapping[terminalName],

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
 * Feature key definitions for explicit ordering
 * Guarantees consistent ordering between training and prediction
 * to prevent silent errors where coefficients are applied to wrong features
 *
 * CRITICAL: Any changes to feature order require model retraining
 */
export const FEATURE_DEFINITIONS = {
  // Time features (always present, ordered 0-7)
  TIME_FEATURES: [
    "time_center_0",
    "time_center_1",
    "time_center_2",
    "time_center_3",
    "time_center_4",
    "time_center_5",
    "time_center_6",
    "time_center_7",
  ] as const,

  // Base features (present in all models)
  BASE_FEATURES: [
    "isWeekend",
    "prevDelay",
    "prevAtSeaDuration",
    "arriveBeforeMinutes",
  ] as const,

  // Departure-specific features (only in depart- models)
  DEPART_FEATURES: ["atDockDuration", "tripDelay"] as const,

  // Complete feature sets by model type
  ARRIVE_MODEL_FEATURES: [
    "time_center_0",
    "time_center_1",
    "time_center_2",
    "time_center_3",
    "time_center_4",
    "time_center_5",
    "time_center_6",
    "time_center_7",
    "isWeekend",
    "prevDelay",
    "prevAtSeaDuration",
    "arriveBeforeMinutes",
  ] as const,

  DEPART_MODEL_FEATURES: [
    "time_center_0",
    "time_center_1",
    "time_center_2",
    "time_center_3",
    "time_center_4",
    "time_center_5",
    "time_center_6",
    "time_center_7",
    "isWeekend",
    "prevDelay",
    "prevAtSeaDuration",
    "arriveBeforeMinutes",
    "atDockDuration",
    "tripDelay",
  ] as const,
} as const;
