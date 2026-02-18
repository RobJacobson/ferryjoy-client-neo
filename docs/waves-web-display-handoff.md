# Handoff: Waves Component Not Displaying on Web

**Status:** Unresolved. Waves render on native (iOS/Android) but do not display on web. Multiple fixes have been tried; the codebase currently has viewport-based and absolute-layout changes in place (see §7). The screen appears black on web; wave layers are not visible.

**Relevant code:** `src/features/Background/` (Background, Sky, Waves), `src/app/index.tsx`, `global.css`, `src/app/+html.tsx`.

---

## 1. Problem Summary

- **Symptom:** The Waves component (stack of animated wave layers: grass, ocean, foreground grass) is not visible when running the app in the web browser. Sky (gradient + sunburst) is visible on web; Waves are not.
- **Observed in DOM:** Wave layer elements exist in the DOM (e.g. divs with `absolute inset-0`), but **individual wave components have computed height = 0**. The viewport / screen container can have an expected size; the collapse happens somewhere in the chain from the screen root down to the Wave/SVG nodes.
- **Platform:** Works on native (iOS/Android); fails on web (Expo web / React Native Web).

---

## 2. Architecture Context

- **Background** (`Background.tsx`) renders a fragment: `<Sky />` then `<AnimatedWaves />`. Both receive `scrollX`, `slotWidth` for parallax.
- **Screen layout** (`index.tsx`): Root `View` (e.g. `h-full w-full flex-1`) → `BlurTargetView` (expo-blur, `absolute inset-0`) → `Background` → Sky + AnimatedWaves. Below that, `RoutesCarousel` (scrollable content) is a sibling of `BlurTargetView`.
- **AnimatedWaves** builds a stack of layers (grass, ocean, foreground). Each layer is a `ParallaxWaveLayer` (scroll-driven translateX) wrapping a `Wave` (AnimatedWave). Each `Wave` renders an `Animated.View` (absolute, top/right/bottom/left) containing a **react-native-svg** `<Svg>` with `width="100%"` `height="100%"`, viewBox, and `<Path>` elements for the wave shape.
- **Sky** uses `Animated.View` with `position: "absolute", left: 0, top: 0, bottom: 0, width: skyWidth` and an inner `View` with `className="absolute inset-0"`. It does not rely on flex or percentage height from a parent to get its size.

So: Sky gets height from its absolute positioning (top/bottom 0) relative to the BlurTargetView. Waves, in the original design, used a root `View` with `flex-1` and an inner `View` with `relative h-full`, so they depended on the BlurTargetView (and thus the root View) having a non-zero height for the flex/percentage chain to resolve.

---

## 3. Root Cause (Why Height Becomes 0 on Web)

On web, percentage and flex-based height often resolve differently than on native:

- **`h-full` (height: 100%)** only works if every ancestor up to the viewport has a defined height. If `html` / `body` or the RN web root don’t have an explicit height, the chain can collapse.
- The **root View** of the screen has only absolutely positioned children (BlurTargetView, and optionally RoutesCarousel). With no in-flow content (e.g. if the carousel is commented out), the root View may get **height 0** on web. Then:
  - BlurTargetView (`absolute inset-0`) → height 0
  - Waves root (absolute with `top: 0`, `bottom: 0`) → height 0
  - Inner Waves container and all `ParallaxWaveLayer` / Wave nodes (absolute inset-0 or similar) → height 0
- So the **wave components end up with height = 0** even when the “viewport” or window has a size. The user confirmed that the individual wave components have height = 0 in the browser.

Additionally, **react-native-svg** on web can be sensitive to parent size: if the parent has no explicit or computed height, an SVG with `height="100%"` may not render or may get 0 height. So both the layout chain and the SVG’s reliance on that chain matter.

**Correction (from browser DevTools):** The DOM root `#root` in the browser **does have non-zero dimensions** (e.g. 840×1023 observed). Computed CSS shows `#root, body, html { height: 100%; }` and `#root` has `display: flex`. So the collapse is **not** at the document/HTML root. Height is lost somewhere **between** `#root` and the wave/SVG nodes—i.e. somewhere in the React Native / Expo tree (e.g. Stack, screen wrapper, screen root View, BlurTargetView, or a child of Background). The next agent should identify the **first ancestor** of the wave elements that has computed height 0.

---

## 4. Attempted Fixes (All Reverted or Ineffective)

The following were tried; none produced a reliable, acceptable fix. They are documented so the next agent can avoid dead ends or build on them.

