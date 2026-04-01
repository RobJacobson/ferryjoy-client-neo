/**
 * Shared navigation header title for all tab pages.
 *
 * Displays the current terminal selection context (pair vs all-terminals).
 */

import { useMemo } from "react";
import { Text, View } from "@/components/ui";
import { useSelectedTerminalPair, useTerminalsData } from "@/data/contexts";

// ============================================================================
// Main component
// ============================================================================

export const TerminalSelectionHeader = () => {
  const { selectedTerminalPair, isHydrated } = useSelectedTerminalPair();
  const terminalsData = useTerminalsData();

  const title = useMemo((): string => {
    if (!isHydrated || selectedTerminalPair == null) {
      return "Ferryjoy";
    }

    if (selectedTerminalPair.kind === "pair") {
      const from =
        terminalsData.terminalsByAbbrev[
          selectedTerminalPair.from.toUpperCase()
        ];
      const dest =
        terminalsData.terminalsByAbbrev[
          selectedTerminalPair.dest.toUpperCase()
        ];
      if (!from || !dest) {
        return "Ferryjoy";
      }
      return `${from.TerminalName} to ${dest.TerminalName}`;
    }

    const terminal =
      terminalsData.terminalsByAbbrev[
        selectedTerminalPair.terminal.toUpperCase()
      ];
    if (!terminal) {
      return "Ferryjoy";
    }
    return `${terminal.TerminalName} (all terminals)`;
  }, [isHydrated, selectedTerminalPair, terminalsData]);

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
