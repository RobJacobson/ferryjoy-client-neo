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
    backgroundColor: "hsla(30, 67%, 95%, 1)",
    backgroundColors: [
      "hsla(18, 88%, 86%, 1)",
      "hsla(44, 92%, 84%, 1)",
      "hsla(345, 68%, 88%, 1)",
      "hsla(12, 76%, 90%, 1)",
    ],
    backgroundOverlayColor: "hsla(36, 100%, 98%, 0.22)",
    timelineTheme: createTimelineVisualTheme({
      track: {
        completedColor: "hsla(14, 76%, 54%, 1)",
        completedGlowColor: "hsla(14, 76%, 54%, 0.3)",
        remainingColor: "hsla(14, 61%, 56%, 0.28)",
      },
      cards: {
        fillColor: "hsla(36, 100%, 98%, 0.28)",
      },
      labels: {
        terminalNameColor: "hsla(332, 58%, 42%, 1)",
        eventLabelColor: "purple",
        // eventLabelColor: "hsla(355, 82%, 16%, 1)",
      },
      times: {
        textColor: "hsla(355, 82%, 16%, 1)",
        iconColor: "hsla(14, 76%, 54%, 1)",
      },
      marker: {
        pastFillColor: "hsla(14, 76%, 54%, 1)",
        pastBorderColor: "hsla(0, 0%, 100%, 0.96)",
        futureFillColor: "hsla(0, 0%, 100%, 0.96)",
        futureBorderColor: "hsla(14, 76%, 54%, 1)",
        pastIconTintColor: "hsla(0, 0%, 100%, 0.96)",
        futureIconTintColor: "hsla(14, 76%, 54%, 1)",
      },
      indicator: {
        badgeLabelColor: "hsla(14, 76%, 54%, 1)",
        bannerTitleColor: "hsla(355, 82%, 16%, 1)",
        bannerSubtitleColor: "hsla(355, 82%, 16%, 1)",
        borderColor: "hsla(14, 76%, 54%, 0.84)",
        ping: {
          insetPx: 0,
          borderWidth: 2,
          peakOpacity: 0.4,
          borderColor: "hsla(14, 76%, 54%, 0.5)",
          fillColor: "hsla(36, 100%, 98%, 0.24)",
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
