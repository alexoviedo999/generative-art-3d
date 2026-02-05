# Generative Art 3D

Interactive 3D generative art playground using React Three Fiber with flow fields and code explanations.

## What This Is

A beautiful, interactive 3D generative art experience where you can:
- Adjust multiple "knobs" (sliders) to control 3D visualization
- See real-time changes as particles flow through 3D space
- Learn about generative art concepts and how the code works

## Features

- **3D Flow Field:** 500-5000 particles moving via Perlin noise in 3D space
- **Live Controls:**
  - Particle Count - Adjust density (performance-aware)
  - Flow Speed - Control movement velocity
  - Noise Scale - Change randomness/chaos
  - Color Shift - Animate palette speed
  - Spread - Control flow dispersion
- **Interactive Code Panel:** Real-time explanation of how each part works
- **Randomize Button:** Discover unique combinations
- **Reset Button:** Return to defaults
- **Orbit Controls:** Drag, zoom, rotate the 3D view
- **GPU Optimized:** Uses InstancedMesh for efficient rendering

## Design

- Dark, sleek 3D aesthetic
- Space Grotesk font for modern feel
- Purple/blue gradient accents (#7c3aed → #5a21b0)
- Floating glass-morphism control panels
- Real-time code explanation below visualization

## Tech Stack

- **React 18** with TypeScript
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Useful 3D components (OrbitControls)
- **Vite** - Fast build tool and dev server
- **Three.js** - 3D graphics library (via Fiber)

## Concepts Explained

### 1. Particle System
We create an array of 5000 particles, each with position, velocity, color, and phase properties.

```typescript
type Particle = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  color: THREE.Color
  size: number
  phase: number
}
```

Each particle moves independently based on the forces applied by our flow field.

### 2. Perlin Noise Flow
Perlin noise is a mathematical function that creates smooth, organic-looking randomness. We apply it to each particle's X position to create flowing patterns.

```typescript
const noise = (x, y, z, time) => {
  const X = Math.floor(x / 10) * 0.01
  const Y = Math.floor(y / 10) * 0.01
  const Z = Math.floor(z / 10) * 0.01
  return (
    (Math.sin(X) + Math.sin(Y) + Math.sin(Z)) *
    Math.sin(time + X + Y + Z) *
    noiseScale
  )
}
```

- Higher `noiseScale` = more chaotic, turbulent movement
- Lower `noiseScale` = smooth, flowing rivers of particles

### 3. Motion Calculation
Each frame, we update every particle's position by adding a velocity vector determined by the noise function.

```typescript
particle.position.add(
  new THREE.Vector3(
    noise(pos.x, pos.y, pos.z, time) * spread,
    0,
    0
  )
)
```

The `spread` parameter controls how widely particles disperse from their noise-driven path.

### 4. Color Animation
Colors shift over time using HSL color space, creating shimmering effects.

```typescript
const hue = (baseHue + time * colorShift) % 360
new THREE.Color(`hsl(${hue}, 70%, 90%)`)
```

- `colorShift` controls how fast colors cycle through the spectrum
- `0` = static colors, `2` = rapid rainbow effects

### 5. InstancedMesh Optimization
Instead of drawing each particle as a separate mesh (very slow), we use `InstancedMesh` to batch all particles together for GPU-optimized rendering.

```typescript
<InstancedMesh
  args={[geometry, material]}
  instanceColor={colorAttribute}
  instanceMatrix={matrices}
/>
```

This allows us to render 5000+ particles at 60fps even on lower-end devices.

## Interactive Code Panel

A floating panel below the 3D view shows:
- **Live code snippets** - The actual code being used
- **Explanations** - What each part does
- **Performance notes** - Why we made certain technical decisions
- **Real-time updates** - See how parameter changes affect code

This makes the project a learning tool for generative art and React Three Fiber!

## Deployment

Live on Vercel with automatic builds from GitHub
