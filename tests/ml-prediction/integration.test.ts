// ============================================================================
// INTEGRATION TESTS: Full Prediction Flow
// Testing end-to-end prediction functionality
// ============================================================================

// @ts-expect-error - vitest will be installed as dev dependency
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  predictEta,
  predictLeftDock,
  updateEtaOnDeparture,
} from "../../convex/domain/ml/prediction/predictors";
import { calculateInitialPredictions } from "../../convex/domain/ml/prediction/step_4_calculateInitialPredictions";
import type { ConvexVesselLocation } from "../../convex/functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "../../convex/functions/vesselTrips/schemas";

// Mocks will be set up in beforeEach
let mockCtx: any;

// Mock prediction pipeline components
vi.mock("../../convex/domain/ml/prediction/step_2_loadModel", () => ({
  loadModel: vi.fn(),
}));

vi.mock("../../convex/domain/ml/prediction/step_1_extractFeatures", () => ({
  extractArriveDepartFeatures: vi.fn(),
  extractDepartArriveFeatures: vi.fn(),
}));

vi.mock("../../convex/domain/ml/prediction/step_3_makePrediction", () => ({
  applyLinearRegression: vi.fn(),
  delayToLeftDockPred: vi.fn(),
  combinedDurationToEtaPred: vi.fn(),
  atSeaDurationToEtaPred: vi.fn(),
  roundMae: vi.fn(),
  validatePredictionTime: vi.fn(),
}));

import {
  extractArriveDepartFeatures,
  extractDepartArriveFeatures,
} from "../../convex/domain/ml/prediction/step_1_extractFeatures";
import { loadModel } from "../../convex/domain/ml/prediction/step_2_loadModel";
import {
  applyLinearRegression,
  atSeaDurationToEtaPred,
  combinedDurationToEtaPred,
  delayToLeftDockPred,
  roundMae,
  validatePredictionTime,
} from "../../convex/domain/ml/prediction/step_3_makePrediction";

// Helper functions
const createMockTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "P52",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalAbbrev: "BBI",
  TripStart: 1000000,
  AtDock: true,
  AtDockDuration: 15,
  ScheduledDeparture: 1005000,
  LeftDock: 1010000,
  Delay: 5,
  Eta: 1200000,
  TripEnd: undefined,
  AtSeaDuration: 35,
  TotalDuration: 50,
  InService: true,
  TimeStamp: 1000000,
  LeftDockPred: undefined,
  LeftDockPredMae: undefined,
  EtaPred: undefined,
  EtaPredMae: undefined,
  ...overrides,
});

const createMockModel = () => ({
  coefficients: [0.5, 0.3, 0.2],
  intercept: 10,
  trainingMetrics: { mae: 2.5, rmse: 3.0, r2: 0.85 },
  departingTerminalAbbrev: "P52",
  arrivingTerminalAbbrev: "BBI",
  modelType: "arrive-depart",
  createdAt: 1000000,
  bucketStats: {
    totalRecords: 100,
    filteredRecords: 90,
  },
});

const createMockLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 1001,
  VesselName: "P52",
  VesselAbbrev: "P52",
  DepartingTerminalID: 1001,
  DepartingTerminalName: "Port Townsend",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalID: 2001,
  ArrivingTerminalName: "Bainbridge",
  ArrivingTerminalAbbrev: "BBI",
  Latitude: 48.0,
  Longitude: -122.5,
  Speed: 15.5,
  Heading: 180.0,
  AtDock: false,
  ScheduledDeparture: 1005000,
  LeftDock: 1015000,
  Eta: 1200000,
  InService: true,
  TimeStamp: 1015000,
  ...overrides,
});

