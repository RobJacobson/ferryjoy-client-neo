/**
 * Mapping from vessel names to their abbreviations
 * Based on WSDOT ferry vessel data
 */
export const toVesselAbbreviation: Record<string, string> = {
  Cathlamet: "CAT",
  Chelan: "CHE",
  Chetzemoka: "CHZ",
  Chimacum: "CHM",
  Issaquah: "ISS",
  Kaleetan: "KAL",
  Kennewick: "KEN",
  Kitsap: "KIS",
  Kittitas: "KIT",
  Puyallup: "PUY",
  Salish: "SAL",
  Samish: "SAM",
  Sealth: "SEA",
  Spokane: "SPO",
  Suquamish: "SUQ",
  Tacoma: "TAC",
  Tillikum: "TIL",
  Tokitae: "TOK",
  "Walla Walla": "WAL",
  Wenatchee: "WEN",
  Yakima: "YAK",
};

/**
 * Get vessel abbreviation by vessel name
 * @param vesselName - The full name of the vessel
 * @returns The vessel abbreviation or undefined if not found
 */
export const getVesselAbbreviation = (vesselName: string): string => {
  return toVesselAbbreviation[vesselName] || "";
};

/**
 * Check if a vessel name has a known abbreviation
 * @param vesselName - The full name of the vessel
 * @returns True if the vessel has a known abbreviation
 */
export const hasVesselAbbreviation = (vesselName: string): boolean => {
  return vesselName in toVesselAbbreviation;
};
