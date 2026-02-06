/**
 * React context for page-level maps (vesselTripMap, vesselLocationByAbbrev,
 * displayTripByAbbrev). Provides maps to cards/timeline so they do not need
 * full maps duplicated in each display state.
 */

import { createContext, type ReactNode, useContext } from "react";
import type { PageMaps } from "./utils/buildPageDataMaps";

const ScheduledTripsMapsContext = createContext<PageMaps | null>(null);

type ScheduledTripsMapsProviderProps = {
  maps: PageMaps;
  children: ReactNode;
};

/**
 * Provides PageMaps to descendant components. Use when rendering the card list.
 *
 * @param maps - Page maps from useScheduledTripsMaps (must be non-null)
 * @param children - Card list or other consumers
 */
export const ScheduledTripsMapsProvider = ({
  maps,
  children,
}: ScheduledTripsMapsProviderProps) => (
  <ScheduledTripsMapsContext.Provider value={maps}>
    {children}
  </ScheduledTripsMapsContext.Provider>
);

/**
 * Consumes PageMaps from the nearest ScheduledTripsMapsProvider.
 *
 * @returns PageMaps when inside provider, or null
 */
export const useScheduledTripsMapsContext = (): PageMaps | null =>
  useContext(ScheduledTripsMapsContext);
