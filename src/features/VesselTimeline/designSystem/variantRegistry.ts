import { createTimelineVisualTheme } from "@/components/timeline";
import { VESSEL_TIMELINE_BASE_TOKENS } from "./sharedTokens";
import type {
  VesselTimelineDesignVariant,
  VesselTimelineVariantDefinition,
} from "./types";
import {
  DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID,
  VESSEL_TIMELINE_VARIANT_DEFINITIONS,
} from "./variantDefinitions";

export const createVesselTimelineDesignVariant = ({
  id,
  label,
  description,
  palette,
}: VesselTimelineVariantDefinition): VesselTimelineDesignVariant => {
  const tokens = VESSEL_TIMELINE_BASE_TOKENS;

  return {
    id,
    label,
    description,
    backgroundColor: palette.canvas,
    backgroundColors: palette.atmosphere,
    backgroundOverlayColor: tokens.atmosphere.gradientWash,
    timelineTheme: createTimelineVisualTheme({
      track: {
        completedColor: palette.accent.primary,
        completedGlowColor: palette.accent.trackGlow,
        remainingColor: palette.accent.trackRemaining,
      },
      labels: {
        terminalNameColor: palette.text.terminalName,
        eventLabelColor: palette.text.row,
      },
      times: {
        textColor: palette.text.row,
        iconColor: palette.accent.primary,
      },
      marker: {
        pastFillColor: palette.marker.past.fill,
        pastBorderColor: palette.marker.past.stroke,
        futureFillColor: palette.marker.future.fill,
        futureBorderColor: palette.marker.future.stroke,
        pastIconTintColor: palette.marker.past.icon,
        futureIconTintColor: palette.marker.future.icon,
      },
      indicator: {
        badgeTextColor: palette.text.indicatorBadge,
        titleColor: palette.text.indicatorLabel,
        subtitleColor: palette.text.indicatorLabel,
        glassBorderColor: palette.accent.indicatorBorder,
        glowColor: palette.accent.indicatorGlow,
        radarPingVariant: palette.radarPingVariant ?? "harbor-emerald",
      },
    }),
  };
};

export const VESSEL_TIMELINE_DESIGN_VARIANTS: readonly VesselTimelineDesignVariant[] =
  VESSEL_TIMELINE_VARIANT_DEFINITIONS.map(createVesselTimelineDesignVariant);

export const getVesselTimelineDesignVariant = (variantId?: string) =>
  VESSEL_TIMELINE_DESIGN_VARIANTS.find((variant) => variant.id === variantId) ??
  VESSEL_TIMELINE_DESIGN_VARIANTS.find(
    (variant) => variant.id === DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID
  ) ??
  VESSEL_TIMELINE_DESIGN_VARIANTS[0];