1. **Waves root: from flex to absolute positioning**  
   - **Change:** Replaced the outer Waves container from `View` with `className="flex-1"` to a `View` with `position: "absolute", left: 0, top: 0, bottom: 0, width: wavesWidth` so Waves would get height from the same containing block as Sky, without relying on flex.
   - **Result:** Waves still did not display on web. Height chain still collapsed when the root View had no in-flow content (e.g. carousel commented out).

2. **Inner Waves container: from `relative h-full` to absolute inset**  
   - **Change:** Replaced the inner `View` that had `className="relative h-full"` with one using `position: "absolute", left: 0, top: 0, right: 0, bottom: 0, width: wavesWidth` so it didn’t depend on percentage height.
   - **Result:** No visible improvement; wave components still had height 0.

3. **global.css: root height on web**  
   - **Change:** In `@layer base`, added `html, body { height: 100%; }` so that `height: 100%` could resolve to the viewport.
   - **Result:** Did not fix the Waves; the collapse may occur at the RN web root or flex layout, not only at html/body.

4. **z-index on Waves root**  
   - **Change:** Set `zIndex: 1` on the Waves root so it would stack above Sky.
   - **Result:** No change in visibility; issue was height, not stacking.

5. **Explicit pixel height for SVG on web (AnimatedWave)**  
   - **Change:** In `AnimatedWave.tsx`, used `Platform.OS === "web"` and `useWindowDimensions()` to set the `<Svg>` to `height={windowHeight}` on web instead of `height="100%"`.
   - **Result:** Waves still did not render. Parent containers were still 0 height, so this alone was insufficient. Also considered brittle: platform-specific logic in a presentational component.

6. **Explicit height on Waves root for web only (AnimatedWaves)**  
   - **Change:** In `AnimatedWaves.tsx`, used `Platform.OS === "web"` and `useWindowDimensions().height` to set an explicit `height` on the Waves root View on web.
   - **Result:** User reported waves still did not render. Approach was also considered brittle (platform-specific layout in the Waves feature). User reverted these Platform-based changes.

7. **Screen root: `min-h-screen` (viewport height) + AnimatedWaves root: absolute positioning (no flex)**  
   - **Change:** In `index.tsx`, root View `className` changed from `h-full w-full flex-1` to `min-h-screen w-full flex-1` so the root would get `min-height: 100vh` on web. In `AnimatedWaves.tsx`, the outer Waves container was changed from `<View className="flex-1">` to a `View` with `position: "absolute", left: 0, top: 0, right: 0, bottom: 0` so Waves would fill BlurTargetView without relying on flex.
   - **Result:** Waves still did not display on web; screen appeared black. (Note: browser inspection later showed `#root` has real dimensions, so the collapse is not at the HTML root.)

8. **AnimatedWave: remove Platform.OS and use `height="100%"` for SVG**  
   - **Change:** In `AnimatedWave.tsx`, SVG `height` was changed from `Platform.OS === "web" ? windowHeight : "100%"` to `height="100%"`; `useWindowDimensions()` and any `Platform` usage in that component were removed.
   - **Result:** No platform-specific code in Waves, but waves still do not show on web (parent chain likely still 0 height in places).

---

## 5. Why Platform-Specific Layout Was Rejected

The user explicitly did not want to fix the issue by adding `Platform.OS === "web"` branches in the Waves components (e.g. in `AnimatedWaves.tsx` or `AnimatedWave.tsx`). Reasons cited: brittleness and maintenance. A successful solution should ideally work across platforms with the same layout approach, or fix the root cause (e.g. why the web layout chain collapses) rather than papering over it with web-only height.

---

## 6. Suggestions for Further Research

- **Root cause of height collapse on web**
  - Trace exactly where height is lost: e.g. use React DevTools or DOM inspector to walk from the wave `<svg>` (or its wrapper) up to the root and record computed height at each level. Identify the first ancestor with height 0 and whether it’s the RN web root, the Stack layout, or the BlurTargetView.
  - Check how **expo-router**’s Stack and screen layout set height on web (e.g. does the screen wrapper get `min-height: 100vh` or `height: 100%`?). See if the app root or Stack can be given a defined height in a single place so all screens inherit it.
  - Check **React Native Web** behavior for a View that has only absolute children: does it get 0 height? If so, is there a recommended pattern (e.g. minimum height, or a wrapper that always has viewport height on web) that doesn’t require Platform checks inside feature code?

