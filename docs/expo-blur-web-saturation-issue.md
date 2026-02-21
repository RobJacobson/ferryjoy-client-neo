# BlurView web: hardcoded saturate(180%) causes unnatural color distortion

## Summary

On web, `BlurView` uses `backdrop-filter: saturate(180%) blur(Xpx)`, which makes blurred content appear **lighter and more saturated** than on iOS. The effect looks unnatural and does not match native platform behavior.

## Environment

- **Package:** expo-blur ~55.0.5
- **Platform:** Web (React Native Web)
- **Expected behavior:** Blur effect similar to iOS (natural, color-accurate)
- **Actual behavior:** Colors appear washed out, over-saturated, and lighter

## Root Cause

The web implementation in `BlurView.web.tsx` hardcodes `saturate(180%)` in the backdrop-filter:

```tsx
// packages/expo-blur/src/BlurView.web.tsx, line 59
const blur = `saturate(180%) blur(${Math.min(intensity, 100) * 0.2}px)`;
```

This produces CSS like:

```css
backdrop-filter: saturate(180%) blur(3.2px);
background-color: rgba(255, 255, 255, 0.05);
```

- **saturate(180%)** — Increases color saturation by 80%, causing an unnatural "vibrant" look
- **rgba overlay** — Combined with saturation, contributes to the lighter appearance

On iOS, `BlurView` uses native `UIVisualEffectView`, which does not apply this level of saturation. The web implementation appears to mimic iOS vibrancy, but the result diverges significantly.

## Reproduction

1. Create an Expo app with `expo-blur`
2. Add a `BlurView` over dynamic background content (e.g., animated waves, images)
3. Run on web: `expo start --web`
4. Compare with iOS: `expo run:ios`

Observed: Web blur shows lighter, more saturated colors; iOS blur looks natural.

## Proposed Solution

Add a way to control or disable saturation on web:

**Option A — New prop (recommended):**

```tsx
<BlurView
  intensity={16}
  tint="default"
  saturation={100}  // 100 = neutral, 180 = current default, configurable
/>
```

**Option B — Tint-driven saturation:**

Map `tint` to different saturation levels (e.g., `default` → 100%, `light` → 120%) so web better matches native behavior.

**Option C — Web-only override:**

Allow `saturation={100}` or `saturate={false}` to produce `blur(Xpx)` only, with no saturate, for users who want color-accurate blur on web.

## Workaround (current)

Platform-specific implementation: on web, use a custom `View` with `backdropFilter: 'blur(Xpx)'` (no saturate) instead of `BlurView`, or patch `expo-blur` via `patch-package` to change the hardcoded `saturate(180%)` to `saturate(100%)`.

## References

- [Expo BlurView docs](https://docs.expo.dev/versions/v55.0.0/sdk/blur-view/)
- [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)
- Source: `packages/expo-blur/src/BlurView.web.tsx`

---

## Appendix: Alternative library (@sbaiahmed1/react-native-blur)

**[@sbaiahmed1/react-native-blur](https://github.com/sbaiahmed1/react-native-blur)** offers more features (LiquidGlassView, ProgressiveBlurView, VibrancyView, etc.) and real native blur on both iOS and Android. However:

- **No web support** — The library targets iOS and Android only. There is no web implementation.
- **Would not fix this issue** — For an Expo app that runs on web, switching would require either:
  - Keeping expo-blur (or a custom web blur) for web and using react-native-blur for native, or
  - Dropping web support.
- **Expo compatibility** — The library is built for bare React Native (Fabric/Turbo Modules). Expo compatibility would need to be verified.

**Recommendation:** Stay with expo-blur for now and use the workaround (platform-specific blur on web or patching). If Expo adds a saturation prop in response to this issue, that would be the cleanest fix. Consider @sbaiahmed1/react-native-blur only if web is not a target or if you are willing to maintain a separate web blur implementation.
