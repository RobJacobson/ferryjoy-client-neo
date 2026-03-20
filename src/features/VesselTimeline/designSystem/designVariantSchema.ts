import type { TimelineVisualTheme } from "@/components/timeline";
import {
  DEFAULT_TIMELINE_VISUAL_THEME,
  TIMELINE_THEME_CONSTANTS,
} from "@/components/timeline";
import { VESSEL_TIMELINE_VARIANT_THEME_DEFINITIONS } from "./designVariantThemes";

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

export type VesselTimelineVariantPalette = {
  canvas: string;
  atmosphere: readonly [string, string, string, string];
  surface: string;
  textStrong: string;
  text: string;
  accent: string;
  decorative: string;
  isDark?: boolean;
  radarPingVariant?: TimelineVisualTheme["indicator"]["radarPingVariant"];
};

export type VesselTimelineVariantThemeDefinition = {
  id: string;
  label: string;
  description: string;
  palette: VesselTimelineVariantPalette;
};

type CreateVariantParams = VesselTimelineVariantThemeDefinition;

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

const rgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const red = Number.parseInt(fullHex.slice(0, 2), 16);
  const green = Number.parseInt(fullHex.slice(2, 4), 16);
  const blue = Number.parseInt(fullHex.slice(4, 6), 16);

  return `rgba(${red},${green},${blue},${alpha})`;
};

const getSurfaceBorder = (isDark: boolean) =>
  isDark ? rgba("#FFFFFF", 0.24) : rgba("#FFFFFF", 0.9);

const getSurfaceElevated = (surface: string, isDark: boolean) =>
  isDark ? rgba(surface, 0.78) : rgba("#FFFFFF", 0.9);

const getSurfaceElevatedBorder = (isDark: boolean) =>
  isDark ? rgba("#FFFFFF", 0.2) : rgba("#FFFFFF", 0.94);

const getBackgroundOverlay = (canvas: string, isDark: boolean) =>
  isDark ? rgba(canvas, 0.24) : rgba("#FFFFFF", 0.18);

