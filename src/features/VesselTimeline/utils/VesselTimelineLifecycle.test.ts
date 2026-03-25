import { describe, expect, it } from "bun:test";
import { getVesselTimelineDataHostKey } from "./hostKey";
import {
  getCurrentSailingDay,
  getRefreshedSailingDay,
} from "./refreshSailingDay";

describe("getVesselTimelineDataHostKey", () => {
  it("changes when the retry nonce changes", () => {
    expect(getVesselTimelineDataHostKey("CAT", "2026-03-24", 0)).not.toBe(
      getVesselTimelineDataHostKey("CAT", "2026-03-24", 1)
    );
  });

  it("changes when the vessel changes", () => {
    expect(getVesselTimelineDataHostKey("CAT", "2026-03-24", 0)).not.toBe(
      getVesselTimelineDataHostKey("WEN", "2026-03-24", 0)
    );
  });

  it("changes when the sailing day changes", () => {
    expect(getVesselTimelineDataHostKey("CAT", "2026-03-24", 0)).not.toBe(
      getVesselTimelineDataHostKey("CAT", "2026-03-25", 0)
    );
  });
});

describe("getRefreshedSailingDay", () => {
  it("keeps the current sailing day before the 3:00 AM Pacific rollover", () => {
    expect(
      getRefreshedSailingDay("2026-03-24", new Date("2026-03-25T09:59:00.000Z"))
    ).toBe("2026-03-24");
  });

  it("rolls forward at 3:00 AM Pacific", () => {
    expect(
      getRefreshedSailingDay("2026-03-24", new Date("2026-03-25T10:00:00.000Z"))
    ).toBe("2026-03-25");
  });

  it("returns the same value as getCurrentSailingDay after rollover", () => {
    const now = new Date("2026-03-25T10:15:00.000Z");
    const next = getCurrentSailingDay(now);

    expect(getRefreshedSailingDay("2026-03-24", now)).toBe(next);
  });
});