describe("Integration: Initial Predictions Flow", () => {
  beforeEach(() => {
    mockCtx = {} as any;
    vi.clearAllMocks();
    // Default mock implementations
    vi.mocked(loadModel).mockResolvedValue(createMockModel());
    vi.mocked(extractArriveDepartFeatures).mockReturnValue({
      time_center_0: 1,
      time_center_1: 0,
      time_center_2: 0,
      time_center_3: 0,
      time_center_4: 0,
      time_center_5: 0,
      time_center_6: 0,
      time_center_7: 0,
      isWeekend: 0,
      prevDelay: 5,
      prevAtSeaDuration: 35,
      arriveBeforeMinutes: 120,
    });
    vi.mocked(extractDepartArriveFeatures).mockReturnValue({
      time_center_0: 1,
      time_center_1: 0,
      time_center_2: 0,
      time_center_3: 0,
      time_center_4: 0,
      time_center_5: 0,
      time_center_6: 0,
      time_center_7: 0,
      isWeekend: 0,
      atDockDuration: 15,
      delay: 5,
    });
    vi.mocked(applyLinearRegression).mockReturnValue(15.5);
    vi.mocked(delayToLeftDockPred).mockReturnValue(1105000);
    vi.mocked(combinedDurationToEtaPred).mockReturnValue(1130000);
    vi.mocked(atSeaDurationToEtaPred).mockReturnValue(1130000);
    vi.mocked(roundMae).mockReturnValue(2.5);
    vi.mocked(validatePredictionTime).mockImplementation(
      (time: unknown) => time as number
    );
  });

  test("should complete full LeftDock prediction flow", async () => {
    const completedTrip = createMockTrip({
      TripEnd: 1100000,
      Delay: 5,
      AtSeaDuration: 35,
    });
    const newTrip = createMockTrip({
      TripStart: 1100000,
      ScheduledDeparture: 1105000,
    });

    const result = await calculateInitialPredictions(
      mockCtx,
      completedTrip,
      newTrip
    );

    // Verify full flow
    expect(loadModel).toHaveBeenCalledWith(
      mockCtx,
      "P52",
      "BBI",
      "arrive-depart-delay"
    );
    expect(extractArriveDepartFeatures).toHaveBeenCalled();
    expect(applyLinearRegression).toHaveBeenCalled();
    expect(delayToLeftDockPred).toHaveBeenCalled();
    expect(roundMae).toHaveBeenCalledWith(2.5);
    expect(validatePredictionTime).toHaveBeenCalled();

    expect(result.LeftDockPred).toBe(1105000);
    expect(result.LeftDockPredMae).toBe(2.5);
  });

  test("should complete full ETA prediction flow", async () => {
    const completedTrip = createMockTrip({
      TripEnd: 1100000,
      Delay: 5,
      AtSeaDuration: 35,
    });
    const newTrip = createMockTrip({
      TripStart: 1100000,
      ScheduledDeparture: 1105000,
    });

    const result = await calculateInitialPredictions(
      mockCtx,
      completedTrip,
      newTrip
    );

    // Verify full flow
    expect(loadModel).toHaveBeenCalledWith(
      mockCtx,
      "P52",
      "BBI",
      "arrive-arrive"
    );
    expect(extractArriveDepartFeatures).toHaveBeenCalled();
    expect(applyLinearRegression).toHaveBeenCalled();
    expect(combinedDurationToEtaPred).toHaveBeenCalled();
    expect(roundMae).toHaveBeenCalledWith(2.5);
    expect(validatePredictionTime).toHaveBeenCalled();

    expect(result.EtaPred).toBe(1130000);
    expect(result.EtaPredMae).toBe(2.5);
  });

  test("should handle missing model gracefully", async () => {
    const completedTrip = createMockTrip({
      TripEnd: 1100000,
      Delay: 5,
      AtSeaDuration: 35,
    });
    const newTrip = createMockTrip({
      TripStart: 1100000,
      ScheduledDeparture: 1105000,
    });

    vi.mocked(loadModel).mockResolvedValue(null);

    const result = await calculateInitialPredictions(
      mockCtx,
      completedTrip,
      newTrip
    );

    // Should skip prediction when model not found
    expect(result.LeftDockPred).toBeUndefined();
    expect(result.LeftDockPredMae).toBeUndefined();
    expect(result.EtaPred).toBeUndefined();
    expect(result.EtaPredMae).toBeUndefined();
  });

  test("should validate and clamp invalid predictions", async () => {
    const completedTrip = createMockTrip({
      TripEnd: 1100000,
      Delay: 5,
      AtSeaDuration: 35,
    });
    const newTrip = createMockTrip({
      TripStart: 1100000,
      ScheduledDeparture: 1105000,
    });

    // Simulate invalid prediction (before trip start)
    const invalidPredictedTime = 1100050; // Only 50ms after start
    vi.mocked(delayToLeftDockPred).mockReturnValue(invalidPredictedTime);
    vi.mocked(validatePredictionTime).mockImplementation(
      (pred) => Math.max(pred, 1102000) // Clamp to +2 minutes
    );

    const result = await calculateInitialPredictions(
      mockCtx,
      completedTrip,
      newTrip
    );

    // Should be clamped to minimum valid time
    expect(validatePredictionTime).toHaveBeenCalled();
    expect(result.LeftDockPred).toBeGreaterThanOrEqual(1102000);
  });

  test("should run both predictions in parallel", async () => {
    const completedTrip = createMockTrip({
      TripEnd: 1100000,
      Delay: 5,
      AtSeaDuration: 35,
    });
    const newTrip = createMockTrip({
      TripStart: 1100000,
      ScheduledDeparture: 1105000,
    });

    const result = await calculateInitialPredictions(
      mockCtx,
      completedTrip,
      newTrip
    );

    // Both predictions should be calculated
    expect(result.LeftDockPred).toBeDefined();
    expect(result.EtaPred).toBeDefined();
    expect(result.LeftDockPredMae).toBeDefined();
    expect(result.EtaPredMae).toBeDefined();
  });
});

