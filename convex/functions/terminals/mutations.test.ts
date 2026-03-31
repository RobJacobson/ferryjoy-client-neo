/// <reference path="../../../src/bun-test.d.ts" />

import { describe, expect, it } from "bun:test";
import type { Doc } from "_generated/dataModel";
import type { Terminal } from "./schemas";
import { buildBackendTerminalUpsertOperations } from "./mutations";

describe("buildBackendTerminalUpsertOperations", () => {
  it("replaces an existing terminal when the abbreviation matches", () => {
    const result = buildBackendTerminalUpsertOperations(
      [makeStoredTerminal({ TerminalAbbrev: "ANA", TerminalID: 1 })],
      [makeIncomingTerminal({ TerminalAbbrev: "ANA", TerminalID: 2 })]
    );

    expect(result.toInsert).toHaveLength(0);
    expect(result.toReplace).toHaveLength(1);
    expect(result.toReplace[0]?.existing.TerminalID).toBe(1);
    expect(result.toReplace[0]?.incoming.TerminalID).toBe(2);
  });

  it("inserts a new terminal when the abbreviation is new", () => {
    const result = buildBackendTerminalUpsertOperations(
      [makeStoredTerminal({ TerminalAbbrev: "ANA" })],
      [makeIncomingTerminal({ TerminalAbbrev: "ORI" })]
    );

    expect(result.toInsert).toHaveLength(1);
    expect(result.toInsert[0]?.TerminalAbbrev).toBe("ORI");
    expect(result.toReplace).toHaveLength(0);
  });

  it("does not delete existing terminals missing from the latest snapshot", () => {
    const existing = [
      makeStoredTerminal({ TerminalAbbrev: "ANA" }),
      makeStoredTerminal({ TerminalAbbrev: "ORI" }),
    ];
    const result = buildBackendTerminalUpsertOperations(existing, [
      makeIncomingTerminal({ TerminalAbbrev: "ANA" }),
    ]);

    expect(result.toInsert).toHaveLength(0);
    expect(result.toReplace).toHaveLength(1);
    expect(existing).toHaveLength(2);
  });
});

const makeStoredTerminal = (
  overrides: Partial<Terminal> = {}
): Doc<"terminals"> =>
  ({
    _id: "terminals:test" as Doc<"terminals">["_id"],
    _creationTime: 0,
    TerminalID: 1,
    TerminalName: "Anacortes",
    TerminalAbbrev: "ANA",
    Latitude: 48.5071,
    Longitude: -122.6774,
    UpdatedAt: 1,
    ...overrides,
  }) as Doc<"terminals">;

const makeIncomingTerminal = (
  overrides: Partial<Terminal> = {}
): Terminal => ({
  TerminalID: 1,
  TerminalName: "Anacortes",
  TerminalAbbrev: "ANA",
  Latitude: 48.5071,
  Longitude: -122.6774,
  UpdatedAt: 1,
  ...overrides,
});
