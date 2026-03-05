/**
 * Base timeline label component with title display.
 */

import type { PropsWithChildren } from "react";
import { Text, View } from "@/components/ui";

export type TimelineLabelProps = {
  title?: string;
  verb?: "Arrive" | "Arrived" | "Depart" | "Departed";
  terminal?: string;
};

export const TimelineLabel = ({
  title,
  verb,
  terminal,
}: PropsWithChildren<TimelineLabelProps>) => {
  const displayTitle = title ?? `${verb} ${terminal}`;
  return (
    <View className="mt-[-12px]">
      <Text className="font-semibold text-sm">{displayTitle}</Text>
    </View>
  );
};
