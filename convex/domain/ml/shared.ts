const REFERENCE_TIME = new Date(2025, 0, 1);
const MINUTE_IN_MS = 60 * 1000;

export const toNormalizedMinutes = (date: Date): number =>
  (date.getTime() - REFERENCE_TIME.getTime()) / MINUTE_IN_MS;

export const fromNormalizedMinutes = (minutes: number): Date =>
  new Date(minutes * MINUTE_IN_MS - REFERENCE_TIME.getTime());
