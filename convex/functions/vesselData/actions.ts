import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";
import { internalAction } from "../../_generated/server";
import { storeVesselLocations } from "../vesselLocation/actions";
import {
  type ConvexVesselLocation,
  toConvexVesselLocation,
} from "../vesselLocation/schemas";
import { updateActiveVesselTrips } from "../vesselTrips/actions";

/**
 * Main orchestrator action for vessel data
 * Runs every 5 seconds to fetch vessel locations and update related data
 * 1. Fetches vesselLocation data from fetchVesselLocations
 * 2. Calls storeVesselLocations with that data
 * 3. Calls updateActiveVesselTrips with that data
 */
export const updateVesselData = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch vesselLocation data from fetchVesselLocations
    const vesselLocations = (await fetchVesselLocations())
      .map(toConvexVesselLocation)
      .map((vl) => ({ ...vl, VesselAbbrev: getVesselAbbreviation(vl) }));

    // 2. Call storeVesselLocations with that data
    await storeVesselLocations(ctx, vesselLocations);

    // 3. Call updateActiveVesselTrips with that data
    await updateActiveVesselTrips(ctx, vesselLocations);
  },
});

const vesselIdToAbbrev = {
  1: "CAT", // Cathlamet
  2: "CHE", // Chelan
  65: "CHZ", // Chetzemoka
  74: "CHM", // Chimacum
  15: "ISS", // Issaquah
  17: "KAL", // Kaleetan
  52: "KEN", // Kennewick
  18: "KIS", // Kitsap
  19: "KIT", // Kittitas
  25: "PUY", // Puyallup
  66: "SAL", // Salish
  69: "SAM", // Samish
  28: "SEA", // Sealth
  30: "SPO", // Spokane
  75: "SUQ", // Suquamish
  32: "TAC", // Tacoma
  33: "TIL", // Tillikum
  68: "TOK", // Tokitae
  36: "WAL", // Walla Walla
  37: "WEN", // Wenatchee
  38: "YAK", // Yakima
} as Record<string, string>;

/**
 * Get vessel abbreviation by vessel name
 * @param vesselName - The full name of the vessel
 * @returns The vessel abbreviation or undefined if not found
 */
export const getVesselAbbreviation = (vl: ConvexVesselLocation): string => {
  const vesselId = vl.VesselID.toString();
  return vesselIdToAbbrev[vesselId] || "";
};
