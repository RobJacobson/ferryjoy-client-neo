/**
 * Vessel identity snapshot assets, storage keys, and lookup index builders.
 */

import type { Vessel } from "functions/vessels/schemas";
import { storageKv } from "@/shared/storage";
import vesselsAssetJson from "../../../assets/data/vessels.json";
import { indexByString, indexByTrimmed, indexByUppercase } from "./utils";

export type FrontendVesselSnapshot = Array<Vessel>;

const vesselsAsset = vesselsAssetJson as FrontendVesselSnapshot;

const identityVesselsStorageKey = storageKv.makeKey({
  scope: "identity",
  version: "v1",
  key: "vessels",
});

export const IDENTITY_VESSELS_STORAGE_KEY = identityVesselsStorageKey;
export const IDENTITY_VESSELS_ASSET = vesselsAsset;

/**
 * Build vessel lookup indexes from a raw snapshot array.
 *
 * @param vessels - Raw vessel rows
 * @returns Record maps keyed by abbrev, name, and id
 */
export const buildVesselIndexes = (vessels: FrontendVesselSnapshot) => ({
  vesselsByAbbrev: indexByUppercase(vessels, (vessel) => vessel.VesselAbbrev),
  vesselsByName: indexByTrimmed(vessels, (vessel) => vessel.VesselName),
  vesselsById: indexByString(vessels, (vessel) => vessel.VesselID),
});
