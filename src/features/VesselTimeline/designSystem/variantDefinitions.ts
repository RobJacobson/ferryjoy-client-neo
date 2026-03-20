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
        completedColor: "hsla(156, 72%, 45%, 1)",
        completedGlowColor: "hsla(156, 72%, 45%, 0.32)",
        remainingColor: "hsla(156, 72%, 45%, 0.45)",
      },
      labels: {
        terminalNameColor: "hsla(225, 42%, 55%, 1)",
        eventLabelColor: "hsla(217, 41%, 17%, 1)",
      },
      times: {
        textColor: "hsla(217, 41%, 17%, 1)",
        iconColor: "hsla(156, 72%, 45%, 1)",
      },
      marker: {
        pastFillColor: "hsla(156, 72%, 45%, 1)",
        pastBorderColor: "hsla(0, 0%, 100%, 0.96)",
        futureFillColor: "hsla(0, 0%, 100%, 0.96)",
        futureBorderColor: "hsla(156, 72%, 45%, 1)",
        pastIconTintColor: "hsla(0, 0%, 100%, 0.96)",
        futureIconTintColor: "hsla(156, 72%, 45%, 1)",
      },
      indicator: {
        badgeLabelColor: "hsla(156, 72%, 45%, 1)",
        bannerTitleColor: "hsla(217, 41%, 17%, 1)",
        bannerSubtitleColor: "hsla(217, 41%, 17%, 1)",
        borderColor: "hsla(156, 72%, 45%, 0.88)",
        ping: {
          insetPx: 0,
          borderWidth: 2,
          peakOpacity: 0.42,
          borderColor: "hsla(156, 72%, 45%, 0.55)",
          fillColor: "hsla(0, 0%, 100%, 0.2)",
        },
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
