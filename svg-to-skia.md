# Refactor Memo: Migrating SVG Waves to React Native Skia

## Overview
The current implementation of animated waves uses `react-native-svg`. While functional, it suffers from a "visual pop" during initial load (where colors appear ~500ms before textures) and has potential performance bottlenecks when animating complex clipped paths. 

This memo outlines the strategy for migrating to `react-native-skia` to achieve synchronous, GPU-accelerated rendering and a more robust architecture.

---

## 1. Identified Problems

### A. Asynchronous Texture "Pop"
In `react-native-svg`, the native engine renders the SVG paths immediately, but image decoding for textures happens asynchronously on a separate thread. This causes the wave to appear as a solid color before the paper texture is applied.

### B. Bridge Overhead
Animating 12+ wave instances via `Animated.View` (Reanimated) wrappers around individual `<Svg>` components creates significant bridge traffic and layout overhead.

### C. Clipping vs. Shaders
The `AnimatedWaveClipped` approach (using `<ClipPath>`) is computationally expensive for native SVG engines as it requires stencil calculations for every frame. Skia's `ImageShader` is a single-pass GPU operation.

---

## 2. Refactor Strategy

### Step 1: Global Texture Management (Root Level)
To ensure the texture is decoded only once and shared across all components, we will move the image loading to the root `src/app/index.tsx`.

- **Action:** Use Skia's `useImage` hook at the root.
- **Benefit:** Prevents redundant GPU uploads and ensures all components have access to the same `SkImage` pointer.
- **Pattern:** Prop drill the `SkImage` object down to the feature components.

### Step 2: Component Refactor (`AnimatedWave.tsx`)
Translate the SVG structure to Skia's declarative API.

- **Container:** Replace `<Svg>` with `<Canvas>`.
- **Fill Logic:** Use the "Shader" approach. Nest an `<ImageShader />` inside the `<Path />`.
- **Shadows:** Instead of rendering 3 separate `<Path />` components for shadows, use Skia's `<Shadow />` or `<BlurMask />` filters for better performance.
- **Animation:** Move the `translateX` logic from the `Animated.View` wrapper directly into a Skia `<Group transform={...}>` using a `useDerivedValue`.

---

## 3. Implementation Outline for Sub-Agent

### Phase 1: Dependency & Root Setup
1. Verify `@shopify/react-native-skia` is installed.
2. Modify `src/app/index.tsx`:
   - Import `useImage` from Skia.
   - Load `assets/textures/paper-texture-4-bw.png`.
   - Pass the resulting `SkImage` object down to the `Sky` and `Waves` features.

### Phase 2: Refactor `AnimatedWave.tsx`
1. **Remove** `react-native-svg` imports.
2. **Implement** Skia `Canvas`:
   ```tsx
   <Canvas style={styles.canvas}>
     <Group transform={animatedTransform}>
       <Path path={pathData} color={fillColor}>
         <ImageShader 
           image={paperTexture} 
           tx="repeat" 
           ty="repeat" 
           opacity={PAPER_TEXTURE_OPACITY} 
         />
       </Path>
     </Group>
   </Canvas>
   ```
3. **Optimize Shadows:** Use a single path with a `Shadow` filter if possible, or keep the layered approach but within the same Canvas.
4. **Coordinate Systems:** Ensure `viewBox` logic is translated to Skia's coordinate system (Skia uses pixels/points, not a virtual viewBox by default, so scaling may be required).

### Phase 3: Cleanup
1. Consolidate `AnimatedWaveClipped.tsx` and `AnimatedWave.tsx` into a single, high-performance Skia component.
2. Remove unused SVG dependencies and assets.

---

## 4. Technical Notes for Implementation
- **Path Compatibility:** Skia's `<Path />` accepts the exact same string format as `react-native-svg`'s `d` prop.
- **Image Tiling:** Ensure `tx="repeat"` and `ty="repeat"` are set on the `ImageShader` to match the current `<Pattern>` behavior.
- **Z-Index:** Since Skia components render in a single `Canvas`, manage the layering of waves by their order in the JSX tree.
- **Performance:** Keep the `useWaveOscillation` hook but adapt it to return a `useDerivedValue` for the Skia `transform` prop instead of an `animatedStyle`.

---
**Memo Prepared By:** Senior Frontend Architect
**Date:** 2026-02-12
