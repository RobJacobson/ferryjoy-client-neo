/**
 * MapVesselMarkers module exports
 *
 * This module provides components for rendering vessel markers on a map.
 * It includes the main MapVesselMarkers component and the VesselMarker component that handles business logic.
 *
 * The module is organized as follows:
 * - MapVesselMarkers: Main component that fetches vessel data and renders markers
 * - VesselMarker: Intermediate component that handles press events and logging
 *
 * @example
 * ```tsx
 * // Import the main component
 * import { MapVesselMarkers } from '@/features/MapVesselMarkers';
 *
 * // Import individual components
 * import { VesselMarker } from '@/features/MapVesselMarkers';
 *
 * // Usage in a map component
 * const MyMap = () => {
 *   return (
 *     <Map>
 *       <MapVesselMarkers onVesselPress={handleVesselPress} />
 *     </Map>
 *   );
 * };
 * ```
 */

// Main component that fetches vessel data and renders markers on the map
export { MapVesselMarkers } from "./MapVesselMarkers";

// Supporting component that handles business logic for vessel markers
export { VesselMarker } from "./VesselMarker";
