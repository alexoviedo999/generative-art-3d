# Generative Art 3D

Interactive 3D generative art playground using React Three Fiber with flow fields and code explanations.

## What This Is

A beautiful, interactive 3D generative art experience where you can:
- Adjust multiple "knobs" (sliders) to control 3D visualization
- See real-time changes as particles flow through 3D space
- Learn about generative art concepts and how code works
- **NEW:** Uses **@leva-ui/react** for beautiful, performance-optimized controls

## Features

- **3D Flow Field:** 500-5000 particles moving via Perlin noise in 3D space
- **Live Controls (via Leva):**
  - Particle Count - Adjust density (500 to 5000)
  - Flow Speed - Control movement velocity (0.1 to 5.0)
  - Noise Scale - Change randomness/chaos (0.1 to 2.0)
  - Color Shift - Animate palette speed (0.0 to 2.0)
  - Spread - Control flow dispersion (0.5 to 5.0)
- **Draggable Controls Panel:** Leva provides beautiful, floating control UI
- **Code Explanation Panel:** Real-time snippets showing how generative art works
- **Orbit Controls:** Drag, zoom, rotate the 3D camera

## Design

- Dark, sleek 3D aesthetic
- Space Grotesk font for modern feel
- Purple/blue gradient accents (#7c3aed → #5a21b0)
- Glass-morphism panels with blur and transparency
- Real-time interaction - sliders update particles instantly

## Tech Stack

- **React 18** with TypeScript
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Useful 3D components (OrbitControls, Points)
- **@leva-ui/react** - Beautiful control panels for creative coding
- **Three.js** - 3D graphics library (via Fiber)
- **Vite** - Fast build tool and dev server

## Concepts Explained

### 1. Particle System
We create an array of particles, each with position, velocity, and color properties. Particles update position each frame based on noise-driven velocity.

### 2. Perlin Noise Flow
Perlin noise is a mathematical function that creates smooth, organic-looking randomness. We apply it to particle velocities to create flowing patterns.

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

### 3. Motion Calculation
Each frame, we calculate new positions for all particles by adding velocity vectors determined by the noise function.

### 4. Color Animation
Colors shift over time using HSL color space, creating shimmering effects as particles move through their lifecycle.

### 5. Leva Controls
Leva is a modern React library for creating control panels. It provides:
- Beautiful UI with draggable panels
- Performance-optimized re-renders
- Built-in validation and bounds
- Perfect for creative coding applications

## Deployment

Live on Vercel with automatic builds from GitHub
