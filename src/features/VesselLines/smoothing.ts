import { bezierSpline, lineString } from "@turf/turf";
import {
  type CurveFactory,
  curveBasis,
  curveCardinal,
  curveCatmullRom,
} from "d3";
import type { VesselPing } from "@/domain/vessels/vesselPing";

// Smoothing method constants
export const SMOOTHING_METHODS = {
  D3_BASIS: "d3-basis",
  D3_CARDINAL: "d3-cardinal",
  D3_CATMULL_ROM: "d3-catmullRom",
  TURF_BEZIER: "turf-bezier",
} as const;

// Default sampling resolution for D3 curves
export const D3_CURVE_SAMPLES = 20;

/**
 * Creates a smoothed line using the configured smoothing method
 *
 * @param pings - Array of vessel ping data
 * @param currentPosition - Optional current smoothed position [longitude, latitude]
 * @param method - Smoothing method to use
 * @param config - Configuration options for smoothing
 * @returns GeoJSON LineString feature with smoothed coordinates
 */
export const createSmoothedLine = (
  pings: VesselPing[],
  currentPosition?: [number, number],
  method: string = SMOOTHING_METHODS.TURF_BEZIER,
  config?: {
    tension?: number;
    resolution?: number;
    sharpness?: number;
    maxPoints?: number;
    minAgeSeconds?: number;
  }
) => {
  // Use default config if not provided
  const finalConfig = {
    tension: 0.5,
    resolution: 10000,
    sharpness: 0.95,
    maxPoints: 50,
    minAgeSeconds: 30,
    ...config,
  };

  // Filter out pings that are less than the configured minimum age
  const minAgeMs = finalConfig.minAgeSeconds * 1000;
  const cutoffTime = new Date(Date.now() - minAgeMs);
  const filteredPings = pings.filter((ping) => ping.TimeStamp <= cutoffTime);

  // Skip if we don't have enough points
  if (!filteredPings || filteredPings.length < 2) {
    return null;
  }

  // Convert to GeoJSON LineString coordinates [longitude, latitude]
  const coordinates: [number, number][] = filteredPings.map((ping) => [
    ping.Longitude,
    ping.Latitude,
  ]);

  // Prepend the current smoothed position if provided
  if (currentPosition) {
    coordinates.unshift(currentPosition);
  }

  // Apply the maxPoints limit after potentially adding the current position
  if (coordinates.length > finalConfig.maxPoints) {
    coordinates.splice(finalConfig.maxPoints);
  }

  // Apply selected smoothing method
  switch (method) {
    case SMOOTHING_METHODS.D3_BASIS:
    case SMOOTHING_METHODS.D3_CARDINAL:
    case SMOOTHING_METHODS.D3_CATMULL_ROM: {
      return createSmoothedLineWithD3(coordinates, method, finalConfig.tension);
    }
    case SMOOTHING_METHODS.TURF_BEZIER:
    default: {
      // Fallback to original bezierSpline with config parameters
      const line = lineString(coordinates);
      const smoothed = bezierSpline(line, {
        resolution: finalConfig.resolution,
        sharpness: finalConfig.sharpness,
      });
      return smoothed;
    }
  }
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
 * Creates a smoothed line using D3.js curve interpolation
 * Supports different curve types: basis, cardinal, and catmullRom
 *
 * @param coordinates - Array of [longitude, latitude] coordinates
 * @param curveType - Type of D3 curve to use
 * @param tension - Tension value for cardinal curves
 * @returns GeoJSON LineString feature with smoothed coordinates
 */
function createSmoothedLineWithD3(
  coordinates: [number, number][],
  curveType: string,
  tension: number
) {
  // Select appropriate curve type based on method
  switch (curveType) {
    case SMOOTHING_METHODS.D3_CARDINAL: {
      const selectedCurve = curveCardinal.tension(tension);
      return createSmoothedLineWithCurve(coordinates, selectedCurve);
    }
    case SMOOTHING_METHODS.D3_CATMULL_ROM: {
      const selectedCurve = curveCatmullRom;
      return createSmoothedLineWithCurve(coordinates, selectedCurve);
    }
    case SMOOTHING_METHODS.D3_BASIS:
    default: {
      const selectedCurve = curveBasis;
      return createSmoothedLineWithCurve(coordinates, selectedCurve);
    }
  }
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
