/**
 * Segment type representing a single leg of a journey.
 */
export type Segment = {
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DisplayArrivingTerminalAbbrev?: string;
  DepartingTime: Date;
  ArrivingTime?: Date;
  SchedArriveNext?: Date;
  SchedArriveCurr?: Date;
  NextDepartingTime?: Date;
  DirectKey?: string;
  Key: string;
};
