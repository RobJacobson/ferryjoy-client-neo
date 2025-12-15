import { useEffect, useState } from "react";
import { clamp } from "@/shared/utils";
import type { TripTimelineCardProps, TripTimelineCardStatus } from "./types";

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

export type TripTimelineCardModel = {
  isActive: boolean;
  departP: number;
  progressP: number;

  startFilled: boolean;
  departFilled: boolean;
  endFilled: boolean;

  accessibilityLabel: string;
};

export const useTripTimelineCardModel = ({
  status,
  fromTerminal,
  toTerminal,
  startTime,
  departTime,
  endTime,
}: TripTimelineCardProps): TripTimelineCardModel => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isActive = status === "atDock" || status === "atSea";

  useEffect(() => {
    setNowMs(Date.now());
    if (!isActive) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

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

  // Format times for accessibility label only (needs terminal names)
  const startTimeStr = formatTime12h(startTime);
  const departTimeStr = formatTime12h(departTime);
  const endTimeStr = formatTime12h(endTime);

  const startPrefix = status === "future" ? "ETA" : "Arrived";
  const departPrefix =
    status === "atSea" || status === "arrived" ? "Left" : "ETD";
  const endPrefix = status === "arrived" ? "Arrived" : "ETA";

  const accessibilityLabel = `Trip timeline: ${status}. ${startPrefix} ${fromTerminal} ${startTimeStr}. ${departPrefix} ${fromTerminal} ${departTimeStr}. ${endPrefix} ${toTerminal} ${endTimeStr}.`;

  const startFilled = STATUS_RANK[status] >= STATUS_RANK.atDock;
  const departFilled = STATUS_RANK[status] >= STATUS_RANK.atSea;
  const endFilled = STATUS_RANK[status] >= STATUS_RANK.arrived;

  return {
    isActive,
    departP,
    progressP: p,

    startFilled,
    departFilled,
    endFilled,

    accessibilityLabel,
  };
};
