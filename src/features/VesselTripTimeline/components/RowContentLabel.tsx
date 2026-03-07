/**
 * Reusable label content for timeline row slots.
 * Can be positioned on either the left or right slot.
 */

import { Text, View } from "@/components/ui";

type RowContentLabelProps = {
  label?: string;
};

/**
 * Renders a timeline row label.
 *
 * @param label - Label text to display
 * @returns Label view
 */
export const RowContentLabel = ({ label }: RowContentLabelProps) =>
  label ? (
    <View className="mt-[-14px]">
      <Text className="font-playpen-400 text-xl">{label}</Text>
    </View>
  ) : null;
