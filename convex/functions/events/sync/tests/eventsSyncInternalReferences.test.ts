/**
 * Guards codegen wiring for cron and internal mutation references used by reload actions.
 */

import { describe, expect, it } from "bun:test";
import { internal } from "_generated/api";

describe("events sync internal references", () => {
  it("exposes reloadDockEventsAtSailingDayBoundary for scheduled crons", () => {
    expect(
      internal.functions.events.sync.index.reloadDockEventsAtSailingDayBoundary
    ).toBeDefined();
  });

  it("exposes reloadDockEventsWindow for windowed internal reloads", () => {
    expect(
      internal.functions.events.sync.actions.reloadDockEventsWindow
    ).toBeDefined();
  });

  it("exposes replaceDockEventsForSailingDay for mutation delegation", () => {
    expect(
      internal.functions.events.sync.mutations.replaceDockEventsForSailingDay
    ).toBeDefined();
  });

  it("exposes split scheduled and actual reload mutations", () => {
    expect(
      internal.functions.events.sync.mutations
        .replaceScheduledDockEventsForSailingDay
    ).toBeDefined();
    expect(
      internal.functions.events.sync.mutations
        .reloadActualDockEventsForSailingDay
    ).toBeDefined();
  });
});
