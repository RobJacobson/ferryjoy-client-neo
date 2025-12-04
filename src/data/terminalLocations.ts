import terminalLocationsData from "../../assets/wsf-data/wsf-terminals-locations.json";

/**
 * Type definition for terminal location data
 */
export type TerminalLocation = {
  TerminalID: number;
  TerminalSubjectID: number;
  RegionID: number;
  TerminalName: string;
  TerminalAbbrev: string;
  SortSeq: number;
  Latitude: number;
  Longitude: number;
  AddressLineOne: string;
  AddressLineTwo: string | null;
  City: string;
  State: string;
  ZipCode: string;
  Country: string;
  routeId: number | null;
  routeAbbrev: string | null;
  TerminalMates: string[];
};

/**
 * Type definition for terminal locations object mapping
 */
export type TerminalLocationsMap = Record<string, TerminalLocation>;

/**
 * Terminal locations data imported from JSON file
 */
export const terminalLocations: TerminalLocationsMap = terminalLocationsData;

/**
 * Helper function to get terminal location data by abbreviation
 * @param terminalAbbrev The abbreviation of terminal
 * @returns The terminal location data object or null if not found
 */
export const getTerminalLocation = (
  terminalAbbrev: string
): TerminalLocation | null => {
  return (terminalLocations as TerminalLocationsMap)[terminalAbbrev] || null;
};

/**
 * Helper function to get terminal location data by ID
 * @param terminalId The ID of terminal
 * @returns The terminal location data object or null if not found
 */
export const getTerminalLocationById = (
  terminalId: number
): TerminalLocation | null => {
  const terminals = Object.values(terminalLocations);
  return (
    terminals.find((terminal) => terminal.TerminalID === terminalId) || null
  );
};

/**
 * Helper function to get all terminals for a specific route
 * @param routeId The ID of route
 * @returns Array of terminal location data objects for route
 */
export const getTerminalsByRoute = (routeId: number): TerminalLocation[] => {
  const terminals = Object.values(terminalLocations);
  return terminals.filter((terminal) => terminal.routeId === routeId);
};

/**
 * Helper function to get all terminals in a specific region
 * @param regionId The ID of region
 * @returns Array of terminal location data objects for region
 */
export const getTerminalsByRegion = (regionId: number): TerminalLocation[] => {
  const terminals = Object.values(terminalLocations);
  return terminals.filter((terminal) => terminal.RegionID === regionId);
};
