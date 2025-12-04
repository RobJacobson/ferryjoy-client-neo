/**
 * Map projection utilities using viewport-mercator-project
 * Battle-tested, purely mathematical, platform-agnostic projections
 *
 * This module provides a consistent interface for map projections across
 * web and native platforms using the viewport-mercator-project library.
 * All functions are pitch-aware and provide accurate coordinate transformations.
 */

import { WebMercatorViewport } from "viewport-mercator-project";

import type { CameraState } from "@/features/MapComponent/shared";
import { lerp } from "./lerp";

/**
 * Geographic coordinate as [longitude, latitude]
 */
export type GeoCoordinate = readonly [longitude: number, latitude: number];

/**
 * Screen coordinate as [x, y] in pixels
 */
export type ScreenCoordinate = readonly [x: number, y: number];

/**
 * Map dimensions in pixels
 */
export type MapDimensions = {
  readonly width: number;
  readonly height: number;
};

/**
 * Bounding box defined by northeast and southwest corners
 */
export type BoundingBox = {
  readonly northeast: GeoCoordinate;
  readonly southwest: GeoCoordinate;
};

/**
 * Padding specification for viewport calculations
 * Matches the format expected by viewport-mercator-project
 */
export type Padding = {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
};

/**
 * Padding options for viewport calculations
 * Can be a uniform number or an object with specific padding for each side
 */
export type PaddingOptions = Padding | number;

/**
 * Cross-platform map projection utilities interface
 * All methods are pitch-aware and provide accurate coordinate transformations
 */
export interface MapProjectionUtils {
  /**
   * Convert geographic coordinate to screen coordinate
   * Takes map pitch into account for accurate 3D projection
   */
  project(
    coordinate: GeoCoordinate,
    cameraState: CameraState,
    dimensions: MapDimensions
  ): ScreenCoordinate;

  /**
   * Convert screen coordinate to geographic coordinate
   * Takes map pitch into account for accurate 3D unprojection
   */
  unproject(
    point: ScreenCoordinate,
    cameraState: CameraState,
    dimensions: MapDimensions
  ): GeoCoordinate;

  /**
   * Calculate camera state to fit given bounds within viewport
   * Returns partial camera state with centerCoordinate and zoomLevel
   */
  fitBounds(
    bounds: BoundingBox,
    dimensions: MapDimensions,
    padding?: PaddingOptions
  ): Partial<CameraState>;

  /**
   * Get the geographic bounds currently visible in the viewport
   * Takes pitch and heading into account for accurate bounds calculation
   */
  getBounds(cameraState: CameraState, dimensions: MapDimensions): BoundingBox;

  /**
   * Check if a geographic coordinate is currently visible in the viewport
   * Accounts for pitch and rotation
   */
  isPointInViewport(
    coordinate: GeoCoordinate,
    cameraState: CameraState,
    dimensions: MapDimensions
  ): boolean;

  /**
   * Get normalized screen Y position for perspective scaling
   * Returns value from -1 (bottom of screen, closer to camera) to 1 (top of screen, further from camera)
   * This is pitch-aware and provides accurate perspective calculations
   */
  getNormalizedScreenY(
    coordinate: GeoCoordinate,
    cameraState: CameraState,
    dimensions: MapDimensions
  ): number;
}

/**
 * Create WebMercatorViewport from camera state and dimensions
 *
 * @param cameraState - Current camera state with position, zoom, pitch, and bearing
 * @param dimensions - Map viewport dimensions in pixels
 * @returns WebMercatorViewport instance configured with the provided parameters
 */
const createViewport = (
  cameraState: CameraState,
  dimensions: MapDimensions
): WebMercatorViewport =>
  new WebMercatorViewport({
    width: dimensions.width,
    height: dimensions.height,
    longitude: cameraState.centerCoordinate[0],
    latitude: cameraState.centerCoordinate[1],
    zoom: cameraState.zoomLevel,
    pitch: cameraState.pitch,
    bearing: cameraState.heading,
  });

/**
 * Convert geographic coordinate to screen coordinate
 * Uses viewport-mercator-project for accurate, pitch-aware projection
 *
 * @param coordinate - Geographic coordinate as [longitude, latitude]
 * @param cameraState - Current camera state with position, zoom, pitch, and bearing
 * @param dimensions - Map viewport dimensions in pixels
 * @returns Screen coordinate as [x, y] in pixels
 */
const project = (
  coordinate: GeoCoordinate,
  cameraState: CameraState,
  dimensions: MapDimensions
): ScreenCoordinate => {
  const viewport = createViewport(cameraState, dimensions);
  const [x, y] = viewport.project([...coordinate]);
  return [x, y] as ScreenCoordinate;
};

/**
 * Convert screen coordinate to geographic coordinate
 * Uses viewport-mercator-project for accurate, pitch-aware unprojection
 *
 * @param point - Screen coordinate as [x, y] in pixels
 * @param cameraState - Current camera state with position, zoom, pitch, and bearing
 * @param dimensions - Map viewport dimensions in pixels
 * @returns Geographic coordinate as [longitude, latitude]
 */
