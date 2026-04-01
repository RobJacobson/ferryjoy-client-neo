import { describe, expect, it } from "bun:test";
import {
  applyLayeredDatasetUpdate,
  applyStorageHydrationResult,
  createInitialLayeredDatasetState,
} from "./useLayeredDataset";

describe("useLayeredDataset helpers", () => {
  it("starts with the compiled asset data immediately", () => {
    expect(createInitialLayeredDatasetState(["asset-row"])).toEqual({
      data: ["asset-row"],
      source: "asset",
      isHydrated: false,
    });
  });

  it("promotes valid storage data over assets during hydration", () => {
    const initial = createInitialLayeredDatasetState(["asset-row"]);

    expect(
      applyStorageHydrationResult(initial, {
        ok: true,
        value: ["storage-row"],
      })
    ).toEqual({
      data: ["storage-row"],
      source: "storage",
      isHydrated: true,
    });
  });

  it("promotes Convex data over storage data", () => {
    const hydrated = applyStorageHydrationResult(
      createInitialLayeredDatasetState(["asset-row"]),
      {
        ok: true,
        value: ["storage-row"],
      }
    );

    expect(
      applyLayeredDatasetUpdate(hydrated, {
        data: ["convex-row"],
        source: "convex",
      })
    ).toEqual({
      data: ["convex-row"],
      source: "convex",
      isHydrated: true,
    });
  });

  it("does not let late storage hydration overwrite Convex", () => {
    const convexState = applyLayeredDatasetUpdate(
      createInitialLayeredDatasetState(["asset-row"]),
      {
        data: ["convex-row"],
        source: "convex",
      }
    );

    expect(
      applyStorageHydrationResult(convexState, {
        ok: true,
        value: ["storage-row"],
      })
    ).toEqual({
      data: ["convex-row"],
      source: "convex",
      isHydrated: true,
    });
  });

  it("treats empty Convex arrays as authoritative", () => {
    const hydrated = applyStorageHydrationResult(
      createInitialLayeredDatasetState(["asset-row"]),
      {
        ok: true,
        value: ["storage-row"],
      }
    );

    expect(
      applyLayeredDatasetUpdate(hydrated, {
        data: [],
        source: "convex",
      })
    ).toEqual({
      data: [],
      source: "convex",
      isHydrated: true,
    });
  });

  it("keeps the current dataset when storage hydration fails", () => {
    const initial = createInitialLayeredDatasetState(["asset-row"]);

    expect(
      applyStorageHydrationResult(initial, {
        ok: false,
        value: null,
        error: new Error("invalid blob"),
      })
    ).toEqual({
      data: ["asset-row"],
      source: "asset",
      isHydrated: true,
    });
  });
});
