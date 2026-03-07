/**
 * Reusable label content for timeline row slots.
 * Can be positioned on either the left or right slot.
 */

import { Text, View } from "@/components/ui";

type RowContentLabelProps = {
  terminal?: string;
  status?: "arrive" | "depart";
  past?: boolean;
};

/**
 * Renders a timeline row label.
 *
 * @param terminal - Terminal name to display
 * @param status - Status of the row ("arrive" or "depart")
 * @param past - Whether the row is in the past
 * @returns Label view
 */
export const RowContentLabel = ({
  terminal,
  status,
  past,
}: RowContentLabelProps) => {
  const label =
    status === "arrive"
      ? past
        ? "Arrived"
        : "Arrive"
      : past
        ? "Departed to"
        : "Depart to";
  return (
    terminal && (
      <View className="mt-[-14px] align-right">
        <Text className="text-xs uppercase">{label}</Text>
        <Text className="">{terminal}</Text>
      </View>
    )
  );
};