const unproject = (
  point: ScreenCoordinate,
  cameraState: CameraState,
  dimensions: MapDimensions
): GeoCoordinate => {
  const viewport = createViewport(cameraState, dimensions);
  const [longitude, latitude] = viewport.unproject([...point]);
  return [longitude, latitude] as GeoCoordinate;
};

/**
 * Calculate camera state to fit given bounds within viewport
 * Uses viewport-mercator-project's fitBounds for accurate calculations
 *
 * @param bounds - Bounding box with northeast and southwest corners
 * @param dimensions - Map viewport dimensions in pixels
 * @param padding - Optional padding in pixels (uniform number or object with top/bottom/left/right)
 * @returns Partial camera state with centerCoordinate and zoomLevel to fit the bounds
 */
const fitBounds = (
  bounds: BoundingBox,
  dimensions: MapDimensions,
  padding?: PaddingOptions
): Partial<CameraState> => {
  // Normalize padding to object format expected by viewport-mercator-project
  const normalizedPadding =
    typeof padding === "number"
      ? { top: padding, bottom: padding, left: padding, right: padding }
      : {
          top: padding?.top ?? 0,
          bottom: padding?.bottom ?? 0,
          left: padding?.left ?? 0,
          right: padding?.right ?? 0,
        };

  // Create viewport for fitBounds calculation
  const viewport = new WebMercatorViewport({
    width: dimensions.width,
    height: dimensions.height,
    longitude: 0,
    latitude: 0,
    zoom: 1,
  });

  const { longitude, latitude, zoom } = viewport.fitBounds(
    [[...bounds.southwest], [...bounds.northeast]],
    { padding: normalizedPadding }
  );

  return {
    centerCoordinate: [longitude, latitude] as const,
    zoomLevel: zoom,
  };
};

/**
 * Get the geographic bounds currently visible in the viewport
 * Uses viewport-mercator-project for accurate, pitch-aware bounds calculation
 *
 * @param cameraState - Current camera state with position, zoom, pitch, and bearing
 * @param dimensions - Map viewport dimensions in pixels
 * @returns Bounding box with northeast and southwest corners of visible area
 */
const getBounds = (
  cameraState: CameraState,
  dimensions: MapDimensions
): BoundingBox => {
  const viewport = createViewport(cameraState, dimensions);
  const bounds = viewport.getBounds();

  return {
    southwest: [bounds[0][0], bounds[0][1]] as GeoCoordinate,
    northeast: [bounds[1][0], bounds[1][1]] as GeoCoordinate,
  };
};

/**
 * Check if a geographic coordinate is currently visible in the viewport
 * Projects the coordinate to screen space and checks if it's within viewport bounds
 *
 * @param coordinate - Geographic coordinate as [longitude, latitude]
 * @param cameraState - Current camera state with position, zoom, pitch, and bearing
 * @param dimensions - Map viewport dimensions in pixels
 * @returns True if the coordinate is visible within the viewport bounds
 */
const isPointInViewport = (
  coordinate: GeoCoordinate,
  cameraState: CameraState,
  dimensions: MapDimensions
): boolean => {
  const [x, y] = project(coordinate, cameraState, dimensions);
  return x >= 0 && x <= dimensions.width && y >= 0 && y <= dimensions.height;
};

/**
 * Get normalized screen Y position for perspective scaling
 * Useful for creating depth-based visual effects (e.g., scaling markers based on perspective)
 *
 * @param coordinate - Geographic coordinate as [longitude, latitude]
 * @param cameraState - Current camera state with position, zoom, pitch, and bearing
 * @param dimensions - Map viewport dimensions in pixels
 * @returns Normalized Y position: -1 (bottom/closer to camera) to 1 (top/further from camera)
 */
const getNormalizedScreenY = (
  coordinate: GeoCoordinate,
  cameraState: CameraState,
  dimensions: MapDimensions
): number => {
  const [, screenY] = project(coordinate, cameraState, dimensions);
  // Convert to normalized range: -1 (bottom, closer to camera) to 1 (top, further from camera)
  return lerp(screenY, 0, dimensions.height, 1, -1);
};

/**
 * Map projection utilities using viewport-mercator-project
 * Battle-tested, purely mathematical, cross-platform projections
 *
 * This object provides a consistent interface for map projections across
 * web and native platforms. All methods use viewport-mercator-project
 * internally for accurate, pitch-aware coordinate transformations.
 *
 * @example
 * ```typescript
 * import { mapProjectionUtils } from "@/shared/utils/mapProjection";
 *
 * // Project a coordinate to screen space
 * const screenPoint = mapProjectionUtils.project(
 *   [-122.4194, 37.7749],
 *   cameraState,
 *   { width: 800, height: 600 }
 * );
 *
 * // Check if a point is visible
 * const isVisible = mapProjectionUtils.isPointInViewport(
 *   [-122.4194, 37.7749],
 *   cameraState,
 *   { width: 800, height: 600 }
 * );
 * ```
 */
export const mapProjectionUtils: MapProjectionUtils = {
  project,
  unproject,
  fitBounds,
  getBounds,
  isPointInViewport,
  getNormalizedScreenY,
};
