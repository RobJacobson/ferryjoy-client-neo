/**
 * Shared config for the gradient background feature.
 *
 * This module contains the shape of a fully resolved orb plus the default
 * palette and numeric ranges used when generating randomized orb scenes.
 */

export type GradientStop = {
  position: number;
  alpha: number;
};

export type GradientOrbConfig = {
  id: string;
  color: string;
  orbRadiusPx: number;
  orbitCenterX: number;
  orbitCenterY: number;
  orbitRadiusPx: number;
  initialThetaDeg: number;
  durationMs: number;
  delayMs: number;
  scaleFrom: number;
  scaleTo: number;
};

export const GRADIENT_BACKGROUND_STOPS: readonly GradientStop[] = [
  { position: 0, alpha: 0.88 },
  { position: 0.18, alpha: 0.82 },
  { position: 0.42, alpha: 0.46 },
  { position: 0.75, alpha: 0.14 },
  { position: 1, alpha: 0 },
];

export const GRADIENT_BACKGROUND_OVERLAY_COLOR = "rgba(255,255,255,0.08)";

export const GRADIENT_BACKGROUND_COLORS = [
  "#6FA8FF",
  "#FF8E72",
  "#7BE0C3",
  "#8D7DFF",
] as const;

export const GRADIENT_BACKGROUND_RADIUS_RANGE = {
  min: 0.4,
  max: 0.58,
} as const;

export const GRADIENT_BACKGROUND_DURATION_RANGE_MS = {
  min: 14000,
  max: 24000,
} as const;

export const GRADIENT_BACKGROUND_DELAY_RANGE_MS = {
  min: 0,
  max: 4000,
} as const;

export const GRADIENT_BACKGROUND_SCALE_RANGE = {
  min: 0.94,
  max: 1.12,
} as const;
