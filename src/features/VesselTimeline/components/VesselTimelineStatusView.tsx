/**
 * Shared centered fallback view for loading, error, and empty timeline states.
 */

import type { ReactNode } from "react";
import { Text, View } from "@/components/ui";

export type VesselTimelineStatusViewProps = {
  message: string;
  detail?: string;
  action?: ReactNode;
  tone?: "default" | "destructive";
};

/**
 * Renders centered status content for non-ready VesselTimeline states.
 *
 * @param props - Status view props
 * @param props.message - Primary centered message
 * @param props.detail - Optional secondary detail text
 * @param props.action - Optional trailing action such as retry
 * @param props.tone - Visual tone for the primary message
 * @returns Centered fallback content
 */
export const VesselTimelineStatusView = ({
  message,
  detail,
  action,
  tone = "default",
}: VesselTimelineStatusViewProps) => (
  <View className="flex-1 items-center justify-center px-6">
    <Text
      className={
        tone === "destructive"
          ? "font-semibold text-destructive text-lg"
          : "font-semibold text-lg"
      }
    >
      {message}
    </Text>
    {detail ? (
      <Text className="mt-2 text-center text-muted-foreground text-sm">
        {detail}
      </Text>
    ) : null}
    {action}
  </View>
);
