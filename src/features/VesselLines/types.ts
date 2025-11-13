import type { Feature, LineString } from "geojson";

export interface VesselLineProps {
  /** GeoJSON LineString feature */
  line: Feature<LineString>;
  /** Whether vessel is in service */
  inService: boolean;
  /** Unique identifier for line source */
  id: string;
  /** RGBA color values for the line [r, g, b, a] */
  rgbaColor: [number, number, number, number];
}
