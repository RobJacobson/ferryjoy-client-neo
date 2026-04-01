/**
 * Terminal identity snapshot assets, storage keys, and lookup index builders.
 */

import type { Terminal } from "functions/terminals/schemas";
import { storageKv } from "@/shared/storage";
import terminalsAssetJson from "../../../assets/data/terminals.json";
import { indexByString, indexByTrimmed, indexByUppercase } from "./utils";

export type FrontendTerminalSnapshot = Array<Terminal>;

const terminalsAsset = terminalsAssetJson as FrontendTerminalSnapshot;

const identityTerminalsStorageKey = storageKv.makeKey({
  scope: "identity",
  version: "v1",
  key: "terminals",
});

export const IDENTITY_TERMINALS_STORAGE_KEY = identityTerminalsStorageKey;
export const IDENTITY_TERMINALS_ASSET = terminalsAsset;

/**
 * Build terminal lookup indexes from a raw snapshot array.
 *
 * @param terminals - Raw terminal rows
 * @returns Record maps keyed by abbrev, name, and id
 */
export const buildTerminalIndexes = (terminals: FrontendTerminalSnapshot) => ({
  terminalsByAbbrev: indexByUppercase(
    terminals,
    (terminal) => terminal.TerminalAbbrev
  ),
  terminalsByName: indexByTrimmed(
    terminals,
    (terminal) => terminal.TerminalName
  ),
  terminalsById: indexByString(terminals, (terminal) => terminal.TerminalID),
});
