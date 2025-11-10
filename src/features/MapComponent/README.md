# Uncontrolled Map Implementation

This directory contains the uncontrolled map implementation that provides a unified API for both native and web platforms.

## Architecture

The implementation follows an uncontrolled approach with imperative control methods:

1. **Uncontrolled Components**: Both native and web map components are uncontrolled, allowing natural user interactions
2. **Imperative Control**: Programmatic control is provided through a unified `MapController` API
3. **One-Way State Observation**: Map state is observed through context but not used to control the map

## Usage

### Basic Map Usage

```tsx
import { MapComponent, MapControllerProvider, MapStateProvider } from "@/features/MapComponent"

export default function MapPage() {
  return (
    <MapStateProvider>
      <MapControllerProvider>
        <MapComponent />
      </MapControllerProvider>
    </MapStateProvider>
  )
}
```

### Accessing Map State

```tsx
import { useMapState } from "@/shared/contexts"

function MapInfo() {
  const { latitude, longitude, zoom, pitch, heading } = useMapState()
  
  return (
    <div>
      <p>Lat: {latitude}, Lng: {longitude}</p>
      <p>Zoom: {zoom}, Pitch: {pitch}, Heading: {heading}</p>
    </div>
  )
}
```

### Imperative Map Control

```tsx
import { useMapController } from "@/features/MapComponent"
import { SEATTLE_COORDINATES } from "@/features/MapComponent/shared"

function MapControls() {
  const mapController = useMapController()
  
  const handleFlyToSeattle = () => {
    if (mapController) {
      mapController.flyTo({
        centerCoordinate: [SEATTLE_COORDINATES.longitude, SEATTLE_COORDINATES.latitude],
        zoomLevel: 12,
        heading: 0,
        pitch: 45,
      }, 2000) // 2 second animation
    }
  }
  
  const handleZoomIn = () => {
    if (mapController) {
      const currentZoom = mapController.getZoom() || 10
      mapController.jumpTo({
        centerCoordinate: [SEATTLE_COORDINATES.longitude, SEATTLE_COORDINATES.latitude],
        zoomLevel: currentZoom + 1,
        heading: 0,
        pitch: 45,
      })
    }
  }
  
  return (
    <div>
      <button onClick={handleFlyToSeattle}>Fly to Seattle</button>
      <button onClick={handleZoomIn}>Zoom In</button>
    </div>
  )
}
```

## API Reference

### MapController

```typescript
interface MapController {
  flyTo: (destination: CameraState, duration?: number) => void
  easeTo: (destination: CameraState, duration?: number) => void
  jumpTo: (destination: CameraState) => void
  getCenter: () => [number, number] | undefined
  getZoom: () => number | undefined
}
```

### CameraState

```typescript
type CameraState = {
  centerCoordinate: readonly [number, number]  // [longitude, latitude]
  zoomLevel: number
  heading: number
  pitch: number
}
```

## Platform Differences

While the API is unified, there are some platform-specific differences:

1. **getCenter() and getZoom()**: 
   - Web: Returns actual current values
   - Native: Returns undefined (would need to be tracked through state updates)

2. **Animation Performance**:
   - Web: Uses browser-optimized animations
   - Native: Uses native platform animations

## Benefits

1. **Performance**: Uncontrolled components minimize unnecessary re-renders
2. **User Experience**: Natural map interactions on both platforms
3. **Unified API**: Same imperative methods across platforms
4. **Flexibility**: Easy to add new imperative methods as needed
