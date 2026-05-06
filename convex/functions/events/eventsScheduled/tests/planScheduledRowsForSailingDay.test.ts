import { describe, expect, it } from "bun:test";
import type { Doc, Id } from "_generated/dataModel";
import { planScheduledRowsForSailingDay } from "../planScheduledRowsForSailingDay";
import type { ConvexScheduledDockEvent } from "../schemas";

const baseRow = (
  overrides: Partial<ConvexScheduledDockEvent> = {}
): ConvexScheduledDockEvent => ({
  Key: "WEN--2026-03-25--08:00--P52-BBI--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: 1,
  ScheduledDeparture: 1000,
  TerminalAbbrev: "P52",
  NextTerminalAbbrev: "BBI",
  EventType: "dep-dock",
  EventScheduledTime: 1000,
  IsLastArrivalOfSailingDay: false,
  ...overrides,
});

const storedRow = (
  overrides: Partial<ConvexScheduledDockEvent> & {
    _id?: Id<"eventsScheduled">;
  } = {}
): Doc<"eventsScheduled"> =>
  ({
    _id: overrides._id ?? ("scheduled-1" as Id<"eventsScheduled">),
    _creationTime: 1,
    ...baseRow(overrides),
  }) as Doc<"eventsScheduled">;

describe("planScheduledRowsForSailingDay", () => {
  it("plans deletes, inserts, and replacements while skipping unchanged rows", () => {
    const unchanged = storedRow({
      _id: "scheduled-unchanged" as Id<"eventsScheduled">,
      Key: "unchanged",
    });
    const stale = storedRow({
      _id: "scheduled-stale" as Id<"eventsScheduled">,
      Key: "stale",
    });
    const changed = storedRow({
      _id: "scheduled-changed" as Id<"eventsScheduled">,
      Key: "changed",
      EventScheduledTime: 1000,
    });
    const inserted = baseRow({ Key: "inserted" });

    const plan = planScheduledRowsForSailingDay(
      [unchanged, stale, changed],
      [
        baseRow({ Key: "unchanged" }),
        baseRow({ Key: "changed", EventScheduledTime: 1100 }),
        inserted,
      ]
    );

    expect(plan.deletes).toEqual(["scheduled-stale" as Id<"eventsScheduled">]);
    expect(plan.inserts).toEqual([inserted]);
    expect(plan.replacements).toEqual([
      {
        existingId: "scheduled-changed" as Id<"eventsScheduled">,
        row: baseRow({ Key: "changed", EventScheduledTime: 1100 }),
      },
    ]);
  });
});
