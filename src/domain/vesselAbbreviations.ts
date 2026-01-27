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
 * Get vessel full name by abbreviation.
 *
 * @param abbrev - The vessel abbreviation (e.g., "KAL", "WEN")
 * @returns The full vessel name if found, otherwise returns the abbreviation
 */
export const getVesselName = (abbrev: string): string => {
  // Build reverse lookup map on first call
  const abbrevToName = Object.entries(toVesselAbbreviation).reduce<
    Record<string, string>
  >((acc, [name, abbr]) => {
    acc[abbr] = name;
    return acc;
  }, {});

  return abbrevToName[abbrev] || abbrev;
};
