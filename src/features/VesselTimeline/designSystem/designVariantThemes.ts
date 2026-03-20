import type { VesselTimelineVariantThemeDefinition } from "./designVariantSchema";

/**
 * Placeholder authored themes for the VesselTimeline design system.
 *
 * Add new themes here using the small semantic palette defined in
 * `designVariantSchema.ts`.
 */
export const VESSEL_TIMELINE_VARIANT_THEME_DEFINITIONS: readonly VesselTimelineVariantThemeDefinition[] =
  [
    {
      id: "baseline-harbor",
      label: "Baseline Harbor",
      description: "A starter theme built from a small semantic palette.",
      palette: {
        canvas: "#F7F0E7",
        atmosphere: ["#9ED7D0", "#FFE1C9", "#C4E4FF", "#F5D1EB"],
        surface: "#F7F0E7",
        textStrong: "#1F3B57",
        text: "#5D6B82",
        accent: "#34D399",
        decorative: "#6B7FD7",
      },
    },
  ];