export const createVesselTimelineDesignVariant = ({
  id,
  label,
  description,
  palette,
}: CreateVariantParams): VesselTimelineDesignVariant => {
  const isDark = palette.isDark ?? false;

  return {
    id,
    label,
    description,
    backgroundColor: palette.canvas,
    backgroundColors: palette.atmosphere,
    backgroundOverlayColor: getBackgroundOverlay(palette.canvas, isDark),
    titleColor: palette.textStrong,
    bodyColor: palette.text,
    selectorBackgroundColor: getSurfaceElevated(palette.surface, isDark),
    selectorBorderColor: getSurfaceElevatedBorder(isDark),
    selectorTextColor: palette.textStrong,
    timelineTheme: createTheme({
      track: {
        coreWidthPx: TIMELINE_THEME_CONSTANTS.track.coreWidthPx,
        glowWidthPx: TIMELINE_THEME_CONSTANTS.track.glowWidthPx,
        completedGlowOpacity:
          TIMELINE_THEME_CONSTANTS.track.completedGlowOpacity,
        completedColor: palette.accent,
        completedGlowColor: rgba(palette.accent, 0.32),
        remainingColor: isDark
          ? rgba("#FFFFFF", 0.22)
          : rgba(palette.accent, 0.18),
      },
      cards: {
        blurIntensity: TIMELINE_THEME_CONSTANTS.cards.blurIntensity,
        blurTint: isDark ? "dark" : TIMELINE_THEME_CONSTANTS.cards.blurTint,
        borderWidth: TIMELINE_THEME_CONSTANTS.cards.borderWidth,
        shadowOpacity: TIMELINE_THEME_CONSTANTS.cards.shadowOpacity,
        shadowRadius: TIMELINE_THEME_CONSTANTS.cards.shadowRadius,
        shadowStyle: TIMELINE_THEME_CONSTANTS.cards.shadowStyle,
        fillColor: rgba(palette.surface, isDark ? 0.72 : 0.84),
        borderColor: getSurfaceBorder(isDark),
        shadowColor: palette.accent,
      },
      labels: {
        terminalNameFontClassName:
          TIMELINE_THEME_CONSTANTS.labels.terminalNameFontClassName,
        terminalNameRotationDeg:
          TIMELINE_THEME_CONSTANTS.labels.terminalNameRotationDeg,
        eventLabelFontClassName:
          TIMELINE_THEME_CONSTANTS.labels.eventLabelFontClassName,
        terminalNameStyle: TIMELINE_THEME_CONSTANTS.labels.terminalNameStyle,
        eventLabelStyle: TIMELINE_THEME_CONSTANTS.labels.eventLabelStyle,
        terminalNameColor: palette.decorative,
        terminalNameShadowColor: isDark
          ? rgba(palette.canvas, 0.58)
          : rgba("#FFFFFF", 0.98),
        eventLabelColor: palette.textStrong,
        eventLabelShadowColor: isDark
          ? rgba(palette.canvas, 0.72)
          : rgba("#FFFFFF", 0.96),
      },
      times: {
        fontClassName: TIMELINE_THEME_CONSTANTS.times.fontClassName,
        textStyle: TIMELINE_THEME_CONSTANTS.times.textStyle,
        textColor: palette.textStrong,
        shadowColor: isDark
          ? rgba(palette.canvas, 0.8)
          : rgba("#FFFFFF", 0.98),
        iconColor: palette.accent,
        shadowIconColor: isDark
          ? rgba(palette.canvas, 0.82)
          : rgba("#FFFFFF", 0.98),
      },
      marker: {
        shadowOpacity: TIMELINE_THEME_CONSTANTS.marker.shadowOpacity,
        shadowRadius: TIMELINE_THEME_CONSTANTS.marker.shadowRadius,
        pastFillColor: palette.accent,
        pastBorderColor: rgba("#FFFFFF", 0.92),
        futureFillColor: isDark
          ? rgba(palette.surface, 0.92)
          : rgba("#FFFFFF", 0.96),
        futureBorderColor: palette.accent,
        pastIconTintColor: rgba("#FFFFFF", 0.96),
        futureIconTintColor: palette.accent,
        shadowColor: palette.accent,
      },
      indicator: {
        glassBlurIntensity:
          TIMELINE_THEME_CONSTANTS.indicator.glassBlurIntensity,
        glowOpacity: TIMELINE_THEME_CONSTANTS.indicator.glowOpacity,
        glowRadius: TIMELINE_THEME_CONSTANTS.indicator.glowRadius,
        badgeTextStyle: TIMELINE_THEME_CONSTANTS.indicator.badgeTextStyle,
        titleTextStyle: TIMELINE_THEME_CONSTANTS.indicator.titleTextStyle,
        subtitleTextStyle:
          TIMELINE_THEME_CONSTANTS.indicator.subtitleTextStyle,
        badgeTextColor: palette.textStrong,
        titleColor: palette.textStrong,
        subtitleColor: palette.text,
        glassBorderColor: rgba(palette.accent, 0.82),
        glassFillColor: isDark
          ? rgba(palette.surface, 0.82)
          : rgba("#FFFFFF", 0.92),
        glowColor: rgba(palette.accent, 0.24),
        radarPingVariant: palette.radarPingVariant ?? "harbor-emerald",
      },
    }),
  };
};

export const DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID = "baseline-harbor";

export const VESSEL_TIMELINE_DESIGN_VARIANTS: readonly VesselTimelineDesignVariant[] =
  VESSEL_TIMELINE_VARIANT_THEME_DEFINITIONS.map(
    createVesselTimelineDesignVariant
  );

export const getVesselTimelineDesignVariant = (variantId?: string) =>
  VESSEL_TIMELINE_DESIGN_VARIANTS.find((variant) => variant.id === variantId) ??
  VESSEL_TIMELINE_DESIGN_VARIANTS[0];
