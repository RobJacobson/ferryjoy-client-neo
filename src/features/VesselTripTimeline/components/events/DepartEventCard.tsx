/**
 * Presentational card for departure-related timeline content.
 */

import { Text, View } from "@/components/ui";

type DepartEventCardProps = {
  title: string;
  subtitle: string;
};

/**
 * Renders departure event content for a timeline row.
 *
 * @param title - Main departure label
 * @param subtitle - Supporting departure detail text
 * @returns Departure event card
 */
export const DepartEventCard = ({ title, subtitle }: DepartEventCardProps) => (
  <View className="rounded-lg border border-border bg-card p-3">
    <Text className="font-semibold text-base">{title}</Text>
    <Text className="text-muted-foreground text-sm">{subtitle}</Text>
  </View>
);
