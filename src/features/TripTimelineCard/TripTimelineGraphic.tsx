import { View } from "@/components/ui";
import { clamp } from "@/shared/utils";
import { TRACK_HEIGHT } from "./constants";
import { TimelineCircle } from "./TimelineCircle";
import { TimelineKnob } from "./TimelineKnob";
import { TimelineLabel } from "./TimelineLabel";
import { TimelineTrack } from "./TimelineTrack";
import type { TripTimelineCardStatus } from "./types";

const formatTime12h = (date: Date) =>
  date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const getLabelPrefix = (
  position: "start" | "depart" | "end",
  status: TripTimelineCardStatus
): string => {
  if (position === "start") {
    return status === "future" ? "ETA" : "Arrived";
  }
  if (position === "depart") {
    return status === "atSea" || status === "arrived" ? "Left" : "ETD";
  }
  // position === "end"
  return status === "arrived" ? "Arrived" : "ETA";
};

export type TripTimelineGraphicProps = {
  status: TripTimelineCardStatus;
  startTime: Date;
  departTime?: Date;
  endTime?: Date;
  nowMs: number;
  hasDestination?: boolean;
  hasScheduledDeparture?: boolean;
};

export const TripTimelineGraphic = ({
  status,
  startTime,
  departTime,
  endTime,
  nowMs,
  hasDestination = true,
  hasScheduledDeparture = true,
}: TripTimelineGraphicProps) => {
  const isActive = status === "atDock" || status === "atSea";

  // Compute progress values
  const t0 = startTime.getTime();
  const t1 = departTime?.getTime() ?? t0;
  const t2 = endTime?.getTime() ?? t0;

  // When there's no destination, keep progress at 0
  let progressP = 0;
  let departP = 0;

  if (hasDestination) {
    const invalidOrdering = t1 < t0 || t2 < t1;
    const total = Math.max(t2 - t0, 1);
    departP = invalidOrdering ? 0 : clamp((t1 - t0) / total, 0, 1);

    if (invalidOrdering) {
      progressP = status === "arrived" ? 1 : 0;
    } else if (status === "future") {
      progressP = 0;
    } else if (status === "arrived") {
      progressP = 1;
    } else if (status === "atDock") {
      const dockDur = Math.max(t1 - t0, 1);
      const dockNow = clamp(nowMs, t0, t1);
      progressP = ((dockNow - t0) / dockDur) * departP;
    } else {
      // atSea
      const seaDur = Math.max(t2 - t1, 1);
      const seaNow = clamp(nowMs, t1, t2);
      progressP = departP + ((seaNow - t1) / seaDur) * (1 - departP);
    }
    progressP = clamp(progressP, 0, 1);
  }

  // Position percentages for circles and labels
  const startPosition = 0;
  const departPosition = clamp(departP * 100, 20, 60);
  const endPosition = 100;
  const progressPosition = progressP * 100;

  // Format times locally
  const startTimeStr = formatTime12h(startTime);
  const departTimeStr = departTime ? formatTime12h(departTime) : "--";
  const endTimeStr = hasDestination && endTime ? formatTime12h(endTime) : "--";
  const endDescription =
    hasDestination && endTime ? getLabelPrefix("end", status) : "";

  return (
    <View className="flex-col pt-4 w-full">
      {/* Row 1: Track with circles and knob */}
      <View className="relative" style={{ height: TRACK_HEIGHT }}>
        {/* Track background and progress fill */}
        <TimelineTrack progressP={progressP} />

        {/* Circles positioned along the track */}
        <TimelineCircle
          position={startPosition}
          positionType="start"
          status={status}
        />
        {/* Only show depart circle if there's a scheduled departure */}
        {hasScheduledDeparture && (
          <TimelineCircle
            position={departPosition}
            positionType="depart"
            status={status}
          />
        )}
        <TimelineCircle
          position={endPosition}
          positionType="end"
          status={status}
        />

        {/* Knob (active only) */}
        {isActive && <TimelineKnob progressPosition={progressPosition} />}
      </View>

      {/* Row 2: Labels aligned with circles */}
      <View className="relative pb-8 mt-4">
        <TimelineLabel
          position={startPosition}
          time={startTimeStr}
          description={getLabelPrefix("start", status)}
        />
        {/* Only show depart label if there's a scheduled departure */}
        {hasScheduledDeparture && (
          <TimelineLabel
            position={departPosition}
            time={departTimeStr}
            description={getLabelPrefix("depart", status)}
          />
        )}
        <TimelineLabel
          position={endPosition}
          time={endTimeStr}
          description={endDescription}
        />
      </View>
    </View>
  );
};
