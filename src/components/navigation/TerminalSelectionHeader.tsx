/**
 * Shared navigation header title for all tab pages.
 *
 * Displays the current terminal selection context (pair vs all-terminals).
 */

import { useMemo } from "react";
import { Text, View } from "@/components/ui";
import { useSelectedTerminalPair } from "@/data/contexts";
import { getTerminalLocationByAbbrev } from "@/data/terminalLocations";

// ============================================================================
// Main component
// ============================================================================

export const TerminalSelectionHeader = () => {
  const { selectedTerminalPair, isHydrated } = useSelectedTerminalPair();

  const title = useMemo((): string => {
    if (!isHydrated || selectedTerminalPair == null) {
      return "Ferryjoy";
    }

    if (selectedTerminalPair.kind === "pair") {
      const from = getTerminalLocationByAbbrev(selectedTerminalPair.from);
      const dest = getTerminalLocationByAbbrev(selectedTerminalPair.dest);
      if (!from || !dest) {
        return "Ferryjoy";
      }
      return `${from.TerminalName} to ${dest.TerminalName}`;
    }

    const terminal = getTerminalLocationByAbbrev(selectedTerminalPair.terminal);
    if (!terminal) {
      return "Ferryjoy";
    }
    return `${terminal.TerminalName} (all terminals)`;
  }, [isHydrated, selectedTerminalPair]);

  return (
    <View className="flex-row items-center justify-center">
      <Text
        className="max-w-[260px] font-semibold text-[17px] text-slate-900"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
    </View>
  );
};
