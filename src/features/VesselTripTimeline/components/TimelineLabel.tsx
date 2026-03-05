/**
 * Base timeline label component with terminal name display.
 */

import { Text, View } from "@/components/ui";

export type TimelineLabelProps = {
  terminal?: string;
};

/**
 * Renders a timeline label with terminal name.
 *
 * @param terminal - Terminal name to display
 * @returns Timeline label component
 */
export const TimelineLabel = ({ terminal }: TimelineLabelProps) => (
  <View className="mt-[-14px]">
    <Text className="font-playpen-400 text-xl">{terminal}</Text>
  </View>
);
