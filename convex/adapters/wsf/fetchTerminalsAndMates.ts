/**
 * WSF schedule adapter: terminal pairs reachable on a sailing day.
 *
 * Wraps {@link fetchTerminalsAndMates} and returns normalized pair rows.
 */

import { fetchTerminalsAndMates } from "ws-dottie/wsf-schedule/core";

/**
 * One departing→arriving terminal pair from the mates feed.
 */
export type WsfTerminalMatePair = {
  DepartingTerminalID: number;
  ArrivingTerminalID: number;
};

/**
 * Fetches reachable terminal pairs for the given sailing day.
 *
 * @param tripDate - Sailing day string (same format as WSF schedule APIs)
 * @returns Normalized mate pairs with numeric terminal IDs
 */
export const fetchWsfTerminalsAndMates = async (
  tripDate: string
): Promise<ReadonlyArray<WsfTerminalMatePair>> => {
  const combos = await fetchTerminalsAndMates({
    params: { TripDate: tripDate },
  });

  return (
    combos as Array<{
      DepartingTerminalID?: unknown;
      ArrivingTerminalID?: unknown;
    }>
  ).filter(
    (row): row is WsfTerminalMatePair =>
      typeof row.DepartingTerminalID === "number" &&
      typeof row.ArrivingTerminalID === "number"
  );
};
