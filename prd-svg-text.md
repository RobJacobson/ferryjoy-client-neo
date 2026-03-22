**PRD: Cross-Platform Decorative Stroke Text Component**

**Goal**

Create a reusable cross-platform decorative text component for iOS, Android, and web using `react-native-svg`, intended for stylized display text with fill + outline. It should replace the current fake-outline approach for decorative timeline text while avoiding native-only dependencies.

**Problem**

Our current outlined-text solution duplicates text with offsets to simulate a stroke. It works, but it is visually brittle, more expensive than ideal, and feels hacky. We want a more principled implementation that:

- works consistently across iOS, Android, and web
- uses our existing `react-native-svg` dependency
- supports loaded custom fonts
- is appropriate for decorative display text
- preserves accessibility through an outer wrapper

This is not meant to replace all `Text` usage. It is only for decorative display text such as terminal names, labels, and times.

**Non-Goals**

- Full drop-in parity with React Native `Text`
- Rich text / nested spans
- Inline text composition inside paragraphs
- Text selection, copy, editing, or cursor behavior
- Advanced typographic shaping beyond what SVG text already provides
- Full support for every `TextStyle` prop

**Primary Use Cases**

- Timeline terminal names
- Timeline event labels
- Timeline event times
- Other decorative headings or badges with outline/stroke styling

**User Experience Requirements**

- Decorative text should render with a visible stroke and fill.
- Custom loaded fonts must be supported via `fontFamily`.
- The component should feel easy to use for engineers familiar with `Text`.
- Accessibility should remain correct for screen readers.
- The component should degrade gracefully for simple decorative use, not try to solve every text-layout problem.

**Functional Requirements**

1. Provide a reusable component, tentatively named `StrokeText`.
2. Render text using `react-native-svg`.
3. Accept plain string content.
4. Support these props initially:
   - `children` or `text` (one required; choose one primary API and document it)
   - `style`
   - `strokeColor`
   - `strokeWidth`
   - `fillColor` or use `style.color`
   - `accessible`
   - `accessibilityLabel`
   - `numberOfLines` if practical
   - `ellipsizeMode` if practical
   - `testID`
5. Support these style-derived properties at minimum:
   - `color`
   - `fontSize`
   - `fontFamily`
   - `fontWeight` if supported cleanly
   - `textAlign`
   - `lineHeight` if practical
6. The outermost layer should be the accessibility layer.
   - It should wrap the inner SVG layer.
   - The SVG itself should be treated as presentational.
7. The component should support decorative usage without requiring the caller to manually duplicate text for accessibility.
8. The component should work on web without native-module setup.

**Accessibility Requirements**

- The outer wrapper is the accessibility element.
- If the text is meaningful, expose it via `accessibilityLabel`.
- If no `accessibilityLabel` is provided, derive one from the input text when reasonable.
- The inner SVG should be hidden from accessibility / treated as decorative.
- For explicitly decorative usage, allow opt-out from accessibility exposure.

Recommended model:
- wrapper `View` owns accessibility
- inner `Svg` is hidden from assistive tech

**API Guidance**

Favor a `Text`-like API, but do not claim full parity.

Preferred example shape:
```tsx
<StrokeText
  style={{
    fontFamily: "Puffberry",
    fontSize: 30,
    color: theme.labels.terminalNameColor,
  }}
  strokeColor="white"
  strokeWidth={2}
  accessibilityLabel="Fauntleroy"
>
  Fauntleroy
</StrokeText>
```

Implementation may also support:
```tsx
<StrokeText text="Fauntleroy" ... />
```

Choose one primary pattern and keep it consistent.

**Technical Approach**

- Use `react-native-svg`.
- Render one SVG text element with `fill` and `stroke`.
- Use a wrapping container for layout and accessibility.
- Normalize a small subset of `TextStyle` into SVG-compatible props.
- Keep implementation intentionally narrow and explicit.

Questions the implementing agent should answer during design:
- Whether to use `children: string` or `text: string` as the main API
- Whether width/height should be explicit, measured, or inferred
- Whether multiline and ellipsis should be v1 or deferred
- Whether a helper should normalize `TextStyle` into SVG text props

**Suggested Deliverables**

1. New reusable component for decorative stroked text
2. Clear prop typing and docs/comments
3. Focused usage example in one timeline component, preferably terminal name first
4. Web-safe behavior
5. Accessibility wrapper implementation
6. Basic tests if feasible, or at least strong local verification

**Implementation Constraints**

- No new third-party dependency beyond `react-native-svg`
- Keep the component small and understandable
- Prefer explicit supported props over “accept everything”
- Do not break existing non-decorative text usage
- Avoid premature abstraction for rich text

**Rollout Plan**

Phase 1:
- Build `StrokeText`
- Use it only in terminal-name rendering
- Compare visual output and positioning against current implementation

Phase 2:
- If successful, consider migrating event labels and times
- Only migrate cases where decorative stroke text is clearly beneficial

**Acceptance Criteria**

- Renders stroked decorative text on iOS, Android, and web
- Supports loaded custom fonts such as `Puffberry`
- Accessibility is handled by the outer wrapper
- SVG is presentational, not the primary accessibility node
- Terminal-name usage works without native-only dependencies
- API is simple and intentionally limited
- Code is easier to reason about than the current fake-outline text approach

**Open Questions**

- Do we want `children` string only, or `text` prop only, or both?
- Do we need multiline in v1?
- Do we need ellipsis in v1?
- Should the component infer its own size, or should decorative usages provide bounded layout?
- How closely do we want style compatibility with `Text` before it becomes over-engineered?

If you want, I can turn this into a more agent-ready handoff format with:
- scope
- files to create
- files likely to change
- step-by-step implementation checklist
- verification checklist