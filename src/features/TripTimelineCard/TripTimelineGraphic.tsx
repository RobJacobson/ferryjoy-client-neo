import { View } from "@/components/ui";
import { clamp } from "@/shared/utils";
import { TimelineCircle } from "./TimelineCircle";
import { TimelineKnob } from "./TimelineKnob";
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
  departTime: Date;
  endTime: Date;
  nowMs: number;
  VesselName: string;
  VesselStatus: string;
};

export const TripTimelineGraphic = ({
  status,
  startTime,
  departTime,
  endTime,
  nowMs,
  VesselName,
  VesselStatus,
}: TripTimelineGraphicProps) => {
  const isActive = status === "atDock" || status === "atSea";

  // Compute progress values
  const t0 = startTime.getTime();
  const t1 = departTime.getTime();
  const t2 = endTime.getTime();

  const invalidOrdering = t1 < t0 || t2 < t1;
  const total = Math.max(t2 - t0, 1);
  const departP = invalidOrdering ? 0 : clamp((t1 - t0) / total, 0, 1);

  let progressP = 0;
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

  // Hardcoded eastbound positions
  const startPosition = 0;
  const departPosition = departP * 100;
  const endPosition = 100;

  // Convert progressP to position percentage (eastbound)
  const progressPosition = progressP * 100;

  // Format times locally
  const startTimeStr = formatTime12h(startTime);
  const departTimeStr = formatTime12h(departTime);
  const endTimeStr = formatTime12h(endTime);

  return (
    <View className="w-full h-[60px]">
      {/* Track with progress fill */}
      <TimelineTrack progressP={progressP} />

      {/* Start circle + label */}
      <TimelineCircle
        position={startPosition}
        positionType="start"
        status={status}
        time={startTimeStr}
        description={getLabelPrefix("start", status)}
      />

      {/* Depart circle + label */}
      <TimelineCircle
        position={departPosition}
        positionType="depart"
        status={status}
        time={departTimeStr}
        description={getLabelPrefix("depart", status)}
      />

      {/* End circle + label */}
      <TimelineCircle
        position={endPosition}
        positionType="end"
        status={status}
        time={endTimeStr}
        description={getLabelPrefix("end", status)}
      />

      {/* Knob + callout (active only) */}
      {isActive ? (
        <TimelineKnob
          progressPosition={progressPosition}
          VesselName={VesselName}
          VesselStatus={VesselStatus}
        />
      ) : null}
    </View>
  );
};
