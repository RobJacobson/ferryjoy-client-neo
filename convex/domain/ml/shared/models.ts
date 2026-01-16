// ============================================================================
// ML - MODEL DEFINITIONS
// Ferry schedule prediction models with comprehensive documentation
// ============================================================================

/**
 * ## ML Model Architecture Overview
 *
 * The prediction system uses 5 specialized linear regression models to forecast
 * ferry departure and arrival times. Models are organized by two dimensions:
 *
 * ### 1. Prediction Timing
 * - **At-dock**: Predictions made when vessel is at terminal (know arrival time)
 * - **At-sea**: Predictions made after vessel departs (know departure time)
 *
 * ### 3. Prediction Target
 * - **Depart-curr**: Delay before departing current terminal
 * - **Arrive-next**: Time to arrival at next terminal
 * - **Depart-next**: Delay before departing next terminal
 *
 * ## Model Naming Convention
 * `{timing}-{target}` (e.g., "at-dock-depart-curr")
 *
 * ## Feature Sets by Timing
 * - **At-dock**: Full feature set including arrival context and schedule information
 * - **At-sea**: At-dock features plus actual departure time and at-sea observations
 */

import type { ModelDefinition, ModelType } from "./types";

export const models: Record<ModelType, ModelDefinition> = {
  // ========================================================================
  // PREDICTION MODELS
  // Models for ferry schedule predictions
  // ========================================================================

  /**
   * ## At-Dock Departure Prediction
   *
   * **Use Case**: Predict delay before vessel departs current terminal
   * **Available Information**: Vessel has arrived, schedule is known
   * **Target**: Minutes of delay from scheduled departure time
   * **Business Value**: Helps passengers and terminal operators anticipate delays
   *
   * **Features Used**: Full at-dock feature set including:
   * - Time of day patterns
   * - Arrival schedule deviations
   * - Slack time and schedule pressure
   * - Previous trip performance
   */
  "at-dock-depart-curr": {
    key: "at-dock-depart-curr",
    description:
      "Predict departure delay from current terminal in in-service operations",
    extractFeatures: (r) => r.features.atDock,
    calculateTarget: (r) => r.targets.departCurrMinutes,
  },

  /**
   * ## At-Dock Arrival Prediction
   *
   * **Use Case**: Estimate arrival time at next terminal before departure
   * **Available Information**: Pre-departure planning and historical patterns
   * **Target**: Minutes from current scheduled departure to next arrival
   * **Business Value**: Enables "will I make my connection?" predictions
   *
   * **Features Used**: At-dock features focusing on route characteristics
   * and historical performance rather than real-time conditions
   */
  "at-dock-arrive-next": {
    key: "at-dock-arrive-next",
    description:
      "Predict arrival time at next terminal from current scheduled departure",
    extractFeatures: (r) => r.features.atDock,
    calculateTarget: (r) => r.targets.arriveNextFromCurrScheduledMinutes,
  },

  /**
   * ## At-Sea Arrival Prediction
   *
   * **Use Case**: Update arrival estimates after vessel departs
   * **Available Information**: Actual departure time, real-time conditions
   * **Target**: Minutes from actual departure to arrival at next terminal
   * **Business Value**: Provides accurate real-time ETA updates
   *
   * **Features Used**: Enhanced at-sea feature set including actual departure
   * time and any observed conditions during transit
   */
  "at-sea-arrive-next": {
    key: "at-sea-arrive-next",
    description:
      "Predict remaining transit time to next terminal after departure",
    extractFeatures: (r) => r.features.atSea,
    calculateTarget: (r) => r.targets.arriveNextFromCurrActualMinutes,
  },

  /**
   * ## At-Dock Next Departure Prediction
   *
   * **Use Case**: Predict turnaround time at next terminal
   * **Available Information**: Multi-leg journey planning
   * **Target**: Delay at next terminal from its scheduled departure
   * **Business Value**: Critical for multi-leg journey planning
   *
   * **Features Used**: At-dock features with focus on terminal-specific
   * turnaround patterns and schedule pressure
   */
  "at-dock-depart-next": {
    key: "at-dock-depart-next",
    description:
      "Predict departure delay at next terminal in connected journey",
    extractFeatures: (r) => r.features.atDock,
    calculateTarget: (r) => r.targets.departNextFromNextScheduledMinutes,
  },

  /**
   * ## At-Sea Next Departure Prediction
   *
   * **Use Case**: Update next terminal departure predictions mid-transit
   * **Available Information**: Current transit progress and conditions
   * **Target**: Delay at next terminal (same as at-dock version)
   * **Business Value**: Refines multi-leg predictions with real-time data
   *
   * **Features Used**: At-sea features providing updated context
   * during transit to next terminal
   */
  "at-sea-depart-next": {
    key: "at-sea-depart-next",
    description:
      "Predict departure delay at next terminal using transit observations",
    extractFeatures: (r) => r.features.atSea,
    calculateTarget: (r) => r.targets.departNextFromNextScheduledMinutes,
  },
};

// Note: MODEL_KEYS is exported from ./types.ts as the canonical ordered list.
