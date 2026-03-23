/**
 * VesselTimeline design variants: baseline tokens and helpers to define themes.
 *
 * Prefer `defineVesselTimelineVariant` with partial overrides over rebuilding
 * the full nested `TimelineVisualTheme` by hand.
 */

import {
  createTimelineVisualTheme,
  HARBOR_DAWN_TIMELINE_VISUAL_THEME,
  SEA_GLASS_TIMELINE_VISUAL_THEME,
  SIGNAL_NIGHT_TIMELINE_VISUAL_THEME,
} from "@/components/timeline";
import type {
  VesselTimelineDesignVariant,
  VesselTimelineVariantDefinition,
  VesselTimelineVariantDefinitionInput,
} from "./types";

/**
 * Baseline design variant used as the merge root for derived presets.
 */
export const DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT: VesselTimelineDesignVariant =
  {
    id: "sea-glass",
    label: "Sea Glass",
    description:
      "Cool coastal glass treatment with aqua accents and misty surfaces.",
    backgroundColor: "hsla(196, 45%, 93%, 1)",
    backgroundColors: [
      "hsla(188, 58%, 80%, 1)",
      "hsla(201, 52%, 84%, 1)",
      "hsla(178, 40%, 85%, 1)",
      "hsla(212, 54%, 88%, 1)",
    ],
    timelineTheme: SEA_GLASS_TIMELINE_VISUAL_THEME,
  };

/**
 * Merges caller input with the baseline variant to produce a full definition.
 *
 * @param input - Id, labels, optional background colors, optional timeline
 *   theme overrides
 * @returns Complete variant with merged `timelineTheme`
 */
export const defineVesselTimelineVariant = ({
  id,
  label,
  description,
  backgroundColor,
  backgroundColors,
  timelineTheme,
}: VesselTimelineVariantDefinitionInput): VesselTimelineVariantDefinition => ({
  id,
  label,
  description,
  backgroundColor:
    backgroundColor ?? DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT.backgroundColor,
  backgroundColors:
    backgroundColors ?? DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT.backgroundColors,
  timelineTheme: createTimelineVisualTheme({
    ...DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT.timelineTheme,
    ...timelineTheme,
  }),
});

/**
 * All registered variant definitions consumed by `variantRegistry`.
 */
export const VESSEL_TIMELINE_VARIANT_DEFINITIONS: readonly VesselTimelineVariantDefinition[] =
  [
    defineVesselTimelineVariant({
      id: "sea-glass",
      label: "Sea Glass",
      description: DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT.description,
    }),
    {
      id: "harbor-dawn",
      label: "Harbor Dawn",
      description:
        "Warm sunrise glass treatment with sand, coral, and soft harbor light.",
      backgroundColor: "hsla(31, 70%, 94%, 1)",
      backgroundColors: [
        "hsla(18, 88%, 84%, 1)",
        "hsla(39, 95%, 82%, 1)",
        "hsla(350, 70%, 88%, 1)",
        "hsla(14, 78%, 89%, 1)",
      ],
      timelineTheme: HARBOR_DAWN_TIMELINE_VISUAL_THEME,
    },
    {
      id: "signal-night",
      label: "Signal Night",
      description:
        "Dark marine glass treatment with teal depth and bright signal accents.",
      backgroundColor: "hsla(195, 34%, 13%, 1)",
      backgroundColors: [
        "hsla(193, 44%, 18%, 1)",
        "hsla(181, 42%, 16%, 1)",
        "hsla(205, 38%, 20%, 1)",
        "hsla(168, 32%, 18%, 1)",
      ],
      timelineTheme: SIGNAL_NIGHT_TIMELINE_VISUAL_THEME,
    },
  ];

/**
 * Id of the default design variant when the app does not select another.
 */
export const DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID = "sea-glass";
