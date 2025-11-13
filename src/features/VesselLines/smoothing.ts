import { bezierSpline, lineString } from "@turf/turf";
import {
  type CurveFactory,
  curveBasis,
  curveCardinal,
  curveCatmullRom,
} from "d3";
import type { Feature, LineString } from "geojson";

// Simple type definition for the strategy function
export type SmoothingStrategy = (
  coordinates: [number, number][]
) => Feature<LineString> | null;

// Strategy object that directly maps strategy names to their implementations
// Each strategy has its own hardcoded constants
export const smoothingStrategies = {
  // D3 Basis Strategy with hardcoded constants
  d3Basis: (coordinates: [number, number][]) => {
    if (!coordinates || coordinates.length < 2) return null;

    const selectedCurve = curveBasis;
    return createSmoothedLineWithCurve(coordinates, selectedCurve);
  },

  // D3 Cardinal Strategy with hardcoded constants
  d3Cardinal: (coordinates: [number, number][]) => {
    if (!coordinates || coordinates.length < 2) return null;

    // Hardcoded tension value specifically for cardinal curves
    const selectedCurve = curveCardinal.tension(0.7);
    return createSmoothedLineWithCurve(coordinates, selectedCurve);
  },

  // D3 Catmull-Rom Strategy with hardcoded constants
  d3CatmullRom: (coordinates: [number, number][]) => {
    if (!coordinates || coordinates.length < 2) return null;

    const selectedCurve = curveCatmullRom;
    return createSmoothedLineWithCurve(coordinates, selectedCurve);
  },

  // Turf Bezier Strategy with hardcoded constants
  turfBezier: (coordinates: [number, number][]) => {
    if (!coordinates || coordinates.length < 2) return null;

    const line = lineString(coordinates);
    // Hardcoded resolution and sharpness values specifically for bezier curves
    const smoothed = bezierSpline(line, {
      resolution: 10000,
      sharpness: 0.85,
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
  strategy: SmoothingStrategyName = "turfBezier"
): Feature<LineString> | null => {
  // Get the selected strategy directly from the object
  const selectedStrategy = smoothingStrategies[strategy];

  // Fallback to turfBezier if strategy not found
  if (!selectedStrategy) {
    console.warn(
      `Unknown smoothing strategy: ${strategy}, falling back to turfBezier`
    );
    return smoothingStrategies.turfBezier(coordinates);
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
