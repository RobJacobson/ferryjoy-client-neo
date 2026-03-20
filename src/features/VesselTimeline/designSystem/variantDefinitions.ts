import { createTimelineVisualTheme } from "@/components/timeline";
import type {
  VesselTimelineDesignVariant,
  VesselTimelineVariantDefinition,
  VesselTimelineVariantDefinitionInput,
} from "./types";

/**
 * Baseline authoring template for future themes.
 *
 * New variants should usually override this direct variant definition rather
 * than rebuilding the entire timeline theme from scratch.
 */
export const DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT: VesselTimelineDesignVariant =
  {
    id: "baseline-harbor",
    label: "Baseline Harbor",
    description:
      "Default vessel timeline theme and authoring template for future variants.",
    backgroundColor: "hsla(34, 50%, 94%, 1)",
    backgroundColors: [
      "hsla(173, 42%, 73%, 1)",
      "hsla(27, 100%, 89%, 1)",
      "hsla(207, 100%, 88%, 1)",
      "hsla(317, 64%, 89%, 1)",
    ],
    backgroundOverlayColor: "hsla(0, 0%, 100%, 0.2)",
    timelineTheme: createTimelineVisualTheme({
      track: {
        completedColor: "hsla(158, 64%, 52%, 1)",
        completedGlowColor: "hsla(158, 64%, 52%, 0.2)",
        remainingColor: "hsla(158, 64%, 52%, 0.3)",
      },
      labels: {
        terminalNameColor: "hsla(229, 57%, 63%, 1)",
        eventLabelColor: "hsla(210, 47%, 23%, 1)",
      },
      times: {
        textColor: "hsla(210, 47%, 23%, 1)",
        iconColor: "hsla(158, 64%, 52%, 1)",
      },
      marker: {
        pastFillColor: "hsla(158, 64%, 52%, 1)",
        pastBorderColor: "hsla(0, 0%, 100%, 0.9)",
        futureFillColor: "hsla(0, 0%, 100%, 0.9)",
        futureBorderColor: "hsla(158, 64%, 52%, 1)",
        pastIconTintColor: "hsla(0, 0%, 100%, 0.9)",
        futureIconTintColor: "hsla(158, 64%, 52%, 1)",
      },
      indicator: {
        badgeTextColor: "hsla(158, 64%, 52%, 1)",
        titleColor: "hsla(210, 47%, 23%, 1)",
        subtitleColor: "hsla(210, 47%, 23%, 1)",
        glassBorderColor: "hsla(158, 64%, 52%, 0.82)",
        glowColor: "hsla(158, 64%, 52%, 0.24)",
        radarPingVariant: "harbor-emerald",
      },
    }),
  };

export const defineVesselTimelineVariant = ({
  id,
  label,
  description,
  backgroundColor,
  backgroundColors,
  backgroundOverlayColor,
  timelineTheme,
}: VesselTimelineVariantDefinitionInput): VesselTimelineVariantDefinition => ({
  id,
  label,
  description,
  backgroundColor:
    backgroundColor ?? DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT.backgroundColor,
  backgroundColors:
    backgroundColors ?? DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT.backgroundColors,
  backgroundOverlayColor:
    backgroundOverlayColor ??
    DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT.backgroundOverlayColor,
  timelineTheme: createTimelineVisualTheme({
    ...DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT.timelineTheme,
    ...timelineTheme,
  }),
});

export const VESSEL_TIMELINE_VARIANT_DEFINITIONS: readonly VesselTimelineVariantDefinition[] =
  [
    defineVesselTimelineVariant({
      id: "baseline-harbor",
      label: "Baseline Harbor",
      description: DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT.description,
    }),
  ];

export const DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID = "baseline-harbor";
