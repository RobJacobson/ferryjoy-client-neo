/** biome-ignore-all lint/style/noNonNullAssertion: For test */
import { describe, expect, it } from "bun:test";
import type { SelectedTerminalPair } from "@/data/contexts/SelectedTerminalPairContext";
import {
  selectTerminalCards,
  selectTotalCarouselItems,
} from "@/features/RoutesCarousel/model/terminalCards";
import { toTerminalWithMates } from "../../../terminalLocations";
import {
  selectRouteAbbrevsForSelection,
} from "../../../terminalRouteMapping";
import {
  deriveTerminalsData,
  deriveTerminalsTopologyData,
  deriveVesselsData,
  type TerminalsSnapshot,
  type TerminalsTopologySnapshot,
  type VesselsSnapshot,
} from "../datasets";

const vessels: VesselsSnapshot = [
  {
    VesselID: 1,
    VesselName: "Tacoma",
    VesselAbbrev: "TKM",
  },
  {
    VesselID: 2,
    VesselName: "Puyallup",
    VesselAbbrev: "PUP",
  },
];

const terminals: TerminalsSnapshot = [
  {
    TerminalID: 10,
    TerminalName: "Seattle",
    TerminalAbbrev: "P52",
    Latitude: 47.602501,
    Longitude: -122.340472,
  },
  {
    TerminalID: 11,
    TerminalName: "Bainbridge Island",
    TerminalAbbrev: "BBI",
    Latitude: 47.622339,
    Longitude: -122.509617,
  },
  {
    TerminalID: 12,
    TerminalName: "Fauntleroy",
    TerminalAbbrev: "FAU",
    Latitude: 47.5232,
    Longitude: -122.3967,
  },
  {
    TerminalID: 13,
    TerminalName: "Vashon Island",
    TerminalAbbrev: "VAI",
    Latitude: 47.466,
    Longitude: -122.459,
  },
  {
    TerminalID: 19,
    TerminalName: "Sidney B.C.",
    TerminalAbbrev: "SID",
    Latitude: 48.643114,
    Longitude: -123.396739,
  },
];

const topology: TerminalsTopologySnapshot = [
  {
    TerminalAbbrev: "P52",
    TerminalMates: ["BBI"],
    RouteAbbrevs: ["sea-bi"],
    RouteAbbrevsByArrivingTerminal: {
      BBI: ["sea-bi"],
    },
  },
  {
    TerminalAbbrev: "BBI",
    TerminalMates: ["P52"],
    RouteAbbrevs: ["sea-bi"],
    RouteAbbrevsByArrivingTerminal: {
      P52: ["sea-bi"],
    },
  },
  {
    TerminalAbbrev: "FAU",
    TerminalMates: ["VAI"],
    RouteAbbrevs: ["f-v-s"],
    RouteAbbrevsByArrivingTerminal: {
      VAI: ["f-v-s"],
    },
  },
  {
    TerminalAbbrev: "VAI",
    TerminalMates: ["FAU"],
    RouteAbbrevs: ["f-v-s"],
    RouteAbbrevsByArrivingTerminal: {
      FAU: ["f-v-s"],
    },
  },
];

const vesselsData = {
  data: vessels,
  source: "asset" as const,
  isHydrated: true,
  ...deriveVesselsData(vessels),
};

const terminalsData = {
  data: terminals,
  source: "asset" as const,
  isHydrated: true,
  ...deriveTerminalsData(terminals),
};

const topologyData = {
  data: topology,
  source: "asset" as const,
  isHydrated: true,
  ...deriveTerminalsTopologyData(topology),
};

describe("identity-backed selectors", () => {
  it("builds vessel lookup maps by abbrev and id", () => {
    expect(vesselsData.vesselsByAbbrev.TKM?.VesselName).toBe("Tacoma");
    expect(vesselsData.vesselsById["2"]?.VesselName).toBe("Puyallup");
  });

  it("joins terminal identity rows with terminal mates from topology", () => {
    expect(terminalsData.terminalsByAbbrev.P52?.TerminalName).toBe("Seattle");

    expect(
      toTerminalWithMates(
        topologyData.terminalsTopologyByAbbrev,
        terminalsData.terminalsByAbbrev.FAU!
      )
    ).toEqual({
      TerminalID: 12,
      TerminalName: "Fauntleroy",
      TerminalAbbrev: "FAU",
      Latitude: 47.5232,
      Longitude: -122.3967,
      TerminalMates: ["VAI"],
    });

    expect(
      toTerminalWithMates(
        topologyData.terminalsTopologyByAbbrev,
        terminalsData.terminalsById["11"]!
      ).TerminalName
    ).toBe("Bainbridge Island");
  });

  it("derives route abbreviations from topology and selection state", () => {
    const pairSelection = {
      kind: "pair",
      from: "P52",
      dest: "BBI",
    } satisfies SelectedTerminalPair;
    const allSelection = {
      kind: "all",
      terminal: "P52",
    } satisfies SelectedTerminalPair;

    expect(
      selectRouteAbbrevsForSelection(
        topologyData.terminalsTopologyByAbbrev,
        pairSelection
      )
    ).toEqual(["sea-bi"]);
    expect(
      selectRouteAbbrevsForSelection(
        topologyData.terminalsTopologyByAbbrev,
        allSelection
      )
    ).toEqual(["sea-bi"]);
    expect(
      selectRouteAbbrevsForSelection(
        topologyData.terminalsTopologyByAbbrev,
        null
      )
    ).toEqual(["sea-bi"]);
  });

  it("transforms terminal connections into sorted carousel cards and total counts", () => {
    expect(
      selectTerminalCards(terminalsData, topologyData.terminalsTopologyByAbbrev)
    ).toEqual([
      {
        terminalId: 11,
        terminalName: "Bainbridge Island",
        terminalSlug: "bbi",
        destinations: [
          {
            terminalId: 10,
            terminalName: "Seattle",
            terminalSlug: "p52",
          },
        ],
      },
      {
        terminalId: 12,
        terminalName: "Fauntleroy",
        terminalSlug: "fau",
        destinations: [
          {
            terminalId: 13,
            terminalName: "Vashon Island",
            terminalSlug: "vai",
          },
        ],
      },
      {
        terminalId: 10,
        terminalName: "Seattle",
        terminalSlug: "p52",
        destinations: [
          {
            terminalId: 11,
            terminalName: "Bainbridge Island",
            terminalSlug: "bbi",
          },
        ],
      },
      {
        terminalId: 13,
        terminalName: "Vashon Island",
        terminalSlug: "vai",
        destinations: [
          {
            terminalId: 12,
            terminalName: "Fauntleroy",
            terminalSlug: "fau",
          },
        ],
      },
    ]);

    expect(
      selectTotalCarouselItems(terminalsData, topologyData.terminalsTopologyByAbbrev)
    ).toBe(5);
  });
});
