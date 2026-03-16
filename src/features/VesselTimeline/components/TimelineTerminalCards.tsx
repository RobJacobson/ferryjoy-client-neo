import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { VesselTimelineRenderState } from "../types";

type TimelineRowCardPosition = "none" | "top" | "bottom" | "single";

const TERMINAL_CARD_TOP_OFFSET_PX = -20;
const TERMINAL_CARD_DEPARTURE_CAP_HEIGHT_PX = 20;

type TimelineTerminalCardsProps = Pick<VesselTimelineRenderState, "rows">;

export const TimelineTerminalCards = ({ rows }: TimelineTerminalCardsProps) => (
  <View className="absolute inset-0" pointerEvents="none">
    {rows.map((row, rowIndex) => {
      const cardPosition = getCardPosition(rows, rowIndex);
      if (cardPosition === "none") {
        return null;
      }

      return (
        <View
          key={`${row.id}-card`}
          className={cn(
            "absolute right-0 left-0 bg-pink-300/25",
            cardPosition === "top" && "rounded-t-[28px]",
            cardPosition === "bottom" && "rounded-b-[28px]",
            cardPosition === "single" && "rounded-[28px]"
          )}
          style={getCardStyle(row, cardPosition)}
        />
      );
    })}
  </View>
);

const getCardPosition = (
  rows: VesselTimelineRenderState["rows"],
  rowIndex: number
): TimelineRowCardPosition => {
  const row = rows[rowIndex];
  if (!row) {
    return "none";
  }

  const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : undefined;
  const nextRow = rows[rowIndex + 1];
  const rowTerminal = row.startBoundary.terminalAbbrev;

  const matchesNext =
    row.kind === "dock" &&
    nextRow?.kind === "sea" &&
    rowTerminal !== undefined &&
    rowTerminal === nextRow.startBoundary.terminalAbbrev;

  const matchesPrevious =
    previousRow?.kind === "dock" &&
    row.kind === "sea" &&
    previousRow.startBoundary.terminalAbbrev !== undefined &&
    previousRow.startBoundary.terminalAbbrev === rowTerminal;

  if (matchesNext) {
    return "top";
  }

  if (matchesPrevious) {
    return "bottom";
  }

  return row.kind === "dock" && rowTerminal ? "single" : "none";
};

const getCardStyle = (
  row: VesselTimelineRenderState["rows"][number],
  cardPosition: Exclude<TimelineRowCardPosition, "none">
) =>
  cardPosition === "bottom"
    ? {
        top: row.topPx,
        height: TERMINAL_CARD_DEPARTURE_CAP_HEIGHT_PX,
      }
    : {
        top: row.topPx + TERMINAL_CARD_TOP_OFFSET_PX,
        height: row.displayHeightPx - TERMINAL_CARD_TOP_OFFSET_PX,
      };
