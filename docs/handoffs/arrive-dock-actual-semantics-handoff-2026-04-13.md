# ArriveDockActual Semantics Handoff

`AtDockActual` in `vesselTrips` is currently overloaded. In practice it behaves
like "when this tracked trip / dock occupancy started," not "when the trip
arrived at dock" or "when the trip ended."

Why this should be handled separately:
- it is stored on both `activeVesselTrips` and `completedVesselTrips`
- lifecycle builders in `baseTripFromLocation.ts` actively read and write it
- it is exposed through shared trip schemas and query payloads
- a simple rename would silently invert the meaning of an in-use backend field

Recommended follow-up:
- introduce a clearly named arrival-boundary field, likely `ArriveDockActual`
  or `ArriveNextActual`, populated only from observed arrival boundaries
- decide whether the current `AtDockActual` concept is still needed; if so,
  rename it to something like `DockOccupancyStart`
- migrate lifecycle, query, and test code in a dedicated pass rather than
  combining it with the `TripKey` strictness work
