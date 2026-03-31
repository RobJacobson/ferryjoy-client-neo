/**
 * Vessel identity helpers backed by the shared frontend identity catalog.
 */

import { getVesselByAbbrev, getVesselByName } from "@/data/identity/catalog";

/**
 * Get the canonical vessel abbreviation for a vessel name.
 *
 * @param vesselName - Full vessel name
 * @returns Vessel abbreviation, or `null` when unknown
 */
export const getVesselAbbreviation = (vesselName: string): string | null =>
  getVesselByName(vesselName)?.VesselAbbrev ?? null;

/**
 * Get the canonical vessel name for a vessel abbreviation.
 *
 * @param vesselAbbrev - Vessel abbreviation
 * @returns Vessel name, or `null` when unknown
 */
export const getVesselName = (vesselAbbrev: string): string | null =>
  getVesselByAbbrev(vesselAbbrev)?.VesselName ?? null;
