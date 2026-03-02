/**
 * Presentational card for in-transit vessel status content.
 */

import { Text, View } from "@/components/ui";

type InTransitEventCardProps = {
  vesselName: string;
  subtitle: string;
};

/**
 * Renders in-transit event content for a timeline row.
 *
 * @param vesselName - Vessel display name
 * @param subtitle - Supporting status detail text
 * @returns In-transit event card
 */
export const InTransitEventCard = ({
  vesselName,
  subtitle,
}: InTransitEventCardProps) => (
  <View className="rounded-lg border border-border bg-card p-3">
    <Text className="font-semibold text-base">{vesselName}</Text>
    <Text className="text-muted-foreground text-sm">{subtitle}</Text>
  </View>
);
