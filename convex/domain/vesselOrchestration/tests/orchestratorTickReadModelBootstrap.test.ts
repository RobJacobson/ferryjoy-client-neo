/**
 * Tests for orchestrator identity bootstrap policy helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  assertOrchestratorIdentityReady,
  ORCHESTRATOR_TERMINALS_IDENTITY_STILL_EMPTY,
  ORCHESTRATOR_VESSELS_IDENTITY_STILL_EMPTY,
  terminalsIdentityNeedsBootstrap,
  vesselsIdentityNeedsBootstrap,
} from "domain/vesselOrchestration/orchestratorTickReadModelBootstrap";

describe("orchestratorTickReadModelBootstrap", () => {
  it("detects empty vessels", () => {
    expect(
      vesselsIdentityNeedsBootstrap({ vessels: [], terminals: [{}] })
    ).toBe(true);
    expect(
      vesselsIdentityNeedsBootstrap({ vessels: [{ id: 1 }], terminals: [] })
    ).toBe(false);
  });

  it("detects empty terminals", () => {
    expect(
      terminalsIdentityNeedsBootstrap({ vessels: [{}], terminals: [] })
    ).toBe(true);
    expect(
      terminalsIdentityNeedsBootstrap({ vessels: [], terminals: [{ id: 1 }] })
    ).toBe(false);
  });

  it("assertOrchestratorIdentityReady throws with stable messages", () => {
    expect(() =>
      assertOrchestratorIdentityReady({ vessels: [], terminals: [{}] })
    ).toThrow(ORCHESTRATOR_VESSELS_IDENTITY_STILL_EMPTY);

    expect(() =>
      assertOrchestratorIdentityReady({ vessels: [{}], terminals: [] })
    ).toThrow(ORCHESTRATOR_TERMINALS_IDENTITY_STILL_EMPTY);

    expect(() =>
      assertOrchestratorIdentityReady({ vessels: [{}], terminals: [{}] })
    ).not.toThrow();
  });
});
