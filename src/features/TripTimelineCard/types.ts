export type TripTimelineCardStatus = "future" | "atDock" | "atSea" | "arrived";
export type TripTimelineCardDirection = "eastward" | "westward";

export type TripTimelineCardProps = {
  direction: TripTimelineCardDirection;
  status: TripTimelineCardStatus;
  fromTerminal: string;
  toTerminal: string;
  startTime: Date;
  departTime: Date;
  endTime: Date;
};
