import { describe, expect, it } from "bun:test";
import type { SelectedTerminalPair } from "@/data/contexts/SelectedTerminalPairContext";
import {
  selectTerminalCards,
  selectTerminalConnections,
  selectTotalCarouselItems,
} from "../../terminalConnections";
import {
  selectTerminalLocationByAbbrev,
  selectTerminalLocationById,
  selectTerminalNameByAbbrev,
} from "../../terminalLocations";
import {
  selectRouteAbbrevs,
  selectRouteAbbrevsForSelection,
} from "../../terminalRouteMapping";
import {
  deriveTerminalsData,
  deriveTerminalsTopologyData,
  deriveVesselsData,
  type TerminalsSnapshot,
  type TerminalsTopologySnapshot,
  type VesselsSnapshot,
} from "./datasets";

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

  it("resolves terminal locations and names from context data", () => {
    expect(selectTerminalNameByAbbrev(terminalsData, "p52")).toBe("Seattle");

    expect(
      selectTerminalLocationByAbbrev(terminalsData, topologyData, "fau")
    ).toEqual({
      TerminalID: 12,
      TerminalName: "Fauntleroy",
      TerminalAbbrev: "FAU",
      Latitude: 47.5232,
      Longitude: -122.3967,
      routeAbbrevs: ["f-v-s"],
      routeAbbrev: "f-v-s",
      TerminalMates: ["VAI"],
    });

    expect(
      selectTerminalLocationById(terminalsData, topologyData, 11)?.TerminalName
    ).toBe("Bainbridge Island");
  });

  it("derives route abbreviations from topology and selection state", () => {
    const pairSelection = {
      kind: "pair",
      from: "P52",
      dest: "BBI",
    } satisfies SelectedTerminalPair;

    expect(selectRouteAbbrevs(topologyData, "P52")).toEqual(["sea-bi"]);
    expect(selectRouteAbbrevsForSelection(topologyData, pairSelection)).toEqual(
      ["sea-bi"]
    );
    expect(selectRouteAbbrevsForSelection(topologyData, null)).toEqual([
      "sea-bi",
    ]);
  });

  it("builds terminal connections from the shared terminal and topology stores", () => {
    expect(selectTerminalConnections(terminalsData, topologyData)).toEqual({
      10: [
        {
          DepartingTerminalID: 10,
          DepartingDescription: "Seattle",
          ArrivingTerminalID: 11,
          ArrivingDescription: "Bainbridge Island",
        },
      ],
      11: [
        {
          DepartingTerminalID: 11,
          DepartingDescription: "Bainbridge Island",
          ArrivingTerminalID: 10,
          ArrivingDescription: "Seattle",
        },
      ],
      12: [
        {
          DepartingTerminalID: 12,
          DepartingDescription: "Fauntleroy",
          ArrivingTerminalID: 13,
          ArrivingDescription: "Vashon Island",
        },
      ],
    });
  });

  it("transforms terminal connections into sorted carousel cards and total counts", () => {
    const connections = selectTerminalConnections(terminalsData, topologyData);

    expect(
      selectTerminalCards(terminalsData, topologyData, connections)
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
    ]);

    expect(selectTotalCarouselItems(terminalsData, topologyData)).toBe(4);
  });
});
