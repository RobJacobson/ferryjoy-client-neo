// ============================================================================
// UNIT TESTS: Initial Predictions Orchestrator
// Testing step_4_calculateInitialPredictions.ts functions
// ============================================================================

// @ts-expect-error - vitest will be installed as dev dependency
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { InitialPredictions } from "../../convex/domain/ml/prediction/step_4_calculateInitialPredictions";
import { calculateInitialPredictions } from "../../convex/domain/ml/prediction/step_4_calculateInitialPredictions";
import type { ConvexVesselTrip } from "../../convex/functions/vesselTrips/schemas";

// Mock the predictors
vi.mock("../../convex/domain/ml/prediction/predictors", () => ({
  predictLeftDock: vi.fn(),
  predictEta: vi.fn(),
}));

import {
  predictEta,
  predictLeftDock,
} from "../../convex/domain/ml/prediction/predictors";

describe("calculateInitialPredictions", () => {
  const mockCtx = {} as any;

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

    const leftDockResult = {
      predictedTime: 1110000,
      mae: 2.5,
      skipped: false,
    };
    const etaResult = {
      predictedTime: 1130000,
      mae: 3.0,
      skipped: false,
    };

    vi.mocked(predictLeftDock).mockResolvedValue(leftDockResult);
    vi.mocked(predictEta).mockResolvedValue(etaResult);

    const result = await calculateInitialPredictions(
      mockCtx,
      completedTrip,
      newTrip
    );

    expect(predictLeftDock).toHaveBeenCalledTimes(1);
    expect(predictEta).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      LeftDockPred: leftDockResult.predictedTime,
      LeftDockPredMae: leftDockResult.mae,
      EtaPred: etaResult.predictedTime,
      EtaPredMae: etaResult.mae,
    });
  });

  test("should handle skipped predictions", async () => {
    const completedTrip = createMockTrip({
      TripEnd: 1100000,
      Delay: 5,
      AtSeaDuration: 35,
    });
    const newTrip = createMockTrip({
      TripStart: 1100000,
      ScheduledDeparture: 1105000,
    });

    const leftDockResult = {
      predictedTime: undefined,
      mae: undefined,
      skipped: true,
      skipReason: "Insufficient data",
    };
    const etaResult = {
      predictedTime: 1130000,
      mae: 3.0,
      skipped: false,
    };

    vi.mocked(predictLeftDock).mockResolvedValue(leftDockResult);
    vi.mocked(predictEta).mockResolvedValue(etaResult);

    const result = await calculateInitialPredictions(
      mockCtx,
      completedTrip,
      newTrip
    );

    expect(result).toEqual({
      LeftDockPred: undefined,
      LeftDockPredMae: undefined,
      EtaPred: etaResult.predictedTime,
      EtaPredMae: etaResult.mae,
    });
  });

  test("should handle all predictions skipped", async () => {
    const completedTrip = createMockTrip({
      TripEnd: 1100000,
    });
    const newTrip = createMockTrip({
      TripStart: 1100000,
    });

    const leftDockResult = {
      predictedTime: undefined,
      mae: undefined,
      skipped: true,
      skipReason: "Model not found",
    };
    const etaResult = {
      predictedTime: undefined,
      mae: undefined,
      skipped: true,
      skipReason: "Model not found",
    };

    vi.mocked(predictLeftDock).mockResolvedValue(leftDockResult);
    vi.mocked(predictEta).mockResolvedValue(etaResult);

    const result = await calculateInitialPredictions(
      mockCtx,
      completedTrip,
      newTrip
    );

    expect(result).toEqual({
      LeftDockPred: undefined,
      LeftDockPredMae: undefined,
      EtaPred: undefined,
      EtaPredMae: undefined,
    });
  });

  test("should handle prediction errors gracefully", async () => {
    const completedTrip = createMockTrip({
      TripEnd: 1100000,
      Delay: 5,
      AtSeaDuration: 35,
    });
    const newTrip = createMockTrip({
      TripStart: 1100000,
      ScheduledDeparture: 1105000,
    });

    const error = new Error("Prediction failed");
    vi.mocked(predictLeftDock).mockRejectedValue(error);
    vi.mocked(predictEta).mockResolvedValue({
      predictedTime: 1130000,
      mae: 3.0,
      skipped: false,
    });

    await expect(
      calculateInitialPredictions(mockCtx, completedTrip, newTrip)
    ).rejects.toThrow("Prediction failed");
  });

  test("should return InitialPredictions type", async () => {
    const completedTrip = createMockTrip({
      TripEnd: 1100000,
      Delay: 5,
      AtSeaDuration: 35,
    });
    const newTrip = createMockTrip({
      TripStart: 1100000,
      ScheduledDeparture: 1105000,
    });

    vi.mocked(predictLeftDock).mockResolvedValue({
      predictedTime: 1110000,
      mae: 2.5,
      skipped: false,
    });
    vi.mocked(predictEta).mockResolvedValue({
      predictedTime: 1130000,
      mae: 3.0,
      skipped: false,
    });

    const result = await calculateInitialPredictions(
      mockCtx,
      completedTrip,
      newTrip
    );

    // Verify return type structure
    expect(result).toHaveProperty("LeftDockPred");
    expect(result).toHaveProperty("LeftDockPredMae");
    expect(result).toHaveProperty("EtaPred");
    expect(result).toHaveProperty("EtaPredMae");

    // Type guard check
    const typedResult: InitialPredictions = result;
    expect(typedResult).toBeDefined();
  });
});
