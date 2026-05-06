/**
 * Compatibility wrapper for legacy actual reload hydration imports.
 *
 * Actual reload hydration now belongs to the actual event domain. This module
 * remains only to keep older imports working during the migration window.
 */

export { hydrateActualTransitionsFromReloadInputs as buildHydratedTransitionsFromReloadInputs } from "../actual/hydrateActualTransitionsFromReloadInputs";
