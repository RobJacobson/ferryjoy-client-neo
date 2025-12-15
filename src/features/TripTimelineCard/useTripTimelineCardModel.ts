import { useEffect, useMemo, useState } from "react";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import { clamp } from "@/shared/utils";
import type { TripTimelineCardProps, TripTimelineCardStatus } from "./types";

const HORIZONTAL_PADDING = 9; // padding applied in TripTimelineCard wrapper

const STATUS_RANK = {
  future: 0,
  atDock: 1,
  atSea: 2,
  arrived: 3,
} as const satisfies Record<TripTimelineCardStatus, number>;

const formatTime12h = (date: Date) =>
  date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export type TripTimelineCardLabel = { time: string; description: string };

export type TripTimelineCardModel = {
  trackWidth: number;
  onTrackLayout: (e: LayoutChangeEvent) => void;

  isActive: boolean;
  departP: number;
  progressP: number;
  progressX: number; // Still needed for knob/callout absolute positioning

  startFilled: boolean;
  departFilled: boolean;
  endFilled: boolean;

  calloutText: string;
  startLabel: TripTimelineCardLabel;
  departLabel: TripTimelineCardLabel;
  endLabel: TripTimelineCardLabel;
  accessibilityLabel: string;
};

export const useTripTimelineCardModel = ({
  direction,
  status,
  fromTerminal,
  toTerminal,
  startTime,
  departTime,
  endTime,
}: TripTimelineCardProps): TripTimelineCardModel => {
  const [trackWidth, setTrackWidth] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isActive = status === "atDock" || status === "atSea";

  useEffect(() => {
    setNowMs(Date.now());
    if (!isActive) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const computed = useMemo(() => {
    const t0 = startTime.getTime();
    const t1 = departTime.getTime();
    const t2 = endTime.getTime();

    const invalidOrdering = t1 < t0 || t2 < t1;
    if (invalidOrdering && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        "[TripTimelineCard] Invalid time ordering; expected start <= depart <= end."
      );
    }

    const total = Math.max(t2 - t0, 1);
    const rawDepartP = (t1 - t0) / total;
    const departP = invalidOrdering ? 0 : clamp(rawDepartP, 0, 1);

    let p = 0;

    if (invalidOrdering) {
      p = status === "arrived" ? 1 : 0;
    } else if (status === "future") {
      p = 0;
    } else if (status === "arrived") {
      p = 1;
    } else if (status === "atDock") {
      const dockDur = Math.max(t1 - t0, 1);
      const dockNow = clamp(nowMs, t0, t1);
      const dockFrac = (dockNow - t0) / dockDur;
      p = dockFrac * departP;
    } else {
      // atSea
      const seaDur = Math.max(t2 - t1, 1);
      const seaNow = clamp(nowMs, t1, t2);
      const seaFrac = (seaNow - t1) / seaDur;
      p = departP + seaFrac * (1 - departP);
    }

    p = clamp(p, 0, 1);

    const startTimeStr = formatTime12h(startTime);
    const departTimeStr = formatTime12h(departTime);
    const endTimeStr = formatTime12h(endTime);

    const startPrefix = status === "future" ? "ETA" : "Arrived";
    const departPrefix =
      status === "atSea" || status === "arrived" ? "Left" : "ETD";
    const endPrefix = status === "arrived" ? "Arrived" : "ETA";

    const startLabel: TripTimelineCardLabel = {
      time: startTimeStr,
      description: `${startPrefix}\n${fromTerminal}`,
    };
    const departLabel: TripTimelineCardLabel = {
      time: departTimeStr,
      description: `${departPrefix}\n${fromTerminal}`,
    };
    const endLabel: TripTimelineCardLabel = {
      time: endTimeStr,
      description: `${endPrefix}\n${toTerminal}`,
    };

    const accessibilityLabel = `Trip timeline: ${status}. ${startPrefix} ${fromTerminal} ${startTimeStr}. ${departPrefix} ${fromTerminal} ${departTimeStr}. ${endPrefix} ${toTerminal} ${endTimeStr}.`;

    return {
      departP,
      p,
      startLabel,
      departLabel,
      endLabel,
      accessibilityLabel,
    };
  }, [departTime, endTime, fromTerminal, nowMs, startTime, status, toTerminal]);

  const isEastward = direction === "eastward";

  // Calculate progressX for knob/callout absolute positioning
  // trackWidth is the full inner width (no padding), so we can use it directly
  const mapPToX = (P: number) => {
    if (trackWidth <= 0) return 0;
    return isEastward ? P * trackWidth : (1 - P) * trackWidth;
  };

  const progressX = mapPToX(computed.p);

  const startFilled = STATUS_RANK[status] >= STATUS_RANK.atDock;
  const departFilled = STATUS_RANK[status] >= STATUS_RANK.atSea;
  const endFilled = STATUS_RANK[status] >= STATUS_RANK.arrived;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const calloutText = formatTime12h(new Date(nowMs));

  return {
    trackWidth,
    onTrackLayout,

    isActive,
    departP: computed.departP,
    progressP: computed.p,
    progressX,

    startFilled,
    departFilled,
    endFilled,

    calloutText,
    startLabel: computed.startLabel,
    departLabel: computed.departLabel,
    endLabel: computed.endLabel,
    accessibilityLabel: computed.accessibilityLabel,
  };
};
