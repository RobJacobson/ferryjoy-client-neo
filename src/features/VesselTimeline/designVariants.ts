import type { TimelineVisualTheme } from "@/components/timeline";
import { DEFAULT_TIMELINE_VISUAL_THEME } from "@/components/timeline";

export type VesselTimelineDesignVariant = {
  id: string;
  label: string;
  description: string;
  backgroundColor: string;
  backgroundColors: readonly string[];
  backgroundOverlayColor: string;
  titleColor: string;
  bodyColor: string;
  selectorBackgroundColor: string;
  selectorBorderColor: string;
  selectorTextColor: string;
  timelineTheme: TimelineVisualTheme;
};

type TimelineVisualThemeOverrides = {
  [Section in keyof TimelineVisualTheme]?: Partial<
    TimelineVisualTheme[Section]
  >;
};

const createTheme = (
  partial: TimelineVisualThemeOverrides
): TimelineVisualTheme => ({
  ...DEFAULT_TIMELINE_VISUAL_THEME,
  ...partial,
  track: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.track,
    ...partial.track,
  },
  cards: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.cards,
    ...partial.cards,
  },
  labels: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.labels,
    ...partial.labels,
  },
  times: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.times,
    ...partial.times,
  },
  marker: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.marker,
    ...partial.marker,
  },
  indicator: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.indicator,
    ...partial.indicator,
  },
});

export const DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID = "harbor-glass";

