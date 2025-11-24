/**
 * Maps each WSF terminal ID to its terminal information including name and coordinates
 * Data sourced from Washington State Ferries API
 */
export const terminalData = {
  1: { terminalName: "Anacortes", Latitude: 48.507351, Longitude: -122.677 },
  3: {
    terminalName: "Bainbridge Island",
    Latitude: 47.622339,
    Longitude: -122.509617,
  },
  4: { terminalName: "Bremerton", Latitude: 47.561847, Longitude: -122.624089 },
  5: { terminalName: "Clinton", Latitude: 47.9754, Longitude: -122.349581 },
  8: { terminalName: "Edmonds", Latitude: 47.813378, Longitude: -122.385378 },
  9: { terminalName: "Fauntleroy", Latitude: 47.5232, Longitude: -122.3967 },
  10: {
    terminalName: "Friday Harbor",
    Latitude: 48.535783,
    Longitude: -123.013844,
  },
  11: {
    terminalName: "Coupeville",
    Latitude: 48.159008,
    Longitude: -122.672603,
  },
  12: { terminalName: "Kingston", Latitude: 47.794606, Longitude: -122.494328 },
  13: {
    terminalName: "Lopez Island",
    Latitude: 48.570928,
    Longitude: -122.882764,
  },
  14: { terminalName: "Mukilteo", Latitude: 47.9506, Longitude: -122.297 },
  15: {
    terminalName: "Orcas Island",
    Latitude: 48.597333,
    Longitude: -122.943494,
  },
  16: {
    terminalName: "Point Defiance",
    Latitude: 47.306519,
    Longitude: -122.514053,
  },
  17: {
    terminalName: "Port Townsend",
    Latitude: 48.110847,
    Longitude: -122.759039,
  },
  7: { terminalName: "Seattle", Latitude: 47.602501, Longitude: -122.340472 },
  18: {
    terminalName: "Shaw Island",
    Latitude: 48.584792,
    Longitude: -122.92965,
  },
  19: {
    terminalName: "Sidney B.C.",
    Latitude: 48.643114,
    Longitude: -123.396739,
  },
  20: {
    terminalName: "Southworth",
    Latitude: 47.513064,
    Longitude: -122.495742,
  },
  21: {
    terminalName: "Tahlequah",
    Latitude: 47.331961,
    Longitude: -122.507786,
  },
  22: {
    terminalName: "Vashon Island",
    Latitude: 47.51095,
    Longitude: -122.463639,
  },
};

/**
 * Type definition for terminal data object
 */
export type TerminalData = {
  terminalName: string;
  Latitude: number;
  Longitude: number;
};

/**
 * Type definition for terminal data object mapping
 */
export type TerminalDataMap = Record<number, TerminalData>;

/**
 * Helper function to get terminal data by ID
 * @param terminalId The ID of terminal
 * @returns The terminal data object or null if not found
 */
export const getTerminalData = (terminalId: number): TerminalData | null => {
  return (terminalData as TerminalDataMap)[terminalId] || null;
};
