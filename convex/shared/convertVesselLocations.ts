import type { ConvexVesselLocation } from "../functions/vesselLocation/schemas";

export const convertConvexVesselLocation = (
  cvl: ConvexVesselLocation
): ConvexVesselLocation => ({
  ...cvl,
  VesselAbbrev: getVesselAbbreviation(cvl.VesselID),
  Speed: cvl.Speed < 0.2 ? 0 : cvl.Speed,
});

/**
 * Map of vessel IDs to abbreviations
 */
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
} as Record<number, string>;

/**
 * Get vessel abbreviation by vessel ID
 * @param vesselId - The ID of the vessel
 * @returns The vessel abbreviation or empty string if not found
 */
const getVesselAbbreviation = (vesselId: number): string => {
  return vesselIdToAbbrev[vesselId] || "";
};
