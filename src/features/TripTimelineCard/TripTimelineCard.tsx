import { useEffect, useState } from "react";
import { View } from "@/components/ui";
import { clamp } from "@/shared/utils";
import { TripTimelineGraphic } from "./TripTimelineGraphic";
import type { TripTimelineCardProps } from "./types";

const formatTime12h = (date: Date) =>
  date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const getAccessibilityLabel = (
  status: TripTimelineCardProps["status"],
  fromTerminal: string,
  toTerminal: string,
  startTime: Date,
  departTime: Date,
  endTime: Date
): string => {
  const startTimeStr = formatTime12h(startTime);
  const departTimeStr = formatTime12h(departTime);
  const endTimeStr = formatTime12h(endTime);

  const startPrefix = status === "future" ? "ETA" : "Arrived";
  const departPrefix =
    status === "atSea" || status === "arrived" ? "Left" : "ETD";
  const endPrefix = status === "arrived" ? "Arrived" : "ETA";

  return `Trip timeline: ${status}. ${startPrefix} ${fromTerminal} ${startTimeStr}. ${departPrefix} ${fromTerminal} ${departTimeStr}. ${endPrefix} ${toTerminal} ${endTimeStr}.`;
};

export const TripTimelineCard = (props: TripTimelineCardProps) => {
  const { status, fromTerminal, toTerminal, startTime, departTime, endTime } =
    props;

  const [nowMs, setNowMs] = useState(() => Date.now());
  const isActive = status === "atDock" || status === "atSea";

  useEffect(() => {
    setNowMs(Date.now());
    if (!isActive) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

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

  return (
    <View
      className="px-4 py-2 w-full"
      accessibilityLabel={getAccessibilityLabel(
        status,
        fromTerminal,
        toTerminal,
        startTime,
        departTime,
        endTime
      )}
    >
      <View className="h-[64px]">
        <TripTimelineGraphic
          status={status}
          startTime={startTime}
          departTime={departTime}
          endTime={endTime}
          nowMs={nowMs}
          VesselName={props.VesselName}
          VesselStatus={props.VesselStatus}
        />
      </View>
    </View>
  );
};
