/**
 * Raw WSF schedule types used by adapter-boundary schedule ingestion modules.
 */

import type { Route } from "ws-dottie/wsf-schedule";

export type VesselSailing = {
  DepartingTime: Date;
  ArrivingTime: Date | null;
  LoadingRule: 1 | 2 | 3;
  VesselID: number;
  VesselName: string;
  VesselHandicapAccessible: boolean;
  VesselPositionNum: number;
  Routes: number[];
  AnnotationIndexes: number[] | null;
};

export type RawWsfScheduleSegment = {
  VesselName: string;
  DepartingTerminalName: string;
  ArrivingTerminalName: string;
  DepartingTime: Date;
  ArrivingTime: Date | null;
  SailingNotes: string;
  Annotations: string[];
  RouteID: number;
  RouteAbbrev: string;
  SailingDay: string;
};

export type RawWsfRouteScheduleData = {
  route: Route;
  segments: RawWsfScheduleSegment[];
  rawTripCount: number;
};
