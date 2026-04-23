export type TripLifecycleEventFlags = {
  isFirstTrip: boolean;
  isTripStartReady: boolean;
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  scheduleKeyChanged: boolean;
};