- **Layout strategy that works everywhere**
  - Consider giving the **screen root** (e.g. the View in `index.tsx`) an explicit height on all platforms when it’s the home screen (e.g. from `useWindowDimensions()` in the screen, not in Background/Waves). That way BlurTargetView and Background get a proper containing block without Platform logic inside the Waves feature.
  - Alternatively, ensure the **BlurTargetView** (or its parent) always has a defined height on web (e.g. via a shared layout or a single wrapper used only for the web shell in `+html.tsx` or root layout), so that absolute children (Sky and Waves) resolve height consistently.

- **react-native-svg on web**
  - Search for known issues: e.g. “react-native-svg height 100% web”, “react-native-svg not rendering web”, “react-native-svg parent height 0”. There are reports that percentage-sized SVGs need a parent with explicit dimensions on web.
  - Consider whether the SVG could be given dimensions from **onLayout** (measure the Wave container and pass width/height into the Svg as numbers) so it doesn’t rely on percentage height. That would be cross-platform and avoid Platform.OS.

- **Alternative rendering for web**
  - The repo has `docs/svg-to-skia.md` (migrating SVG to React Native Skia). Skia may have different web behavior. Evaluate whether rendering the waves with **Skia on web** (if supported) avoids the SVG/layout issues.
  - As a last resort, a **web-only implementation** of the waves (e.g. CSS/canvas or a different SVG mounting strategy) could live behind a single check at the Background or route level, rather than scattering Platform checks inside Wave/AnimatedWaves.

- **Minimal reproduction**
  - Create a minimal Expo web app: one View with absolute inset-0, one child with absolute top/bottom/left and a width, and inside that a View with absolute inset-0 and a react-native-svg Svg with 100% width/height. See if that reproduces 0 height on web and under what root layout (e.g. with/without html,body height, with/without flex-1 parent). That would isolate whether the issue is RN Web + SVG or something specific to this app’s layout.

---

## 7. Update: Latest investigation and current code state

**As of this handoff**, the following is in place and the issue remains unresolved on web.

### Current code state

- **`src/app/index.tsx`:** Screen root `View` has `className="min-h-screen w-full flex-1"` and `style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}`. `RoutesCarousel` is commented out. No `useWindowDimensions()` on the screen root.
- **`src/features/Background/Background.tsx`:** Renders only `AnimatedWaves` (Sky is commented out).
- **`src/features/Background/Waves/AnimatedWaves.tsx`:** Outer container is a `View` with `style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}` (no `flex-1`). Inner `View` has the same plus `width: wavesWidth`. ParallaxWaveLayer and Wave children unchanged.
- **`src/features/Background/Waves/AnimatedWave.tsx`:** SVG uses `width="100%"` and `height="100%"`. No `Platform` or `useWindowDimensions()` in this file.
- **`global.css`:** Contains `html, body { height: 100%; }` in `@layer base`. No `#root` styling there; NativeWind or the app may add `#root, body, html { height: 100%; }` and `#root { display: flex }` elsewhere.

### Corrected understanding from browser inspection

- In the browser, **`#root` has non-zero dimensions** (e.g. 840×1023) and computed styles include `#root, body, html { height: 100%; }`, `#root { display: flex }`. So the document root is sized; the collapse happens **inside** the React/RN tree.
- **Layout chain to inspect (from root down to wave):**  
  `#root` → (Providers → GestureHandlerRootView → Stack → screen wrapper?) → **screen root View** (index) → **BlurTargetView** → Background → **AnimatedWaves outer View** → AnimatedWaves inner View → ParallaxWaveLayer → Wave `Animated.View` → `Svg`. The **first** node in this chain with computed height 0 is where the break is.

### Recommended next steps for the next agent

1. **Find the first 0-height node:** In browser DevTools, select the wave `<svg>` (or its wrapper div) and walk **up** the DOM, noting the **computed height** of each ancestor. The first ancestor with height 0 is the one that needs a fix (or its parent must be fixed to give it height).
2. **Colored-background trace:** Add temporary `backgroundColor` at each level (e.g. red on screen root View, orange on AnimatedWaves outer, yellow on AnimatedWaves inner, green on ParallaxWaveLayer, blue on Wave container). The first color that does not appear (or is a thin line) corresponds to the first 0-height node.
3. **Try explicit height on screen root:** In `index.tsx`, use `useWindowDimensions()` and set the screen root `View`’s `style` to include `minHeight: height` (or `height`). This is cross-platform (no `Platform.OS`) and may fix the issue if the break is at or above the screen root (e.g. Stack not passing height down).
4. **Expo Router / Stack on web:** Check how expo-router’s Stack and screen layout set height on web. The screen root View might be inside a wrapper that has 0 height; fixing that wrapper or the Stack’s web layout could resolve the chain for all screens.

