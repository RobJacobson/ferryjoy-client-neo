/**
 * Types for vessel-day timeline design variants and theme override authoring.
 */

import type {
  TimelineVisualTheme,
  TimelineVisualThemeOverrides,
} from "@/components/timeline";

export type VesselTimelineDesignVariant = {
  id: string;
  label: string;
  description: string;
  backgroundColor: string;
  backgroundColors: readonly string[];
  timelineTheme: TimelineVisualTheme;
};

export type VesselTimelineVariantDefinitionInput = {
  id: string;
  label: string;
  description: string;
  backgroundColor?: string;
  backgroundColors?: readonly string[];
  timelineTheme?: TimelineVisualThemeOverrides;
};
