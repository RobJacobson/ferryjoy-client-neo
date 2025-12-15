import { View } from "@/components/ui";
import { TimelineCircle } from "./TimelineCircle";
import { TimelineKnob } from "./TimelineKnob";
import { TimelineTrack } from "./TimelineTrack";
import type {
  TripTimelineCardStatus,
} from "./types";

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
  isActive: boolean;
  status: TripTimelineCardStatus;
  departP: number;
  progressP: number;
  startFilled: boolean;
  departFilled: boolean;
  endFilled: boolean;
  startTime: Date;
  departTime: Date;
  endTime: Date;
  VesselName: string;
  VesselStatus: string;
};

export const TripTimelineGraphic = ({
  isActive,
  status,
  departP,
  progressP,
  startFilled,
  departFilled,
  endFilled,
  startTime,
  departTime,
  endTime,
  VesselName,
  VesselStatus,
}: TripTimelineGraphicProps) => {
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
        filled={startFilled}
        time={startTimeStr}
        description={getLabelPrefix("start", status)}
      />

      {/* Depart circle + label */}
      <TimelineCircle
        position={departPosition}
        filled={departFilled}
        time={departTimeStr}
        description={getLabelPrefix("depart", status)}
      />

      {/* End circle + label */}
      <TimelineCircle
        position={endPosition}
        filled={endFilled}
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
