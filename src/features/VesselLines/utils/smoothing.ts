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

// Strategy object that directly maps strategy names to their implementations
// Each strategy uses configuration values from VESSEL_LINE_CONFIG
export const smoothingStrategies = {
  // No smoothing - passes through original line segments
  none: (coordinates: [number, number][]) => {
    // Simply return the original coordinates as a LineString
    return lineString(coordinates);
  },

  // D3 Basis Strategy
  d3Basis: (coordinates: [number, number][]) => {
    const selectedCurve = curveBasis;
    return createSmoothedLineWithCurve(coordinates, selectedCurve);
  },

  // D3 Cardinal Strategy with configurable tension
  d3Cardinal: (coordinates: [number, number][]) => {
    // Use tension value from configuration
    const selectedCurve = curveCardinal.tension(
      VESSEL_LINE_CONFIG.smoothing.cardinalTension
    );
    return createSmoothedLineWithCurve(coordinates, selectedCurve);
  },

  // D3 Catmull-Rom Strategy
  d3CatmullRom: (coordinates: [number, number][]) => {
    const selectedCurve = curveCatmullRom;
    return createSmoothedLineWithCurve(coordinates, selectedCurve);
  },

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
export type SmoothingStrategyName = keyof typeof smoothingStrategies;

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

  // Get the selected strategy directly from the object
  const selectedStrategy = smoothingStrategies[strategy];

  // Fallback to default strategy if strategy not found
  if (!selectedStrategy) {
    console.warn(
      `Unknown smoothing strategy: ${strategy}, falling back to ${VESSEL_LINE_CONFIG.smoothing.strategy}`
    );
    return smoothingStrategies[VESSEL_LINE_CONFIG.smoothing.strategy](
      coordinates
    );
  }

  // Execute the selected strategy
  return selectedStrategy(coordinates);
};

/**
 * Creates a smoothed line using D3.js curve interpolation
 * Supports different curve types: basis, cardinal, and catmullRom
 *
 * @param coordinates - Array of [longitude, latitude] coordinates
 * @param curve - D3 curve factory
 * @returns GeoJSON LineString feature with smoothed coordinates
 */
function createSmoothedLineWithCurve(
  coordinates: [number, number][],
  curve: CurveFactory
) {
  // Generate smoothed coordinates using the selected curve
  const smoothedCoordinates = generateSmoothedCoordinates(coordinates, curve);

  // If we couldn't generate smoothed coordinates, fall back to original coordinates
  if (smoothedCoordinates.length < 2) {
    return lineString(coordinates);
  }

  // Convert back to GeoJSON LineString
  return lineString(smoothedCoordinates);
}

/**
 * Generates smoothed coordinates using D3 curve factory
 * @param coordinates - Original coordinates
 * @param curve - D3 curve factory
 * @returns Smoothed coordinates
 */
function generateSmoothedCoordinates(
  coordinates: [number, number][],
  curve: CurveFactory
): [number, number][] {
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
}

/**
 * Custom path context that captures coordinates from D3 curve generation
 */
class PathContext {
  private coordinates: [number, number][] = [];
  private currentX = 0;
  private currentY = 0;

  moveTo(x: number, y: number): void {
    this.currentX = x;
    this.currentY = y;
    this.coordinates.push([x, y]);
  }

  lineTo(x: number, y: number): void {
    this.currentX = x;
    this.currentY = y;
    this.coordinates.push([x, y]);
  }

  bezierCurveTo(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number
  ): void {
    // Sample points along the Bezier curve
    const startX = this.currentX;
    const startY = this.currentY;

    // Sample points along the curve for smoother appearance
    for (let t = 0.05; t <= 1; t += 0.05) {
      const pointX = cubicBezier(t, startX, x1, x2, x);
      const pointY = cubicBezier(t, startY, y1, y2, y);
      this.coordinates.push([pointX, pointY]);
    }

    this.currentX = x;
    this.currentY = y;
  }

  // Required methods for D3 compatibility (not used in our implementation)
  closePath = (): void => {};
  quadraticCurveTo = (): void => {};
  arcTo = (): void => {};
  arc = (): void => {};
  rect = (): void => {};

  getCoordinates(): [number, number][] {
    return this.coordinates;
  }
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
function cubicBezier(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const u = 1 - t;
  return (
    u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  );
}
