/**
 * Static demo data for TimelinePrototype feature.
 */

import type { TimelineRow } from "@/components/Timeline";
import { Text, View } from "@/components/ui";

/**
 * Creates static rows for the vertical timeline prototype.
 *
 * @returns Timeline rows with Date ranges and per-row completion
 */
export const createStaticTimelineRows = (): TimelineRow[] => {
  const departure = new Date("2026-03-01T09:00:00-08:00");
  const leaveDock = new Date("2026-03-01T09:15:00-08:00");
  const arriveNext = new Date("2026-03-01T10:05:00-08:00");
  const complete = new Date("2026-03-01T10:15:00-08:00");

  return [
    {
      id: "arrive-origin",
      startTime: departure,
      endTime: leaveDock,
      percentComplete: 1,
      rightContent: (
        <View className="rounded-lg border border-border bg-card p-3">
          <Text className="font-semibold text-base">Arrive SEA</Text>
          <Text className="text-muted-foreground text-sm">Scheduled 9:00</Text>
        </View>
      ),
    },
    {
      id: "at-sea",
      startTime: leaveDock,
      endTime: arriveNext,
      percentComplete: 0.56,
      leftContent: (
        <View className="rounded-lg border border-border bg-card p-3">
          <Text className="font-semibold text-base">MV Tacoma</Text>
          <Text className="text-muted-foreground text-sm">
            16 kn · 8.1 mi to destination
          </Text>
        </View>
      ),
      rightContent: (
        <View className="rounded-lg border border-border bg-card p-3">
          <Text className="font-semibold text-base">Arrive BI</Text>
          <Text className="text-muted-foreground text-sm">ETA 10:03</Text>
        </View>
      ),
      indicatorContent: (
        <Text className="font-bold text-green-600 text-xs">27m</Text>
      ),
    },
    {
      id: "arrive-destination",
      startTime: arriveNext,
      endTime: complete,
      percentComplete: 0,
      rightContent: (
        <View className="rounded-lg border border-border bg-card p-3">
          <Text className="font-semibold text-base">Dock BI</Text>
          <Text className="text-muted-foreground text-sm">Scheduled 10:05</Text>
        </View>
      ),
    },
  ];
};
