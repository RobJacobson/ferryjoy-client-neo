/**
 * VesselTimeline design variants: baseline tokens and helpers to define themes.
 *
 * Prefer `defineVesselTimelineVariant` with partial overrides over rebuilding
 * the full nested `TimelineVisualTheme` by hand.
 */

import {
  CARNIVAL_FIZZ_TIMELINE_VISUAL_THEME,
  CONFETTI_TIDE_TIMELINE_VISUAL_THEME,
  HARBOR_DAWN_TIMELINE_VISUAL_THEME,
  KELP_DISCO_TIMELINE_VISUAL_THEME,
  MOON_JELLY_TIMELINE_VISUAL_THEME,
  PICNIC_POSTCARD_TIMELINE_VISUAL_THEME,
  SEA_GLASS_TIMELINE_VISUAL_THEME,
  TAFFY_HARBOR_TIMELINE_VISUAL_THEME,
  createTimelineVisualTheme,
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
      "hsla(176, 46%, 84%, 1)",
      "hsla(201, 52%, 84%, 1)",
      "hsla(193, 61%, 78%, 1)",
      "hsla(178, 40%, 85%, 1)",
      "hsla(212, 54%, 88%, 1)",
      "hsla(187, 48%, 82%, 1)",
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
        "hsla(28, 93%, 78%, 1)",
        "hsla(39, 95%, 82%, 1)",
        "hsla(350, 70%, 88%, 1)",
        "hsla(8, 84%, 82%, 1)",
        "hsla(14, 78%, 89%, 1)",
        "hsla(42, 88%, 86%, 1)",
      ],
      timelineTheme: HARBOR_DAWN_TIMELINE_VISUAL_THEME,
    },
    {
      id: "carnival-fizz",
      label: "Carnival Fizz",
      description:
        "Sunlit boardwalk energy with citrus soda colors and breezy blue glass.",
      backgroundColor: "hsla(46, 100%, 96%, 1)",
      backgroundColors: [
        "hsla(28, 100%, 72%, 1)",
        "hsla(46, 100%, 76%, 1)",
        "hsla(191, 76%, 76%, 1)",
        "hsla(14, 92%, 74%, 1)",
        "hsla(171, 67%, 73%, 1)",
        "hsla(53, 100%, 81%, 1)",
        "hsla(200, 80%, 83%, 1)",
      ],
      timelineTheme: CARNIVAL_FIZZ_TIMELINE_VISUAL_THEME,
    },
    {
      id: "taffy-harbor",
      label: "Taffy Harbor",
      description:
        "Candy-shop marina pastels with rosy glass, peach highlights, and soft blue shadows.",
      backgroundColor: "hsla(334, 100%, 97%, 1)",
      backgroundColors: [
        "hsla(330, 81%, 81%, 1)",
        "hsla(19, 100%, 82%, 1)",
        "hsla(204, 86%, 83%, 1)",
        "hsla(41, 100%, 83%, 1)",
        "hsla(312, 74%, 85%, 1)",
        "hsla(192, 80%, 86%, 1)",
        "hsla(24, 100%, 85%, 1)",
      ],
      timelineTheme: TAFFY_HARBOR_TIMELINE_VISUAL_THEME,
    },
    {
      id: "kelp-disco",
      label: "Kelp Disco",
      description:
        "A moody underwater dance floor with electric lime accents and glossy seaweed glow.",
      backgroundColor: "hsla(160, 35%, 14%, 1)",
      backgroundColors: [
        "hsla(162, 46%, 20%, 1)",
        "hsla(146, 59%, 24%, 1)",
        "hsla(174, 42%, 18%, 1)",
        "hsla(52, 89%, 33%, 1)",
        "hsla(156, 70%, 28%, 1)",
        "hsla(168, 39%, 22%, 1)",
        "hsla(144, 54%, 19%, 1)",
      ],
      timelineTheme: KELP_DISCO_TIMELINE_VISUAL_THEME,
    },
    {
      id: "confetti-tide",
      label: "Confetti Tide",
      description:
        "A playful postcard palette with sky blues, party coral, and vacation-sun sparkle.",
      backgroundColor: "hsla(204, 100%, 97%, 1)",
      backgroundColors: [
        "hsla(198, 93%, 80%, 1)",
        "hsla(12, 95%, 77%, 1)",
        "hsla(49, 100%, 79%, 1)",
        "hsla(219, 92%, 85%, 1)",
        "hsla(184, 71%, 79%, 1)",
        "hsla(339, 88%, 84%, 1)",
        "hsla(203, 93%, 83%, 1)",
        "hsla(42, 100%, 83%, 1)",
      ],
      timelineTheme: CONFETTI_TIDE_TIMELINE_VISUAL_THEME,
    },
    {
      id: "moon-jelly",
      label: "Moon Jelly",
      description:
        "Dreamy twilight candy tones with lavender jelly glow and cool moonlit shimmer.",
      backgroundColor: "hsla(230, 68%, 97%, 1)",
      backgroundColors: [
        "hsla(269, 86%, 82%, 1)",
        "hsla(197, 96%, 83%, 1)",
        "hsla(316, 78%, 86%, 1)",
        "hsla(240, 89%, 88%, 1)",
        "hsla(186, 80%, 85%, 1)",
        "hsla(280, 73%, 85%, 1)",
        "hsla(208, 92%, 88%, 1)",
      ],
      timelineTheme: MOON_JELLY_TIMELINE_VISUAL_THEME,
    },
    {
      id: "picnic-postcard",
      label: "Picnic Postcard",
      description:
        "Sunny retro holiday colors with strawberry red, butter yellow, and grassy charm.",
      backgroundColor: "hsla(54, 88%, 96%, 1)",
      backgroundColors: [
        "hsla(356, 90%, 79%, 1)",
        "hsla(48, 100%, 77%, 1)",
        "hsla(100, 56%, 78%, 1)",
        "hsla(28, 100%, 79%, 1)",
        "hsla(14, 91%, 80%, 1)",
        "hsla(71, 72%, 82%, 1)",
        "hsla(44, 100%, 84%, 1)",
      ],
      timelineTheme: PICNIC_POSTCARD_TIMELINE_VISUAL_THEME,
    },
  ];

/**
 * Id of the default design variant when the app does not select another.
 */
export const DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID = "sea-glass";
