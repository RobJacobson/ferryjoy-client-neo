/**
 * Base timeline label component with title display.
 */

import type { PropsWithChildren } from "react";
import { Text, View } from "@/components/ui";

export type TimelineLabelProps = {
  title: string;
};

export const TimelineLabel = ({
  title,
}: PropsWithChildren<TimelineLabelProps>) => {
  return (
    <View className="mt-[-12px]">
      <Text className="font-semibold text-base">{title}</Text>
    </View>
  );
};
