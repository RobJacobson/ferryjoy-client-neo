/**
 * Presentational card for arrival-related timeline content.
 */

import { Text, View } from "@/components/ui";

type ArriveEventCardProps = {
  title: string;
  subtitle: string;
};

/**
 * Renders arrival event content for a timeline row.
 *
 * @param title - Main arrival label
 * @param subtitle - Supporting arrival detail text
 * @returns Arrival event card
 */
export const ArriveEventCard = ({ title, subtitle }: ArriveEventCardProps) => (
  <View className="rounded-lg border border-border bg-card p-3">
    <Text className="font-semibold text-base">{title}</Text>
    <Text className="text-muted-foreground text-sm">{subtitle}</Text>
  </View>
);
