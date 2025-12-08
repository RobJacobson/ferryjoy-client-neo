import { bezierSpline, lineString } from "@turf/turf";
import {
  type CurveFactory,
  curveBasis,
  curveCardinal,
  curveCatmullRom,
} from "d3";
import type { Feature, LineString } from "geojson";
import { VESSEL_LINE_CONFIG } from "../config";

// Simple type definition for the strategy function
export type SmoothingStrategy = (
  coordinates: [number, number][]
) => Feature<LineString> | null;

const strategyForCurve =
  (curve: CurveFactory): SmoothingStrategy =>
  (coordinates) =>
    createSmoothedLineWithCurve(coordinates, curve);

const sampleCurveStep = 0.05;

const sampleBezierCurve = (
  startX: number,
  startY: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  endX: number,
  endY: number
) => {
  const samples: [number, number][] = [];

  for (let t = sampleCurveStep; t <= 1; t += sampleCurveStep) {
    samples.push([
      cubicBezier(t, startX, x1, x2, endX),
      cubicBezier(t, startY, y1, y2, endY),
    ]);
  }

  return samples;
};

// Strategy object that directly maps strategy names to their implementations
// Each strategy uses configuration values from VESSEL_LINE_CONFIG
type SmoothingStrategyMap = {
  none: SmoothingStrategy;
  d3Basis: SmoothingStrategy;
  d3Cardinal: SmoothingStrategy;
  d3CatmullRom: SmoothingStrategy;
  turfBezier: SmoothingStrategy;
};

export const smoothingStrategies: SmoothingStrategyMap = {
  // No smoothing - passes through original line segments
  none: (coordinates: [number, number][]) => {
    // Simply return the original coordinates as a LineString
    return lineString(coordinates);
  },

  // D3 Basis Strategy
  d3Basis: strategyForCurve(curveBasis),

  // D3 Cardinal Strategy with configurable tension
  d3Cardinal: strategyForCurve(
    curveCardinal.tension(VESSEL_LINE_CONFIG.smoothing.cardinalTension)
  ),

  // D3 Catmull-Rom Strategy
  d3CatmullRom: strategyForCurve(curveCatmullRom),

  // Turf Bezier Strategy with configurable parameters
  turfBezier: (coordinates: [number, number][]) => {
    const line = lineString(coordinates);
    // Use resolution and sharpness values from configuration
    const smoothed = bezierSpline(line, {
      resolution: VESSEL_LINE_CONFIG.smoothing.bezierResolution,
      sharpness: VESSEL_LINE_CONFIG.smoothing.bezierSharpness,
    });
    return smoothed;
  },
} as const;

// For type-safe strategy selection
export type SmoothingStrategyName = keyof SmoothingStrategyMap;

const resolveStrategy = (strategy: SmoothingStrategyName) => {
  const defaultStrategyName: SmoothingStrategyName =
    VESSEL_LINE_CONFIG.smoothing.strategy;
  const configuredStrategy = smoothingStrategies[strategy];

  if (configuredStrategy) {
    return { strategyToUse: configuredStrategy };
  }

  console.warn(
    `Unknown smoothing strategy: ${strategy}, falling back to ${defaultStrategyName}`
  );

  return {
    strategyToUse: smoothingStrategies[defaultStrategyName],
  };
};

/**
 * Creates a smoothed line using the selected smoothing strategy
 *
 * @param coordinates - Array of [longitude, latitude] coordinates
 * @param strategy - Strategy function to use for smoothing
 * @returns GeoJSON LineString feature with smoothed coordinates
 */
export const createSmoothedLine = (
  coordinates: [number, number][],
  strategy: SmoothingStrategyName = VESSEL_LINE_CONFIG.smoothing.strategy
): Feature<LineString> | null => {
  // Validate coordinates before processing
  if (!coordinates || coordinates.length < 2) return null;

  const { strategyToUse } = resolveStrategy(strategy);

  return strategyToUse(coordinates);
};

/**
 * Creates a smoothed line using D3.js curve interpolation
 * Supports different curve types: basis, cardinal, and catmullRom
 *
 * @param coordinates - Array of [longitude, latitude] coordinates
 * @param curve - D3 curve factory
 * @returns GeoJSON LineString feature with smoothed coordinates
 */
const createSmoothedLineWithCurve = (
  coordinates: [number, number][],
  curve: CurveFactory
) => {
  // Generate smoothed coordinates using the selected curve
  const smoothedCoordinates = generateSmoothedCoordinates(coordinates, curve);

  const finalCoordinates =
    smoothedCoordinates.length < 2 ? coordinates : smoothedCoordinates;

  return lineString(finalCoordinates);
};

/**
 * Generates smoothed coordinates using D3 curve factory
 * @param coordinates - Original coordinates
 * @param curve - D3 curve factory
 * @returns Smoothed coordinates
 */
const generateSmoothedCoordinates = (
  coordinates: [number, number][],
  curve: CurveFactory
): [number, number][] => {
  // Create a curve context from the coordinates
  const context = new PathContext();
  const curveFunction = curve(context);

  // Initialize the curve with the first point
  curveFunction.lineStart();

  // Add each point to the curve
  for (const [x, y] of coordinates) {
    curveFunction.point(x, y);
  }

  // Finalize the curve
  curveFunction.lineEnd();

  // Return the smoothed coordinates from the context
  return context.getCoordinates();
};

/**
 * Custom path context that captures coordinates from D3 curve generation
 */
class PathContext {
  private coordinates: [number, number][] = [];
  private currentX = 0;
  private currentY = 0;

  moveTo = (x: number, y: number): void => {
    this.currentX = x;
    this.currentY = y;
    this.coordinates.push([x, y]);
  };

  lineTo = (x: number, y: number): void => {
    this.currentX = x;
    this.currentY = y;
    this.coordinates.push([x, y]);
  };

  bezierCurveTo = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number
  ): void => {
    // Sample points along the Bezier curve for smoother appearance
    this.coordinates.push(
      ...sampleBezierCurve(this.currentX, this.currentY, x1, y1, x2, y2, x, y)
    );

    this.currentX = x;
    this.currentY = y;
  };

  // Required methods for D3 compatibility (not used in our implementation)
  closePath = (): void => {};
  quadraticCurveTo = (): void => {};
  arcTo = (): void => {};
  arc = (): void => {};
  rect = (): void => {};

  getCoordinates = (): [number, number][] => {
    return this.coordinates;
  };
}

/**
 * Calculates a point on a cubic Bezier curve at parameter t
 * @param t - Parameter value (0 to 1)
 * @param p0 - Start point
 * @param p1 - Control point 1
 * @param p2 - Control point 2
 * @param p3 - End point
 * @returns Point on the curve at parameter t
 */
const cubicBezier = (
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number => {
  const u = 1 - t;
  return (
    u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  );
};
