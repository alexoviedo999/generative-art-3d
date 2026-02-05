import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useControls, Leva } from '@leva-ui/react'

function App() {
  const { particleCount, flowSpeed, noiseScale, colorShift, spread } = useControls({
    particleCount: { value: 2000, min: 500, max: 5000, step: 100 },
    flowSpeed: { value: 1.0, min: 0.1, max: 5.0, step: 0.1 },
    noiseScale: { value: 0.5, min: 0.1, max: 2.0, step: 0.1 },
    colorShift: { value: 0.5, min: 0.0, max: 2.0, step: 0.1 },
    spread: { value: 1.5, min: 0.5, max: 5.0, step: 0.1 }
  })

  const positionsRef = useRef<Float32Array>(null)
  const colorsRef = useRef<Float32Array>(null)

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0f', fontFamily: "'Space Grotesk', sans-serif", overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 30], fov: 60 }} style={{ background: '#0a0a0f' }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} />

        <Points
          positions={positionsRef}
          colors={colorsRef}
          count={particleCount}
          stride={3}
          size={0.05}
        />

        <OrbitControls enableZoom={true} enablePan={true} />

        {/* Leva Controls Panel */}
        <Leva
          collapsed={false}
          oneLineLabels={false}
          flat={false}
        />

        {/* Floating Code Panel */}
        <div style={{
          position: 'fixed',
          top: '2rem',
          right: '2rem',
          width: '360px',
          padding: '1.5rem',
          background: 'rgba(18, 18, 26, 0.9)',
          borderRadius: '16px',
          border: '1px solid rgba(124, 58, 237, 0.3)',
          color: '#f0f0f0',
          backdropFilter: 'blur(10px)',
          maxHeight: 'calc(100vh - 4rem)',
          overflowY: 'auto'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', fontFamily: "'Space Grotesk', sans-serif", color: '#7c3aed' }}>
            Code Breakdown
          </h3>

          <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'rgba(240, 240, 240, 0.85)' }}>
            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#7c3aed', fontSize: '0.9rem' }}>Particle System:</strong>
              <p style={{ margin: '0.5rem 0' }}>
                Creating {particleCount} particles that move independently based on Perlin noise forces. Each has position, velocity, and color.
              </p>
              <code style={{ 
                background: 'rgba(124, 58, 237, 0.15)', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px', 
                fontSize: '0.8rem',
                color: '#7c3aed',
                display: 'block',
                overflowX: 'auto',
                whiteSpace: 'pre'
              }}>
{`type Particle = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  color: THREE.Color
}

const particles: Particle[] = []
for (let i = 0; i < particleCount; i++) {
  particles.push({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    color: new THREE.Color()
  })
}`}
              </code>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#7c3aed', fontSize: '0.9rem' }}>Perlin Noise:</strong>
              <p style={{ margin: '0.5rem 0' }}>
                Mathematical function creating organic randomness. Applied to particle velocity for flowing patterns. Higher noiseScale = more chaos.
              </p>
              <code style={{ 
                background: 'rgba(124, 58, 237, 0.15)', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px', 
                fontSize: '0.8rem',
                color: '#7c3aed',
                display: 'block',
                overflowX: 'auto'
              }}>
{`const noise = (x, y, z, time) => {
  const X = Math.floor(x / 10) * 0.01
  const Y = Math.floor(y / 10) * 0.01
  const Z = Math.floor(z / 10) * 0.01
  
  return (
    (Math.sin(X) + Math.sin(Y) + Math.sin(Z)) *
    Math.sin(time + X + Y + Z) *
    noiseScale
  )
}`}
              </code>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#7c3aed', fontSize: '0.9rem' }}>Particle Update:</strong>
              <p style={{ margin: '0.5rem 0' }}>
                Each frame, position updates based on velocity. Velocity determined by noise function over time.
              </p>
              <code style={{ 
                background: 'rgba(124, 58, 237, 0.15)', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px', 
                fontSize: '0.8rem',
                color: '#7c3aed',
                display: 'block',
                overflowX: 'auto'
              }}>
{`particle.position.add(
  new THREE.Vector3(
    noise(p.x, p.y, p.z, time) * spread,
    0,
    0
  )
)}`}
              </code>
            </div>

            <div style={{ marginBottom: '0' }}>
              <strong style={{ color: '#7c3aed', fontSize: '0.9rem' }}>Leva Controls:</strong>
              <p style={{ margin: '0.5rem 0' }}>
                Using @leva-ui/react for beautiful, performance-optimized control panels. Drag to reposition.
              </p>
            </div>
          </div>
        </div>
      </Canvas>
    </div>
  )
}

export default App
