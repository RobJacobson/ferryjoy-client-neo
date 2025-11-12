import { bezierSpline, lineString } from "@turf/turf";
import type React from "react";
import type { VesselPing } from "@/domain/vessels/vesselPing";
import { createSmoothedLineWithD3 } from "@/shared/utils/d3CurveSmoothing";
import { VesselLine } from "./VesselLine";

interface SmoothingComparisonProps {
  pings: VesselPing[];
  currentPosition?: [number, number];
}

export const SmoothingComparison: React.FC<SmoothingComparisonProps> = ({
  pings,
  currentPosition,
}) => {
  // Filter out pings that are less than 30 seconds old
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  const filteredPings = pings.filter(
    (ping) => ping.TimeStamp <= thirtySecondsAgo
  );

  // Skip if we don't have enough points
  if (!filteredPings || filteredPings.length < 2) {
    return null;
  }

  // Convert to GeoJSON LineString coordinates [longitude, latitude]
  let coordinates = filteredPings.map((ping) => [
    ping.Longitude,
    ping.Latitude,
  ]);

  // Prepend the current smoothed position if provided
  if (currentPosition) {
    coordinates = [currentPosition, ...coordinates];
  }

  // Limit to a reasonable number of points for performance
  const maxPoints = 50;
  if (coordinates.length > maxPoints) {
    coordinates = coordinates.slice(0, maxPoints);
  }

  // Original bezier spline
  const bezierLine = bezierSpline(lineString(coordinates), {
    resolution: 5000,
    sharpness: 0.75,
  });

  // D3 basis curve
  const d3Line = createSmoothedLineWithD3(pings, currentPosition);

  const inService = pings[0]?.AtDock === false;

  return (
    <>
      <VesselLine id="bezier-line" line={bezierLine} inService={inService} />
      {d3Line && (
        <VesselLine id="d3-basis-line" line={d3Line} inService={inService} />
      )}
    </>
  );
};
