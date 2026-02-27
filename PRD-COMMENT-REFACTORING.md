# Comment Refactoring PRD

## Executive Summary

Standardize function-level documentation across ~300 TypeScript/TSX files in the codebase. This refactoring will improve code readability and reduce visual noise by removing verbose prop-level comments while ensuring consistent TSDoc coverage for IntelliSense and high-level intent documentation.

## Current State

### Inconsistent Comment Patterns Found

1. **Verbose multi-line prop comments** (TimeBox, TimelineBar, TimelineMarker, TimelineBlock, StandardMarkerLayout, TimelineIndicator, TimelineMarkerTime, ScheduledTripCard, VesselTripCard, TripCard, TimelineMarkerContent)
   - Example: TimeBoxProps has ~15 lines of prop comments for 6 props
   - Creates "scroll fatigue" - pushes actual code far from view

2. **No prop comments** (VesselTripTimeline, TimelineBarAtDock, TimelineBarAtSea)
   - Types are self-documenting via TypeScript
   - This is the desired end state for most props

3. **Minimal single-line prop comments** (VesselTripList, TimelineMarkerLabel)
   - Reasonable middle ground when needed

4. **Mixed function TSDoc coverage**
   - Utility functions (extractors.ts, durationUtils.ts, dateConversions.ts) have consistent TSDoc
   - Components vary: some have full TSDoc with @params, some are incomplete

## Desired End State

### 1. Type Definitions (Props, Interfaces)
```typescript
type VesselTripTimelineProps = {
  vesselLocation: VesselLocation;
  trip: VesselTripWithScheduledTrip;
  className?: string;
  // NO inline comments - names and types are self-documenting
};
```

**Exception:** Add prop-level comment ONLY when:
- Prop interacts with others in non-obvious ways
- Important constraints not conveyed by type
- Behavior depends on specific conditions
  ```typescript
  type TimelineBlockProps = {
    equalWidth?: boolean;
    /**
     * Total number of blocks. Only used when equalWidth is true,
     * to set minWidth to 100/segmentCount%.
     */
    segmentCount?: number;  // ← Complex logic warrants comment
  };
  ```

### 2. All Functions (Exported and Internal)
```typescript
/**
 * Displays vessel trip progress with at-dock and at-sea segments.
 *
 * @param vesselLocation - Real-time WSF data
 * @param trip - Actual/predicted trip data
 * @param className - Optional container className
 */
const VesselTripTimeline = ({ vesselLocation, trip, className }: Props) => {
  // ...
};
```

**Note:** TSDoc should be added for ALL functions, including internal helpers. The purpose is:
- Provide IntelliSense for IDE users
- Document high-level purpose and intent
- Err on the side of too much documentation rather than too little

## Two-Phase Refactoring Strategy

### Phase 1: Add/Update Function TSDoc
Ensure every function (exported and internal) has TSDoc with `@param` for each parameter.

**Scope:** All `.ts` and `.tsx` files

**Tasks per file:**
1. List all functions (exported and internal)
2. Add/update TSDoc comment above each:
   - One-line description of what it does (purpose and intent)
   - One-line `@param` for each parameter
   - `@returns` when meaningful (not obvious from context)
3. Keep descriptions concise (1-2 lines max)
4. **Even for obvious functions** - TSDoc provides IntelliSense and documents high-level intent

**Example transformation:**
```typescript
// BEFORE
const VesselTripTimeline = ({ vesselLocation, trip, className }: Props) => {...};

// AFTER
/**
 * Displays vessel trip progress with at-dock and at-sea segments.
 *
 * @param vesselLocation - Real-time WSF data
 * @param trip - Actual/predicted trip data
 * @param className - Optional container className
 */
const VesselTripTimeline = ({ vesselLocation, trip, className }: Props) => {...};
```

### Phase 2: Remove Prop-Level Comments
Remove all prop-level JSDoc comments from type definitions, except for complex interaction cases.

**Scope:** All `.ts` and `.tsx` files

**Tasks per file:**
1. Identify all type definitions with prop comments
2. Remove inline `/** ... */` comments for props
3. Keep comment only if:
   - Prop interacts with other props in complex ways
   - Has important constraints the type doesn't convey
   - Behavior is conditional on other props
4. Use judgment: if the comment explains business logic, constraints, or interactions, preserve it

**Example transformation:**
```typescript
// BEFORE
type TimeBoxProps = {
  /**
   * Label text to display (e.g., "Arrive SEA", "Left ABC").
   */
  label: string;
  /**
   * Scheduled time for this event.
   */
  scheduled: Date;
  // ... more verbose comments
};

// AFTER
type TimeBoxProps = {
  label: string;
  scheduled: Date;
  // Names + types tell the story
};
```

