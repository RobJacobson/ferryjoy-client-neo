export type TripTimelineCardStatus = "future" | "atDock" | "atSea" | "arrived";

export type TripTimelineCardProps = {
  status: TripTimelineCardStatus;
  fromTerminal: string;
  toTerminal: string;
  startTime: Date;
  departTime: Date;
  endTime: Date;
  VesselName: string;
  VesselStatus: string;
};
