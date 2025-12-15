import type { LayoutChangeEvent } from "react-native";
import { View } from "@/components/ui";
import { TimelineCallout } from "./TimelineCallout";
import { TimelineCircle } from "./TimelineCircle";
import { TimelineKnob } from "./TimelineKnob";
import { TimelineTrack } from "./TimelineTrack";
import type { TripTimelineCardDirection } from "./types";
import type { TripTimelineCardLabel } from "./useTripTimelineCardModel";

export type TripTimelineGraphicProps = {
  trackWidth: number;
  onTrackLayout: (e: LayoutChangeEvent) => void;
  isActive: boolean;
  direction: TripTimelineCardDirection;
  departP: number;
  progressP: number;
  progressX: number;
  startFilled: boolean;
  departFilled: boolean;
  endFilled: boolean;
  calloutText: string;
  startLabel: TripTimelineCardLabel;
  departLabel: TripTimelineCardLabel;
  endLabel: TripTimelineCardLabel;
};

export const TripTimelineGraphic = ({
  trackWidth,
  onTrackLayout,
  isActive,
  direction,
  departP,
  progressP,
  progressX,
  startFilled,
  departFilled,
  endFilled,
  calloutText,
  startLabel,
  departLabel,
  endLabel,
}: TripTimelineGraphicProps) => {
  const isWestward = direction === "westward";

  // For westward trips, reverse the positions:
  // - Start (on right) at 100%
  // - Depart (in middle) at (1 - departP) * 100%
  // - End (on left) at 0%
  // For eastward trips, keep original positions:
  // - Start (on left) at 0%
  // - Depart (in middle) at departP * 100%
  // - End (on right) at 100%
  const startPosition = isWestward ? 100 : 0;
  const departPosition = isWestward ? (1 - departP) * 100 : departP * 100;
  const endPosition = isWestward ? 0 : 100;

  return (
    <View className="w-full h-[60px]" onLayout={onTrackLayout}>
      {/* Track with progress fill */}
      <TimelineTrack direction={direction} progressP={progressP} />

      {/* Start circle + label */}
      <TimelineCircle
        position={startPosition}
        filled={startFilled}
        label={startLabel}
      />

      {/* Depart circle + label */}
      <TimelineCircle
        position={departPosition}
        filled={departFilled}
        label={departLabel}
      />

      {/* End circle + label */}
      <TimelineCircle
        position={endPosition}
        filled={endFilled}
        label={endLabel}
      />

      {/* Knob + callout (active only) */}
      {isActive ? (
        <>
          <TimelineCallout
            text={calloutText}
            trackWidth={trackWidth}
            progressX={progressX}
          />
          <TimelineKnob progressX={progressX} />
        </>
      ) : null}
    </View>
  );
};