export const VESSEL_TIMELINE_DESIGN_VARIANTS: readonly VesselTimelineDesignVariant[] =
  [
    {
      id: "harbor-glass",
      label: "Harbor Glass",
      description: "Softened glass cards with a seafoam progress glow.",
      backgroundColor: "#F7F0E7",
      backgroundColors: ["#9ED7D0", "#FFE1C9", "#C4E4FF", "#F5D1EB"],
      backgroundOverlayColor: "rgba(255,255,255,0.18)",
      titleColor: "#14213D",
      bodyColor: "#5D6B82",
      selectorBackgroundColor: "rgba(255,255,255,0.85)",
      selectorBorderColor: "rgba(255,255,255,0.95)",
      selectorTextColor: "#14213D",
      timelineTheme: createTheme({
        track: {
          completedColor: "#34D399",
          completedGlowColor: "rgba(52, 211, 153, 0.34)",
          remainingColor: "rgba(255, 255, 255, 0.72)",
        },
        labels: {
          terminalNameColor: "#B76EF0",
          eventLabelColor: "#6B3FD6",
        },
      }),
    },
    {
      id: "pastel-bloom",
      label: "Pastel Bloom",
      description: "Gentle peach, mint, and lilac with airy cards.",
      backgroundColor: "#FFF7F3",
      backgroundColors: ["#FFC8D8", "#D4F5E2", "#CFE0FF", "#FFE8B5"],
      backgroundOverlayColor: "rgba(255,255,255,0.22)",
      titleColor: "#3F3351",
      bodyColor: "#7B708B",
      selectorBackgroundColor: "rgba(255,255,255,0.88)",
      selectorBorderColor: "rgba(255,255,255,0.95)",
      selectorTextColor: "#3F3351",
      timelineTheme: createTheme({
        track: {
          completedColor: "#FB7185",
          completedGlowColor: "rgba(251, 113, 133, 0.26)",
          remainingColor: "rgba(255, 228, 230, 0.88)",
        },
        cards: {
          fillColor: "rgba(255,255,255,0.42)",
          borderColor: "rgba(255,255,255,0.96)",
        },
        labels: {
          terminalNameColor: "#F472B6",
          eventLabelColor: "#A855F7",
        },
        times: {
          textColor: "#9333EA",
          iconColor: "#DB2777",
        },
        marker: {
          pastFillColor: "#FB7185",
          futureBorderColor: "#F472B6",
          futureIconTintColor: "rgba(244,114,182,0.88)",
          shadowColor: "#FDA4AF",
        },
        indicator: {
          badgeTextColor: "#9D174D",
          titleColor: "#86198F",
          subtitleColor: "#9D174D",
          glassBorderColor: "rgba(244, 114, 182, 0.95)",
          glowColor: "rgba(244, 114, 182, 0.42)",
          radarPingVariant: "glass-orchid",
        },
      }),
    },
    {
      id: "sea-neon",
      label: "Sea Neon",
      description: "A brighter luminous track with cooler aqua energy.",
      backgroundColor: "#EEF8F5",
      backgroundColors: ["#7EE7D6", "#B6D8FF", "#FFD6EC", "#FFF3B5"],
      backgroundOverlayColor: "rgba(255,255,255,0.16)",
      titleColor: "#0C2338",
      bodyColor: "#48657D",
      selectorBackgroundColor: "rgba(246,255,252,0.84)",
      selectorBorderColor: "rgba(183,255,228,0.92)",
      selectorTextColor: "#0C2338",
      timelineTheme: createTheme({
        track: {
          coreWidthPx: 5,
          glowWidthPx: 18,
          completedColor: "#14B8A6",
          completedGlowColor: "rgba(45, 212, 191, 0.5)",
          remainingColor: "rgba(153, 246, 228, 0.28)",
        },
        cards: {
          fillColor: "rgba(247,255,254,0.28)",
          borderColor: "rgba(204,255,246,0.82)",
          shadowColor: "#99F6E4",
          shadowOpacity: 0.22,
          shadowRadius: 22,
        },
        labels: {
          terminalNameColor: "#8B5CF6",
          eventLabelColor: "#0F766E",
          eventLabelShadowColor: "rgba(255,255,255,0.9)",
        },
        times: {
          textColor: "#155E75",
          iconColor: "#14B8A6",
        },
        marker: {
          pastFillColor: "#14B8A6",
          pastBorderColor: "rgba(204,251,241,0.9)",
          futureBorderColor: "#2DD4BF",
          futureIconTintColor: "rgba(20,184,166,0.9)",
          shadowColor: "#2DD4BF",
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        indicator: {
          badgeTextColor: "#115E59",
          titleColor: "#0F766E",
          subtitleColor: "#0F766E",
          glassBorderColor: "rgba(45, 212, 191, 0.95)",
          glowColor: "rgba(45, 212, 191, 0.56)",
          glowOpacity: 0.42,
          glowRadius: 18,
          radarPingVariant: "harbor-emerald",
        },
      }),
    },
    {
      id: "paper-dawn",
      label: "Paper Dawn",
      description:
        "Warmer, flatter, paper-cut tones with calmer type contrast.",
      backgroundColor: "#FAF4E8",
      backgroundColors: ["#F8D6C2", "#B9E4D0", "#F7E8A4", "#D9DCF7"],
      backgroundOverlayColor: "rgba(255,250,245,0.28)",
      titleColor: "#2F2A2A",
      bodyColor: "#6E625D",
      selectorBackgroundColor: "rgba(255,250,245,0.88)",
      selectorBorderColor: "rgba(240,226,208,0.95)",
      selectorTextColor: "#2F2A2A",
      timelineTheme: createTheme({
        cards: {
          fillColor: "rgba(255,250,245,0.58)",
          borderColor: "rgba(234,214,192,0.95)",
          shadowColor: "#D6C2A8",
          shadowOpacity: 0.16,
          shadowRadius: 14,
        },
        labels: {
          terminalNameFontClassName: "font-puffberry text-3xl",
          terminalNameColor: "#D97706",
          eventLabelColor: "#92400E",
        },
        times: {
          textColor: "#7C2D12",
          iconColor: "#EA580C",
        },
        track: {
          completedColor: "#10B981",
          completedGlowColor: "rgba(16, 185, 129, 0.22)",
          remainingColor: "rgba(209, 250, 229, 0.7)",
        },
        marker: {
          pastFillColor: "#F59E0B",
          pastBorderColor: "rgba(255,247,237,0.9)",
          futureBorderColor: "#F59E0B",
          futureIconTintColor: "rgba(217,119,6,0.9)",
          shadowColor: "#FCD34D",
        },
        indicator: {
          badgeTextColor: "#92400E",
          titleColor: "#92400E",
          subtitleColor: "#7C2D12",
          glassBorderColor: "rgba(245, 158, 11, 0.85)",
          glowColor: "rgba(245, 158, 11, 0.32)",
          radarPingVariant: "tidal-mix",
        },
      }),
    },
    {
      id: "kawaii-sky",
      label: "Kawaii Sky",
      description: "Leans into the pink-sky energy from the homescreen.",
      backgroundColor: "#FFF2F7",
      backgroundColors: ["#FF9DCE", "#9CDCF7", "#B8F2C6", "#FFD6A5"],
      backgroundOverlayColor: "rgba(255,255,255,0.14)",
      titleColor: "#35264C",
      bodyColor: "#765B93",
      selectorBackgroundColor: "rgba(255,245,250,0.88)",
      selectorBorderColor: "rgba(255,210,234,0.95)",
      selectorTextColor: "#35264C",
      timelineTheme: createTheme({
        track: {
          completedColor: "#EC4899",
          completedGlowColor: "rgba(236, 72, 153, 0.34)",
          remainingColor: "rgba(251, 207, 232, 0.5)",
        },
        cards: {
          fillColor: "rgba(255,255,255,0.34)",
          borderColor: "rgba(255,224,244,0.95)",
        },
        labels: {
          terminalNameColor: "#C026D3",
          eventLabelColor: "#9333EA",
        },
        times: {
          textColor: "#7E22CE",
          iconColor: "#EC4899",
        },
        marker: {
          pastFillColor: "#F472B6",
          futureBorderColor: "#F472B6",
          futureIconTintColor: "rgba(244,114,182,0.88)",
          shadowColor: "#F9A8D4",
        },
        indicator: {
          badgeTextColor: "#A21CAF",
          titleColor: "#A21CAF",
          subtitleColor: "#86198F",
          glassBorderColor: "rgba(236, 72, 153, 0.95)",
          glowColor: "rgba(236, 72, 153, 0.42)",
          radarPingVariant: "glass-orchid",
        },
      }),
    },
    {
      id: "foggy-morning",
      label: "Foggy Morning",
      description: "Muted harbor blues with a restrained nautical calm.",
      backgroundColor: "#F2F5F7",
      backgroundColors: ["#C9D8E6", "#E9D8C8", "#DCEBE3", "#EAEAF4"],
      backgroundOverlayColor: "rgba(255,255,255,0.24)",
      titleColor: "#233342",
      bodyColor: "#607284",
      selectorBackgroundColor: "rgba(250,252,253,0.9)",
      selectorBorderColor: "rgba(223,231,237,0.95)",
      selectorTextColor: "#233342",
      timelineTheme: createTheme({
        track: {
          completedColor: "#64748B",
          completedGlowColor: "rgba(100, 116, 139, 0.22)",
          remainingColor: "rgba(203, 213, 225, 0.85)",
        },
        cards: {
          fillColor: "rgba(255,255,255,0.5)",
          borderColor: "rgba(226,232,240,0.95)",
          shadowColor: "#CBD5E1",
        },
        labels: {
          terminalNameColor: "#64748B",
          eventLabelColor: "#334155",
          eventLabelShadowColor: "rgba(255,255,255,0.85)",
        },
        times: {
          textColor: "#334155",
          iconColor: "#64748B",
        },
        marker: {
          pastFillColor: "#64748B",
          futureBorderColor: "#94A3B8",
          futureIconTintColor: "rgba(100,116,139,0.82)",
          shadowColor: "#CBD5E1",
        },
        indicator: {
          badgeTextColor: "#334155",
          titleColor: "#334155",
          subtitleColor: "#475569",
          glassBorderColor: "rgba(148, 163, 184, 0.9)",
          glowColor: "rgba(148, 163, 184, 0.26)",
          radarPingVariant: "tidal-mix",
        },
      }),
    },
    {
      id: "bioluminescent",
      label: "Bioluminescent",
      description: "An aquatic glow treatment with deeper contrast.",
      backgroundColor: "#E7F5F3",
      backgroundColors: ["#67E8F9", "#A7F3D0", "#BAE6FD", "#C4B5FD"],
      backgroundOverlayColor: "rgba(231,255,251,0.12)",
      titleColor: "#083344",
      bodyColor: "#155E75",
      selectorBackgroundColor: "rgba(236,255,252,0.8)",
      selectorBorderColor: "rgba(103,232,249,0.48)",
      selectorTextColor: "#083344",
      timelineTheme: createTheme({
        track: {
          coreWidthPx: 5,
          glowWidthPx: 20,
          completedColor: "#22D3EE",
          completedGlowColor: "rgba(34, 211, 238, 0.56)",
          remainingColor: "rgba(125, 211, 252, 0.26)",
        },
        cards: {
          fillColor: "rgba(236,255,252,0.18)",
          borderColor: "rgba(165,243,252,0.66)",
          shadowColor: "#22D3EE",
          shadowOpacity: 0.2,
          shadowRadius: 24,
        },
        labels: {
          terminalNameColor: "#0EA5E9",
          eventLabelColor: "#0F766E",
          eventLabelShadowColor: "rgba(232,255,255,0.75)",
        },
        times: {
          textColor: "#0E7490",
          iconColor: "#06B6D4",
        },
        marker: {
          pastFillColor: "#0891B2",
          pastBorderColor: "rgba(165,243,252,0.8)",
          futureFillColor: "rgba(240,253,250,0.92)",
          futureBorderColor: "#06B6D4",
          futureIconTintColor: "rgba(6,182,212,0.92)",
          shadowColor: "#22D3EE",
          shadowOpacity: 0.32,
          shadowRadius: 14,
        },
        indicator: {
          badgeTextColor: "#155E75",
          titleColor: "#0F766E",
          subtitleColor: "#0E7490",
          glassBorderColor: "rgba(34, 211, 238, 0.94)",
          glassFillColor: "rgba(240, 253, 250, 0.58)",
          glowColor: "rgba(34, 211, 238, 0.6)",
          glowOpacity: 0.46,
          glowRadius: 20,
          radarPingVariant: "harbor-emerald",
        },
      }),
    },
    {
      id: "dusk-harbor",
      label: "Dusk Harbor",
      description: "A dark preview with moonlit cards and neon signal accents.",
      backgroundColor: "#0F172A",
      backgroundColors: ["#1D4ED8", "#0F766E", "#7C3AED", "#FB7185"],
      backgroundOverlayColor: "rgba(2,6,23,0.26)",
      titleColor: "#F8FAFC",
      bodyColor: "#CBD5E1",
      selectorBackgroundColor: "rgba(15,23,42,0.72)",
      selectorBorderColor: "rgba(148,163,184,0.38)",
      selectorTextColor: "#F8FAFC",
      timelineTheme: createTheme({
        track: {
          completedColor: "#38BDF8",
          completedGlowColor: "rgba(56, 189, 248, 0.42)",
          remainingColor: "rgba(71, 85, 105, 0.78)",
        },
        cards: {
          blurIntensity: 20,
          blurTint: "dark",
          fillColor: "rgba(15,23,42,0.48)",
          borderColor: "rgba(148,163,184,0.48)",
          shadowColor: "#38BDF8",
          shadowOpacity: 0.16,
          shadowRadius: 18,
        },
        labels: {
          terminalNameColor: "#F9A8D4",
          terminalNameShadowColor: "rgba(15,23,42,0.5)",
          eventLabelColor: "#E2E8F0",
          eventLabelShadowColor: "rgba(15,23,42,0.6)",
        },
        times: {
          textColor: "#E2E8F0",
          shadowColor: "rgba(15,23,42,0.75)",
          iconColor: "#38BDF8",
          shadowIconColor: "rgba(15,23,42,0.8)",
        },
        marker: {
          pastFillColor: "#0EA5E9",
          pastBorderColor: "rgba(125,211,252,0.6)",
          futureFillColor: "rgba(15,23,42,0.9)",
          futureBorderColor: "#38BDF8",
          pastIconTintColor: "rgba(255,255,255,0.92)",
          futureIconTintColor: "rgba(186,230,253,0.92)",
          shadowColor: "#38BDF8",
          shadowOpacity: 0.26,
          shadowRadius: 12,
        },
        indicator: {
          badgeTextColor: "#E0F2FE",
          titleColor: "#F8FAFC",
          subtitleColor: "#CBD5E1",
          glassBorderColor: "rgba(56, 189, 248, 0.95)",
          glassFillColor: "rgba(15, 23, 42, 0.62)",
          glassBlurIntensity: 14,
          glowColor: "rgba(56, 189, 248, 0.44)",
          glowOpacity: 0.38,
          radarPingVariant: "harbor-emerald",
        },
      }),
    },
    {
      id: "postcard-sunset",
      label: "Postcard Sunset",
      description: "Warm coral and citrus with a travel-poster feel.",
      backgroundColor: "#FFF6EE",
      backgroundColors: ["#FFB38A", "#FFD36E", "#A7F3D0", "#F9A8D4"],
      backgroundOverlayColor: "rgba(255,248,240,0.18)",
      titleColor: "#3C2415",
      bodyColor: "#7A5A46",
      selectorBackgroundColor: "rgba(255,251,247,0.9)",
      selectorBorderColor: "rgba(255,224,201,0.94)",
      selectorTextColor: "#3C2415",
      timelineTheme: createTheme({
        track: {
          completedColor: "#F97316",
          completedGlowColor: "rgba(249, 115, 22, 0.28)",
          remainingColor: "rgba(254, 215, 170, 0.72)",
        },
        labels: {
          terminalNameColor: "#FB7185",
          eventLabelColor: "#C2410C",
        },
        times: {
          textColor: "#9A3412",
          iconColor: "#EA580C",
        },
        marker: {
          pastFillColor: "#F97316",
          futureBorderColor: "#FB7185",
          futureIconTintColor: "rgba(249,115,22,0.88)",
          shadowColor: "#FDBA74",
        },
        indicator: {
          badgeTextColor: "#9A3412",
          titleColor: "#9A3412",
          subtitleColor: "#C2410C",
          glassBorderColor: "rgba(249, 115, 22, 0.88)",
          glowColor: "rgba(251, 113, 133, 0.36)",
          radarPingVariant: "tidal-mix",
        },
      }),
    },
    {
      id: "signal-map",
      label: "Signal Map",
      description: "Cleaner, more instrument-like timeline with less whimsy.",
      backgroundColor: "#F5F7FA",
      backgroundColors: ["#BFD8FF", "#D6F5EA", "#FFE2C7", "#E6E7F8"],
      backgroundOverlayColor: "rgba(255,255,255,0.26)",
      titleColor: "#111827",
      bodyColor: "#4B5563",
      selectorBackgroundColor: "rgba(255,255,255,0.92)",
      selectorBorderColor: "rgba(226,232,240,0.95)",
      selectorTextColor: "#111827",
      timelineTheme: createTheme({
        cards: {
          fillColor: "rgba(255,255,255,0.62)",
          borderColor: "rgba(209,213,219,0.95)",
          shadowColor: "#D1D5DB",
          shadowOpacity: 0.12,
          shadowRadius: 10,
        },
        labels: {
          terminalNameFontClassName: "font-playpen-600 text-2xl",
          terminalNameColor: "#111827",
          terminalNameRotationDeg: -4,
          terminalNameShadowColor: "rgba(255,255,255,0.82)",
          eventLabelFontClassName: "font-playpen-600 text-base",
          eventLabelColor: "#1F2937",
          eventLabelShadowColor: "rgba(255,255,255,0.82)",
        },
        times: {
          fontClassName: "font-playpen-500 text-base",
          textColor: "#374151",
          iconColor: "#0F766E",
        },
        track: {
          coreWidthPx: 4,
          glowWidthPx: 10,
          completedColor: "#0F766E",
          completedGlowColor: "rgba(15, 118, 110, 0.16)",
          remainingColor: "rgba(209, 250, 229, 0.58)",
        },
        marker: {
          pastFillColor: "#0F766E",
          futureBorderColor: "#0F766E",
          futureIconTintColor: "rgba(15,118,110,0.8)",
          shadowColor: "#99F6E4",
          shadowOpacity: 0.14,
          shadowRadius: 6,
        },
        indicator: {
          badgeTextColor: "#115E59",
          titleColor: "#111827",
          subtitleColor: "#374151",
          glassBorderColor: "rgba(15, 118, 110, 0.86)",
          glowColor: "rgba(15, 118, 110, 0.22)",
          radarPingVariant: "harbor-emerald",
          badgeTextStyle: { fontFamily: "PlaypenSans-SemiBold" },
        },
      }),
    },
  ];

export const getVesselTimelineDesignVariant = (variantId?: string) =>
  VESSEL_TIMELINE_DESIGN_VARIANTS.find((variant) => variant.id === variantId) ??
  VESSEL_TIMELINE_DESIGN_VARIANTS[0];
