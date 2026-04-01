import terminalsAssetJson from "assets/data/terminals.json";
import terminalsTopologyAssetJson from "assets/data/terminalsTopology.json";
import vesselsAssetJson from "assets/data/vessels.json";
import { z } from "zod";
import { storageKv } from "@/shared/storage";
import type { Terminal, TerminalTopology, Vessel } from "@/types";
import { indexByString, indexByTrimmed, indexByUppercase } from "./lookup";

export type VesselsSnapshot = Array<Vessel>;
export type TerminalsSnapshot = Array<Terminal>;
export type TerminalsTopologySnapshot = Array<TerminalTopology>;

export const VESSELS_ASSET = vesselsAssetJson as VesselsSnapshot;
export const TERMINALS_ASSET = terminalsAssetJson as TerminalsSnapshot;
export const TERMINALS_TOPOLOGY_ASSET =
  terminalsTopologyAssetJson as unknown as TerminalsTopologySnapshot;

export const VESSELS_STORAGE_KEY = storageKv.makeKey({
  scope: "identity",
  version: "v1",
  key: "vessels",
});

export const TERMINALS_STORAGE_KEY = storageKv.makeKey({
  scope: "identity",
  version: "v1",
  key: "terminals",
});

export const TERMINALS_TOPOLOGY_STORAGE_KEY = storageKv.makeKey({
  scope: "identity",
  version: "v1",
  key: "terminalsTopology",
});

export const VESSELS_STORAGE_SCHEMA = z.array(
  z.object({
    VesselID: z.number(),
    VesselName: z.string(),
    VesselAbbrev: z.string(),
    UpdatedAt: z.number().optional(),
  })
);

export const TERMINALS_STORAGE_SCHEMA = z.array(
  z.object({
    TerminalID: z.number(),
    TerminalName: z.string(),
    TerminalAbbrev: z.string(),
    IsPassengerTerminal: z.boolean().optional(),
    Latitude: z.number().optional(),
    Longitude: z.number().optional(),
    UpdatedAt: z.number().optional(),
  })
);

export const TERMINALS_TOPOLOGY_STORAGE_SCHEMA = z.array(
  z.object({
    TerminalAbbrev: z.string(),
    TerminalMates: z.array(z.string()),
    RouteAbbrevs: z.array(z.string()),
    RouteAbbrevsByArrivingTerminal: z.record(z.string(), z.array(z.string())),
    UpdatedAt: z.number().optional(),
  })
);

export const deriveVesselsData = (data: VesselsSnapshot) => ({
  vesselsByAbbrev: indexByUppercase(data, (vessel) => vessel.VesselAbbrev),
  vesselsByName: indexByTrimmed(data, (vessel) => vessel.VesselName),
  vesselsById: indexByString(data, (vessel) => vessel.VesselID),
});

export const deriveTerminalsData = (data: TerminalsSnapshot) => ({
  terminalsByAbbrev: indexByUppercase(
    data,
    (terminal) => terminal.TerminalAbbrev
  ),
  terminalsByName: indexByTrimmed(data, (terminal) => terminal.TerminalName),
  terminalsById: indexByString(data, (terminal) => terminal.TerminalID),
});

export const deriveTerminalsTopologyData = (
  data: TerminalsTopologySnapshot
) => ({
  terminalsTopologyByAbbrev: indexByUppercase(
    data,
    (row) => row.TerminalAbbrev
  ),
});

export type VesselsDerivedData = ReturnType<typeof deriveVesselsData>;
export type TerminalsDerivedData = ReturnType<typeof deriveTerminalsData>;
export type TerminalsTopologyDerivedData = ReturnType<
  typeof deriveTerminalsTopologyData
>;
