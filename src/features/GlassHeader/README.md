# GlassHeader Feature

Modern glass header component using Expo's native liquid glass effect for iOS 26+.

## Overview

This component replaces the legacy `BlurHeader` feature with Expo's native `expo-glass-effect` package, providing authentic iOS 26 liquid glass effects while maintaining backward compatibility.

## Components

### `GlassHeader`

A modern screen wrapper that adds native iOS liquid glass header effects.

**Features:**
1. **Native liquid glass** on iOS 26+ using `UIVisualEffectView`
2. **Progressive blur effect** that blurs content as it enters the header area
3. **Graceful fallbacks** for older platforms (simple tinted overlay)
4. **Automatic contentInsetTop** calculation for ScrollView padding
5. **Same API** as legacy BlurPage for easy migration

```tsx
import { GlassHeader } from "@/features/GlassHeader";

<GlassHeader
  navBarHeight={56}
  tintColor="rgba(255, 255, 255, 0.8)"
  glassEffectStyle="regular"
>
  {({ contentInsetTop }) => (
    <ScrollView style={{ paddingTop: contentInsetTop }}>
      {/* Your content */}
    </ScrollView>
  )}
</GlassHeader>
```

## API Reference

### GlassHeader Props

```tsx
interface GlassHeaderProps {
  children: React.ReactNode | ((layout: GlassHeaderLayout) => React.ReactNode);
  navBarHeight?: number;  // Default: 56
  style?: StyleProp<ViewStyle>;
  tintColor?: string;    // Default: "rgba(255, 255, 255, 0.8)"
  glassEffectStyle?: "regular" | "clear";  // Default: "regular"
  enableProgressiveBlur?: boolean;  // Default: true
  blurIntensity?: number;  // Default: 20, blur strength (0-100)
}

interface GlassHeaderLayout {
  contentInsetTop: number;  // Total overlay height
  safeAreaTop: number;      // Safe area inset
  navBarHeight: number;     // Header area height
}
```

## Platform Support

- **iOS 26+**: Native liquid glass effect using `UIVisualEffectView`
- **Older iOS/Android/Web**: Simple tinted View fallback

## Migration from BlurHeader

The `GlassHeader` component provides the same API as the legacy `BlurPage` component, making migration straightforward:

```tsx
// Before (BlurHeader)
import { BlurPage } from "@/features/BlurHeader";

<BlurPage
  navBarHeight={56}
  overlayProps={{
    progressive: true,
    fadeStart: 0.5,
    opacity: 0.8,
    blurAmount: 2,
    blurType: "xlight",
  }}
>
  {({ contentInsetTop }) => <Content />}
</BlurPage>

// After (GlassHeader)
import { GlassHeader } from "@/features/GlassHeader";

<GlassHeader
  navBarHeight={56}
  tintColor="rgba(255, 255, 255, 0.8)"
  glassEffectStyle="regular"
>
  {({ contentInsetTop }) => <Content />}
</GlassHeader>
```

## Dependencies

- `expo-glass-effect` - Native liquid glass effects
- `react-native-safe-area-context` - Safe area insets

## Benefits over BlurHeader

1. **Native performance** - Uses Apple's native glass implementation
2. **Simpler codebase** - No complex blur/gradient rendering logic
3. **Better compatibility** - Official Expo package with proper fallbacks
4. **Future-proof** - Automatically benefits from iOS glass improvements
5. **Smaller bundle** - Eliminates multiple third-party blur dependencies