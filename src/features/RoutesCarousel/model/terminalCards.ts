/**
 * Topology-driven terminal card helpers for the home carousel.
 */

import {
  type TerminalsDataContextValue,
  type TerminalsTopologyDataContextValue,
  useTerminalsData,
  useTerminalsTopologyData,
} from "@/data/contexts/identity";

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

type TerminalsLookupData = Pick<TerminalsDataContextValue, "terminalsByAbbrev">;

type TerminalsTopologyByAbbrev =
  TerminalsTopologyDataContextValue["terminalsTopologyByAbbrev"];

/**
 * Transform canonical terminals and topology into UI card data.
 *
 * The carousel is topology-driven: we only render terminals that currently have
 * one or more topology mates. Canonical terminal identity rows provide the
 * display fields for those topology-backed cards.
 */
export const selectTerminalCards = (
  terminalsData: TerminalsLookupData,
  terminalsTopologyByAbbrev: TerminalsTopologyByAbbrev
): TerminalCardData[] =>
  Object.values(terminalsTopologyByAbbrev)
    .filter((topology) => topology.TerminalMates.length > 0)
    .flatMap((topology) => {
      const terminal = getTerminalByAbbrev(
        terminalsData,
        topology.TerminalAbbrev
      );

      if (!terminal) {
        return [];
      }

      const destinations = topology.TerminalMates.flatMap((arrivingAbbrev) => {
        const arrivingTerminal = getTerminalByAbbrev(
          terminalsData,
          arrivingAbbrev
        );

        if (!arrivingTerminal) {
          return [];
        }

        return [
          {
            terminalId: arrivingTerminal.TerminalID,
            terminalName: arrivingTerminal.TerminalName,
            terminalSlug: arrivingTerminal.TerminalAbbrev.toLowerCase(),
          },
        ];
      });

      if (destinations.length === 0) {
        return [];
      }

      return [
        {
          terminalId: terminal.TerminalID,
          terminalName: terminal.TerminalName,
          terminalSlug: terminal.TerminalAbbrev.toLowerCase(),
          destinations,
        } satisfies TerminalCardData,
      ];
    })
    .sort((left, right) => left.terminalName.localeCompare(right.terminalName));

/**
 * Total carousel item count including the placeholder card.
 */
export const selectTotalCarouselItems = (
  terminalsData: TerminalsLookupData,
  terminalsTopologyByAbbrev: TerminalsTopologyByAbbrev
) => selectTerminalCards(terminalsData, terminalsTopologyByAbbrev).length + 1;

const getTerminalByAbbrev = (
  terminalsData: TerminalsLookupData,
  terminalAbbrev: string
) => terminalsData.terminalsByAbbrev[terminalAbbrev.toUpperCase()] ?? null;

export const useTerminalCardData = (): TerminalCardData[] => {
  const terminalsData = useTerminalsData();
  const { terminalsTopologyByAbbrev } = useTerminalsTopologyData();

  return selectTerminalCards(terminalsData, terminalsTopologyByAbbrev);
};

export const useTotalCarouselItems = (): number => {
  const terminalsData = useTerminalsData();
  const { terminalsTopologyByAbbrev } = useTerminalsTopologyData();

  return selectTotalCarouselItems(terminalsData, terminalsTopologyByAbbrev);
};
