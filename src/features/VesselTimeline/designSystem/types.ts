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
  backgroundOverlayColor: string;
  timelineTheme: TimelineVisualTheme;
};

export type VesselTimelineVariantDefinition = VesselTimelineDesignVariant;

export type VesselTimelineVariantDefinitionInput = {
  id: string;
  label: string;
  description: string;
  backgroundColor?: string;
  backgroundColors?: readonly [string, string, string, string];
  backgroundOverlayColor?: string;
  timelineTheme?: TimelineVisualThemeOverrides;
};