describe("Integration: ETA Update on Departure Flow", () => {
  beforeEach(() => {
    mockCtx = {} as any;
    vi.clearAllMocks();
    // Default mock implementations
    vi.mocked(loadModel).mockResolvedValue(createMockModel());
    vi.mocked(extractDepartArriveFeatures).mockReturnValue({
      time_center_0: 1,
      time_center_1: 0,
      time_center_2: 0,
      time_center_3: 0,
      time_center_4: 0,
      time_center_5: 0,
      time_center_6: 0,
      time_center_7: 0,
      isWeekend: 0,
      atDockDuration: 15,
      delay: 10,
    });
    vi.mocked(applyLinearRegression).mockReturnValue(35.5);
    vi.mocked(atSeaDurationToEtaPred).mockReturnValue(1130000);
    vi.mocked(roundMae).mockReturnValue(3.0);
    vi.mocked(validatePredictionTime).mockImplementation(
      (time: unknown) => time as number
    );
  });

  test("should complete full ETA update flow on departure", async () => {
    const currentTrip = createMockTrip();
    const currentLocation = createMockLocation();

    const result = await updateEtaOnDeparture(
      mockCtx,
      currentTrip,
      currentLocation
    );

    // Verify full flow
    expect(loadModel).toHaveBeenCalledWith(
      mockCtx,
      "P52",
      "BBI",
      "depart-arrive"
    );
    expect(extractDepartArriveFeatures).toHaveBeenCalled();
    expect(applyLinearRegression).toHaveBeenCalled();
    expect(atSeaDurationToEtaPred).toHaveBeenCalled();
    expect(roundMae).toHaveBeenCalledWith(3.0);
    expect(validatePredictionTime).toHaveBeenCalled();

    expect(result.predictedTime).toBe(1130000);
    expect(result.mae).toBe(3.0);
    expect(result.skipped).toBe(false);
  });

  test("should handle missing model gracefully", async () => {
    const currentTrip = createMockTrip();
    const currentLocation = createMockLocation();

    vi.mocked(loadModel).mockResolvedValue(null);

    const result = await updateEtaOnDeparture(
      mockCtx,
      currentTrip,
      currentLocation
    );

    // Should skip prediction when model not found
    expect(result.predictedTime).toBeUndefined();
    expect(result.mae).toBeUndefined();
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("Model not found");
  });

  test("should skip prediction with insufficient data", async () => {
    const currentTrip = createMockTrip({ LeftDock: undefined });
    const currentLocation = createMockLocation({ LeftDock: undefined });

    const result = await updateEtaOnDeparture(
      mockCtx,
      currentTrip,
      currentLocation
    );

    // Should skip when required data missing
    expect(result.predictedTime).toBeUndefined();
    expect(result.mae).toBeUndefined();
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("Insufficient context data");
  });
});
