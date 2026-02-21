/**
 * useDestinationNavigation – Returns a handler that sets the terminal pair and
 * navigates to the map tab when a destination is selected.
 */

import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useSelectedTerminalPair } from "@/data/contexts";

/**
 * Returns a handler that sets the terminal pair and navigates to the map tab.
 *
 * @param originSlug - Slug of the departing terminal (e.g., "bi")
 * @returns Handler that accepts destinationSlug and navigates
 */
export function useDestinationNavigation(
  originSlug: string
): (destinationSlug: string) => void {
  const router = useRouter();
  const { setPair } = useSelectedTerminalPair();

  return (destinationSlug: string) => {
    const fromAbbrev = originSlug.toUpperCase();
    const destAbbrev = destinationSlug.toUpperCase();
    void setPair(fromAbbrev, destAbbrev);
    router.push(`/(tabs)/map/${fromAbbrev}/${destAbbrev}` as Href);
  };
}
