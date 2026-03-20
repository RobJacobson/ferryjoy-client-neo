import type { TimelineVisualTheme } from "@/components/timeline";

export type VesselTimelineDesignVariant = {
  id: string;
  label: string;
  description: string;
  backgroundColor: string;
  backgroundColors: readonly string[];
  backgroundOverlayColor: string;
  timelineTheme: TimelineVisualTheme;
};

export type VesselTimelineVariantPalette = {
  canvas: string;
  atmosphere: readonly [string, string, string, string];
  text: {
    terminalName: string;
    row: string;
    indicatorLabel: string;
    indicatorBadge: string;
  };
  accent: {
    primary: string;
    trackGlow: string;
    trackRemaining: string;
    indicatorBorder: string;
    indicatorGlow: string;
  };
  marker: {
    past: {
      stroke: string;
      fill: string;
      icon: string;
    };
    future: {
      stroke: string;
      fill: string;
      icon: string;
    };
  };
  radarPingVariant?: TimelineVisualTheme["indicator"]["radarPingVariant"];
};

export type VesselTimelineVariantDefinition = {
  id: string;
  label: string;
  description: string;
  palette: VesselTimelineVariantPalette;
};

export type VesselTimelineVariantDefinitionInput = Omit<
  VesselTimelineVariantDefinition,
  "palette"
> & {
  palette?: Partial<VesselTimelineVariantPalette>;
};
