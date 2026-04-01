/**
 * Topology-driven terminal connection helpers for the home carousel.
 */

import { readIdentityCatalog } from "@/data/identity";
import {
  getTerminalLocationByAbbrev,
  getTerminalLocationById,
} from "./terminalLocations";

export type TerminalConnection = {
  DepartingTerminalID: number;
  DepartingDescription: string;
  ArrivingTerminalID: number;
  ArrivingDescription: string;
};

export type TerminalConnectionsMap = Record<number, Array<TerminalConnection>>;

export type TerminalCardData = {
  terminalId: number;
  terminalName: string;
  terminalSlug: string;
  destinations: Array<{
    terminalId: number;
    terminalName: string;
    terminalSlug: string;
  }>;
};

/**
 * Build the current terminal connections map from the derived topology
 * snapshot.
 *
 * @returns Connections keyed by departing terminal ID
 */
export const getTerminalConnections = (): TerminalConnectionsMap => {
  const { terminalsTopology } = readIdentityCatalog();
  const connections: TerminalConnectionsMap = {};

  for (const topology of terminalsTopology) {
    const departingTerminal = getTerminalLocationByAbbrev(
      topology.TerminalAbbrev
    );

    if (!departingTerminal) {
      continue;
    }

    connections[departingTerminal.TerminalID] = topology.TerminalMates.map(
      (arrivingAbbrev) => {
        const arrivingTerminal = getTerminalLocationByAbbrev(arrivingAbbrev);

        if (!arrivingTerminal) {
          return null;
        }

        return {
          DepartingTerminalID: departingTerminal.TerminalID,
          DepartingDescription: departingTerminal.TerminalName,
          ArrivingTerminalID: arrivingTerminal.TerminalID,
          ArrivingDescription: arrivingTerminal.TerminalName,
        } satisfies TerminalConnection;
      }
    ).filter(
      (connection): connection is TerminalConnection => connection !== null
    );
  }

  return connections;
};

/**
 * Transform terminal connections into UI card data.
 *
 * @param connections - Connections keyed by departing terminal ID
 * @returns Terminal card view models sorted by terminal name
 */
export const transformConnectionsToTerminalCards = (
  connections: TerminalConnectionsMap
): TerminalCardData[] =>
  Object.keys(connections)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((departingTerminalId) => {
      const departingTerminal =
        getTerminalLocationByIdOrNull(departingTerminalId);

      if (!departingTerminal) {
        return [];
      }

      const destinations = (connections[departingTerminalId] ?? [])
        .map((connection) => {
          const arrivingTerminal = getTerminalLocationByIdOrNull(
            connection.ArrivingTerminalID
          );

          if (!arrivingTerminal) {
            return null;
          }

          return {
            terminalId: arrivingTerminal.TerminalID,
            terminalName: arrivingTerminal.TerminalName,
            terminalSlug: arrivingTerminal.TerminalAbbrev.toLowerCase(),
          };
        })
        .filter(
          (destination): destination is NonNullable<typeof destination> =>
            destination !== null
        );

      return [
        {
          terminalId: departingTerminal.TerminalID,
          terminalName: departingTerminal.TerminalName,
          terminalSlug: departingTerminal.TerminalAbbrev.toLowerCase(),
          destinations,
        },
      ];
    })
    .sort((left, right) => left.terminalName.localeCompare(right.terminalName));

/**
 * Number of current carousel cards derived from topology.
 *
 * This is intentionally dynamic so the carousel follows the same identity
 * source-of-truth as the rest of the app.
 */
export const getNumTerminalCards = () =>
  transformConnectionsToTerminalCards(getTerminalConnections()).length;

/**
 * Total carousel item count including the placeholder card.
 *
 * @returns Total carousel item count
 */
export const getTotalCarouselItems = () => getNumTerminalCards() + 1;

/**
 * Resolve one terminal location by ID from the current snapshot.
 *
 * @param terminalId - Terminal ID
 * @returns Terminal location or `null`
 */
const getTerminalLocationByIdOrNull = (terminalId: number) =>
  readIdentityCatalog().terminals.find(
    (terminal) => terminal.TerminalID === terminalId
  )
    ? getTerminalLocationById(terminalId)
    : null;