---

## 8. Key Files

| File | Role |
|------|------|
| `src/app/index.tsx` | Screen root View, BlurTargetView, Background, RoutesCarousel. |
| `src/features/Background/Background.tsx` | Renders Sky + AnimatedWaves. |
| `src/features/Background/Waves/AnimatedWaves.tsx` | Waves root and inner container; ParallaxWaveLayer list. |
| `src/features/Background/Waves/AnimatedWave.tsx` | Single wave: Animated.View + react-native-svg Svg/Path. |
| `src/features/Background/Sky/Sky.tsx` | Reference: absolute positioning that works on web. |
| `src/features/Background/parallaxWidth.ts` | `computeRequiredBackgroundWidth` (wavesWidth). |
| `global.css` | Base styles; may contain `html, body { height: 100%; }` from attempts. |
| `src/app/+html.tsx` | Web-only HTML shell; body is the root for the app. |

---

## 9. How to Reproduce

1. Run the app for web (e.g. `bun run web` or `npx expo start --web`).
2. Open the home screen (index).
3. In DevTools, locate a wave layer (e.g. a div with `absolute inset-0` under the BlurTargetView). Check computed height of that div and its ancestors; typically the wave nodes will show height 0.
4. Optionally comment out RoutesCarousel (and Sky) to reduce variables; the root View then has no in-flow content, which makes the height collapse more likely on web.

## 10. Additional Attempts and Findings (Feb 17, 2026)

The following attempts were made to resolve the height collapse on web without using platform-specific code. All were unsuccessful and have been reverted.

1. **Global CSS Root Reinforcement**
   - **Change:** Updated `global.css` to force `html, body, #root` to `height: 100%` and added aggressive rules for `[data-expo-container]` and `div[style*="display: flex"]` with `!important` to ensure they fill the viewport.
   - **Result:** Ineffective. While `#root` has height, children inside the React Native tree still resolve to height 0.

2. **Absolute Inset Root in `index.tsx`**
   - **Change:** Changed the screen root `View` from `flex-1` to `absolute inset-0 w-full` to bypass the flex-chain.
   - **Result:** Ineffective. The root `View` itself failed to expand, resulting in a black screen.

3. **Diagnostic Color Trace**
   - **Change:** Added semi-transparent background colors (Red, Blue, Green, Yellow, Magenta) at every level of the background stack and `onLayout` logging in `AnimatedWave.tsx`.
   - **Findings:** 
     - Only "yellow-green" was visible, indicating a collapse at the individual wave level.
     - `onLayout` logs confirmed `height: 0` for all wave components (e.g., `Object { x: 0, y: 0, width: 2640, height: 0 }`).
     - Width was correctly calculated, but height was lost.

4. **Forced Window Height in `AnimatedWaves.tsx`**
   - **Change:** Used `windowHeight` from `useWindowDimensions()` to set an explicit pixel height on the `AnimatedWaves` container.
   - **Result:** Ineffective. Even with a sized container, the SVG children with `height="100%"` still failed to render or resolved to 0 height.

5. **SVG Scaling Strategy (`preserveAspectRatio`)**
   - **Change:** Set `Svg` to `height="100%"` and used `preserveAspectRatio="xMidYMax slice"` to pin waves to the bottom.
   - **Result:** Ineffective. The SVG still collapsed to 0 height.

6. **Standard HTML `div` Containers (REJECTED)**
   - **Change:** Attempted to use standard HTML `div` elements for the layout containers in `Background.tsx` and `AnimatedWaves.tsx` to bypass React Native Web's `View` logic.
   - **Result:** Rejected by the user as `div` is not acceptable in a React Native codebase.

### Final Finding:
The height collapse is persistent across all standard React Native Web layout patterns (`flex`, `absolute`, `percentage`). Even when the window dimensions are known, the nested `View` components and `react-native-svg` elements fail to resolve their height correctly on the web platform. The issue appears to be a fundamental incompatibility between how the current component stack calculates layout and how Expo/React Native Web handles absolute positioning of SVGs inside containers with no in-flow content.

---
*Document updated to include latest failed attempts and diagnostic findings.*
