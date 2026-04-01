/**
 * Terminals topology snapshot assets, storage keys, and lookup index builders.
 */

import { storageKv } from "@/shared/storage";
import type { TerminalTopology } from "@/types";
import terminalsTopologyAssetJson from "../../../assets/data/terminalsTopology.json";
import { indexByUppercase } from "./utils";

export type FrontendTerminalsTopologySnapshot = Array<TerminalTopology>;

const terminalsTopologyAsset =
  terminalsTopologyAssetJson as unknown as FrontendTerminalsTopologySnapshot;

const identityTerminalsTopologyStorageKey = storageKv.makeKey({
  scope: "identity",
  version: "v1",
  key: "terminalsTopology",
});

export const IDENTITY_TERMINALS_TOPOLOGY_STORAGE_KEY =
  identityTerminalsTopologyStorageKey;
export const IDENTITY_TERMINALS_TOPOLOGY_ASSET = terminalsTopologyAsset;

/**
 * Build topology lookup indexes from a raw snapshot array.
 *
 * @param terminalsTopology - Raw topology rows
 * @returns Record map keyed by departing terminal abbreviation
 */
export const buildTerminalTopologyIndexes = (
  terminalsTopology: FrontendTerminalsTopologySnapshot
) => ({
  terminalsTopologyByAbbrev: indexByUppercase(
    terminalsTopology,
    (row) => row.TerminalAbbrev
  ),
});