## Folder Assignments for Parallel Agents

### Strategy: Group by Feature/Domain

Assign each agent a logical domain group:

| Agent | Folders | Approx. Files |
|-------|---------|---------------|
| Agent 1 | `src/features/TimelineFeatures/*` | 17 files |
| Agent 2 | `src/components/*` | 42 files |
| Agent 3 | `convex/domain/*` | ~30 files |
| Agent 4 | `convex/functions/vesselLocation/*` | ~15 files |
| Agent 5 | `convex/functions/vesselTrips/*` | ~20 files |
| Agent 6 | `convex/functions/scheduledTrips/*` | ~15 files |
| Agent 7 | `convex/shared/*` | ~10 files |
| Agent 8 | `convex/functions/vesselPings/*`, `convex/functions/predictions/*`, `convex/functions/vesselOrchestrator/*` | ~15 files |
| Agent 9 | `src/shared/*`, `src/data/*`, `src/hooks/*` | ~30 files |
| Agent 10 | Remaining folders (test files, misc) | ~100 files |

**Each agent's workflow:**
1. Receive assigned folder(s)
2. List all `.ts` and `.tsx` files in scope
3. **Phase 1:** Add/update function TSDoc (one pass through all files)
4. **Phase 2:** Remove prop comments (second pass)
5. Run `bun run check:fix` and `bun run type-check`
6. Report completion with summary

## Quality Assurance

### Pre-flight Checks (Before Starting)

1. **Run baseline linting:**
   ```bash
   bun run check:fix
   bun run type-check
   ```
   Document existing warnings/errors.

2. **Create test sample:**
   - Pick 5 representative files
   - Apply changes manually
   - Review with team
   - Use as reference for all agents

### During Refactoring

1. **Each agent must:**
   - Run linter after each file
   - Fix any issues immediately
   - Document decisions on edge cases
   - When in doubt, add the comment (err on side of documentation)

2. **Cross-agent coordination:**
   - Share patterns/questions in shared doc
   - Get alignment on ambiguous cases
   - Don't proceed on ambiguous cases without consensus

### Post-flight Checks (Per Agent)

1. **Linting:** `bun run check:fix` - should pass
2. **Type checking:** `bun run type-check` - should pass
3. **Test suite:** `bun run test` - all tests must pass
4. **Git diff:** Review changes, ensure no unintended deletions

### Final Integration

1. **Merge all agent work**
2. **Run full test suite**
3. **Manual review of sample files** (random selection)
4. **Deploy to staging, smoke test**
5. **Merge to main**

## Risk Mitigation

### High-Risk Areas

1. **Complex types with nested generics** - Manual review required
2. **Types with both prop comments and type-level JSDoc** - Only remove prop comments, preserve type-level documentation
3. **Exported types used across boundaries** - Ensure clarity preserved
4. **Types with comments explaining business logic** - May need preservation - use judgment

### Rollback Plan

1. Work on feature branch: `comment-refactoring-{date}`
2. Commit after each folder completion
3. If issues found: revert to last known good commit
4. Document issues in shared notes for other agents

## Success Criteria

### Quantitative
- [ ] All functions (exported and internal) have TSDoc with `@param`
- [ ] 95%+ reduction in prop-level comments (excluding complex cases)
- [ ] Zero new linter warnings/errors
- [ ] Zero new type errors
- [ ] All tests passing

### Qualitative
- [ ] Code more readable (can see implementation without scrolling)
- [ ] IntelliSense helpful for all functions
- [ ] High-level intent and purpose documented
- [ ] Team satisfied with new patterns

## Timeline

| Phase | Duration | Owner | Notes |
|-------|----------|-------|-------|
| Sample manual review | 0.5 days | All | Align on patterns |
| Phase 1 (TSDoc) | 2-3 days | 10 agents | Parallel work |
| Phase 2 (Prop comment removal) | 2-3 days | 10 agents | Parallel work |
| QA & Integration | 1-2 days | Tech lead | Final review |

**Total:** 5.5-8.5 days

## References

- Updated code style guide: `.cursor/rules/code-style.mdc`
- Example files: TimelineFeatures/ directory
- Industry guidance: "Code Complete" - comment on why, not what

---

**Document Version:** 2.0
**Created:** 2026-02-25
**Updated:** 2026-02-25
**Owner:** Tech Team
**Status:** Draft - Pending Team Review
