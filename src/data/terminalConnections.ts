/**
 * Topology-driven terminal connection helpers for the home carousel.
 */

import { useMemo } from "react";
import {
  type TerminalsDataContextValue,
  type TerminalsTopologyDataContextValue,
  useTerminalsData,
  useTerminalsTopologyData,
} from "@/data/contexts/identity";
import {
  selectTerminalLocationByAbbrev,
  selectTerminalLocationById,
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

type TerminalsLookupData = Pick<
  TerminalsDataContextValue,
  "data" | "terminalsByAbbrev" | "terminalsById"
>;

type TerminalsTopologyLookupData = Pick<
  TerminalsTopologyDataContextValue,
  "data" | "terminalsTopologyByAbbrev"
>;

/**
 * Build the current terminal connections map from the derived topology
 * snapshot.
 *
 * @param terminalsData - Terminals dataset and lookup maps
 * @param topologyData - Topology dataset and lookup maps
 * @returns Connections keyed by departing terminal ID
 */
export const selectTerminalConnections = (
  terminalsData: TerminalsLookupData,
  topologyData: TerminalsTopologyLookupData
): TerminalConnectionsMap => {
  const connections: TerminalConnectionsMap = {};

  for (const topology of topologyData.data) {
    const departingTerminal = selectTerminalLocationByAbbrev(
      terminalsData,
      topologyData,
      topology.TerminalAbbrev
    );

    if (!departingTerminal) {
      continue;
    }

    connections[departingTerminal.TerminalID] = topology.TerminalMates.map(
      (arrivingAbbrev) => {
        const arrivingTerminal = selectTerminalLocationByAbbrev(
          terminalsData,
          topologyData,
          arrivingAbbrev
        );

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
 * @param terminalsData - Terminals dataset and lookup maps
 * @param topologyData - Topology dataset and lookup maps
 * @param connections - Connections keyed by departing terminal ID
 * @returns Terminal card view models sorted by terminal name
 */
export const selectTerminalCards = (
  terminalsData: TerminalsLookupData,
  topologyData: TerminalsTopologyLookupData,
  connections: TerminalConnectionsMap
): TerminalCardData[] =>
  Object.keys(connections)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((departingTerminalId) => {
      const departingTerminal = getTerminalLocationByIdOrNull(
        terminalsData,
        topologyData,
        departingTerminalId
      );

      if (!departingTerminal) {
        return [];
      }

      const destinations = (connections[departingTerminalId] ?? [])
        .map((connection) => {
          const arrivingTerminal = getTerminalLocationByIdOrNull(
            terminalsData,
            topologyData,
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
export const selectNumTerminalCards = (
  terminalsData: TerminalsLookupData,
  topologyData: TerminalsTopologyLookupData
) =>
  selectTerminalCards(
    terminalsData,
    topologyData,
    selectTerminalConnections(terminalsData, topologyData)
  ).length;

/**
 * Total carousel item count including the placeholder card.
 *
 * @param terminalsData - Terminals dataset and lookup maps
 * @param topologyData - Topology dataset and lookup maps
 * @returns Total carousel item count
 */
export const selectTotalCarouselItems = (
  terminalsData: TerminalsLookupData,
  topologyData: TerminalsTopologyLookupData
) => selectNumTerminalCards(terminalsData, topologyData) + 1;

/**
 * Resolve one terminal location by ID from the current snapshot.
 *
 * @param terminalsData - Terminals dataset and lookup maps
 * @param topologyData - Topology dataset and lookup maps
 * @param terminalId - Terminal ID
 * @returns Terminal location or `null`
 */
const getTerminalLocationByIdOrNull = (
  terminalsData: TerminalsLookupData,
  topologyData: TerminalsTopologyLookupData,
  terminalId: number
) =>
  terminalsData.data.find((terminal) => terminal.TerminalID === terminalId)
    ? selectTerminalLocationById(terminalsData, topologyData, terminalId)
    : null;

export const useTerminalConnections = (): TerminalConnectionsMap => {
  const terminalsData = useTerminalsData();
  const topologyData = useTerminalsTopologyData();

  return useMemo(
    () => selectTerminalConnections(terminalsData, topologyData),
    [terminalsData, topologyData]
  );
};

export const useTerminalCardData = (): TerminalCardData[] => {
  const terminalsData = useTerminalsData();
  const topologyData = useTerminalsTopologyData();

  return useMemo(() => {
    const connections = selectTerminalConnections(terminalsData, topologyData);
    return selectTerminalCards(terminalsData, topologyData, connections);
  }, [terminalsData, topologyData]);
};

export const useTotalCarouselItems = (): number => {
  const terminalsData = useTerminalsData();
  const topologyData = useTerminalsTopologyData();

  return useMemo(
    () => selectTotalCarouselItems(terminalsData, topologyData),
    [terminalsData, topologyData]
  );
};
