/**
 * Vessel-location normalization and batch validation for raw WSF feed rows.
 *
 * This module owns the Stage B business transformation from raw transport rows
 * into canonical `ConvexVesselLocation` POJOs. The surrounding functions layer
 * handles fetch, dedupe, and persistence.
 */

import {
  resolveTerminalByAbbrev,
  resolveVessel,
  type TerminalIdentity,
  type VesselIdentity,
} from "adapters";
import type { ConvexVesselLocationIncoming } from "functions/vesselLocation/schemas";
import { dateToEpochMs, optionalDateToEpochMs } from "shared/convertDates";
import { calculateDistanceInMiles } from "shared/distanceUtils";
import { deriveTripIdentity } from "shared/tripIdentity";
import type { VesselLocation as WsfVesselLocation } from "ws-dottie/wsf-vessels/core";

/**
 * Maps raw WSF feed rows into canonical vessel-location rows.
 *
 * Rows that fail normalization are skipped individually with a warning so one
 * bad feed row does not poison the full batch.
 *
 * @param rows - Raw vessel-location rows from the WSF transport layer
 * @param vessels - Backend vessel identity rows used for abbreviation lookup
 * @param terminals - Backend terminal identity rows used for normalization
 * @returns Successfully normalized vessel-location rows only
 */
export const mapWsfVesselLocations = (
  rows: ReadonlyArray<WsfVesselLocation>,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ConvexVesselLocationIncoming[] =>
  rows
    .map((row) => {
      try {
        return normalizeWsfVesselLocationRow(row, vessels, terminals);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.warn(
          `[vesselLocation] Skipping feed row (VesselID=${row.VesselID}, VesselName=${JSON.stringify(row.VesselName ?? "")}): ${detail}`
        );
        return undefined;
      }
    })
    .filter((loc): loc is ConvexVesselLocationIncoming => loc !== undefined);

/**
 * Normalizes one raw WSF vessel-location row into canonical storage shape.
 *
 * @param row - Raw WSF vessel-location row
 * @param vessels - Backend vessel identity rows used for vessel resolution
 * @param terminals - Backend terminal identity rows used for terminal normalization
 * @returns Canonical vessel-location row
 */
const normalizeWsfVesselLocationRow = (
  row: WsfVesselLocation,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ConvexVesselLocationIncoming => {
  const rawDepartAbbrev = trimFeedStr(row.DepartingTerminalAbbrev);
  if (!rawDepartAbbrev) {
    throw new Error(
      "Missing departing terminal abbreviation in vessel location."
    );
  }

  const vesselName = trimFeedStr(row.VesselName);
  const vessel = resolveVessel(vesselName, vessels);
  const rawArriveAbbrev = trimFeedOpt(row.ArrivingTerminalAbbrev);
  const depTerminal = resolveTerminalByAbbrev(rawDepartAbbrev, terminals);
  const arrTerminal = rawArriveAbbrev
    ? resolveTerminalByAbbrev(rawArriveAbbrev, terminals)
    : null;

  if (!depTerminal) {
    warnAboutUnknownMarineLocation(
      "departing",
      vessel.VesselAbbrev,
      rawDepartAbbrev
    );
  }
  if (rawArriveAbbrev && !arrTerminal) {
    warnAboutUnknownMarineLocation(
      "arriving",
      vessel.VesselAbbrev,
      rawArriveAbbrev
    );
  }

  const depAbbrev = depTerminal?.TerminalAbbrev ?? rawDepartAbbrev;
  const arrAbbrev = arrTerminal?.TerminalAbbrev ?? rawArriveAbbrev;
  const scheduledDepartureMs = optionalDateToEpochMs(row.ScheduledDeparture);

  return {
    VesselID: row.VesselID,
    VesselName: vesselName,
    VesselAbbrev: vessel.VesselAbbrev,
    DepartingTerminalID: row.DepartingTerminalID,
    DepartingTerminalName:
      depTerminal?.TerminalName ?? trimFeedStr(row.DepartingTerminalName),
    DepartingTerminalAbbrev: depAbbrev,
    ArrivingTerminalID: row.ArrivingTerminalID ?? undefined,
    ArrivingTerminalName:
      arrTerminal?.TerminalName ?? trimFeedOpt(row.ArrivingTerminalName),
    ArrivingTerminalAbbrev: arrAbbrev,
    Latitude: row.Latitude,
    Longitude: row.Longitude,
    Speed: row.Speed,
    Heading: row.Heading,
    InService: row.InService,
    AtDock: row.AtDock,
    LeftDock: optionalDateToEpochMs(row.LeftDock),
    Eta: optionalDateToEpochMs(row.Eta),
    ScheduledDeparture: scheduledDepartureMs,
    RouteAbbrev: row.OpRouteAbbrev?.[0] ?? undefined,
    VesselPositionNum: row.VesselPositionNum ?? undefined,
    TimeStamp: dateToEpochMs(row.TimeStamp),
    ScheduleKey: deriveTripIdentity({
      vesselAbbrev: vessel.VesselAbbrev,
      departingTerminalAbbrev: depAbbrev,
      arrivingTerminalAbbrev: arrAbbrev,
      scheduledDepartureMs,
    }).ScheduleKey,
    DepartingDistance: getDistanceToTerminal(
      row.Latitude,
      row.Longitude,
      depAbbrev,
      terminals
    ),
    ArrivingDistance: getDistanceToTerminal(
      row.Latitude,
      row.Longitude,
      arrAbbrev,
      terminals
    ),
  };
};

/**
 * Trims a required feed string to the Convex `v.string()` shape.
 *
 * @param value - Raw text from the WSF payload
 * @returns Trimmed string (empty when missing)
 */
const trimFeedStr = (value: string | undefined | null): string =>
  (value ?? "").trim();

/**
 * Trims an optional feed string; preserves empty string when the field is present.
 *
 * @param value - Raw optional text from the WSF payload
 * @returns Trimmed text, or `undefined` when the field is absent
 */
const trimFeedOpt = (value: string | undefined | null): string | undefined =>
  value == null ? undefined : value.trim();

/**
 * Measures the vessel's distance from a known terminal when that terminal can
 * be resolved from backend identity data.
 *
 * @param latitude - Vessel latitude in decimal degrees
 * @param longitude - Vessel longitude in decimal degrees
 * @param terminalAbbrev - Terminal abbreviation from the raw feed
 * @param terminals - Backend terminal identity rows used for coordinate lookup
 * @returns Distance in miles, or `undefined` when the terminal cannot be resolved
 */
const getDistanceToTerminal = (
  latitude: number,
  longitude: number,
  terminalAbbrev: string | undefined | null,
  terminals: ReadonlyArray<TerminalIdentity>
): number | undefined => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminal = resolveTerminalByAbbrev(terminalAbbrev, terminals) ?? null;

  return calculateDistanceInMiles(
    latitude,
    longitude,
    terminal?.Latitude,
    terminal?.Longitude
  );
};

/**
 * Warns once per role and terminal abbreviation when the raw feed references a
 * marine location missing from backend terminal identity data.
 *
 * @param role - Whether the unresolved terminal is departing or arriving
 * @param terminalAbbrev - Unknown terminal abbreviation from the raw feed
 * @returns Nothing after the one-time warning check completes
 */
const warnAboutUnknownMarineLocation = (
  role: "departing" | "arriving",
  vesselAbbrev: string,
  terminalAbbrev: string
): void => {
  console.warn(
    `[vesselLocation] Unknown ${role} terminal for vessel ${vesselAbbrev}: ${terminalAbbrev}`
  );
};
