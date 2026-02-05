import { useState, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

type Particle = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  color: THREE.Color
  size: number
  phase: number
}

export default function App() {
  const [params, setParams] = useState({
    particleCount: 2000,
    flowSpeed: 1.0,
    noiseScale: 0.5,
    colorShift: 0.5,
    spread: 1.5,
    particleSize: 0.05
  })

  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = new THREE.Object3D()

  const particlesRef = useRef<Particle[]>(() => {
    const particles: Particle[] = []
    for (let i = 0; i < 5000; i++) {
      particles.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        color: new THREE.Color(),
        size: Math.random() * 0.1 + 0.02,
        phase: Math.random() * Math.PI * 2
      })
    }
    return particles
  }())

  // Perlin noise function
  const noise = (x: number, y: number, z: number, time: number): number => {
    const X = Math.floor(x / 10) * 0.01
    const Y = Math.floor(y / 10) * 0.01
    const Z = Math.floor(z / 10) * 0.01
    return (
      (Math.sin(X) + Math.sin(Y) + Math.sin(Z)) *
      Math.sin(time + X + Y + Z) *
      params.noiseScale
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0f', fontFamily: "'Space Grotesk', sans-serif", overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 30], fov: 60 }} style={{ background: '#0a0a0f' }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />

        <InstancedMesh
          ref={meshRef}
          args={[
            new THREE.SphereGeometry(1, 32, 32),
            new THREE.MeshStandardMaterial({
              color: '#7c3aed',
              emissive: '#5a21b0',
              emissiveIntensity: 0.3,
              roughness: 0.2,
              metalness: 0.8
            })
          ]}
          instanceColor={new THREE.InstancedBufferAttribute(new Float32Array(5000 * 3), 3)}
        />

        <OrbitControls enableZoom={true} enablePan={true} />

        {/* Floating Controls */}
        <div style={{
          position: 'fixed',
          top: '2rem',
          right: '2rem',
          width: '320px',
          padding: '1.5rem',
          background: 'rgba(18, 18, 26, 0.9)',
          borderRadius: '16px',
          border: '1px solid rgba(124, 58, 237, 0.3)',
          color: '#f0f0f0',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 700, 
            margin: '0 0 1rem 0',
            background: 'linear-gradient(135deg, #7c3aed, #5a21b0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textFillColor: 'transparent'
          }}>
            Controls
          </h2>

          {/* Particle Count */}
          <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Particle Count</span>
              <span style={{ fontFamily: 'monospace', color: '#7c3aed', background: 'rgba(124, 58, 237, 0.15)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>{params.particleCount}</span>
            </div>
            <input
              type="range"
              min="500"
              max="5000"
              value={params.particleCount}
              onChange={(e) => setParams({ ...params, particleCount: parseInt(e.target.value) })}
              style={{ width: '100%', height: '6px', borderRadius: '3px', background: '#2a2a35', outline: 'none', cursor: 'pointer' }}
            />
          </div>

          {/* Flow Speed */}
          <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Flow Speed</span>
              <span style={{ fontFamily: 'monospace', color: '#7c3aed', background: 'rgba(124, 58, 237, 0.15)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>{params.flowSpeed.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={params.flowSpeed}
              onChange={(e) => setParams({ ...params, flowSpeed: parseFloat(e.target.value) })}
              style={{ width: '100%', height: '6px', borderRadius: '3px', background: '#2a2a35', outline: 'none', cursor: 'pointer' }}
            />
          </div>

          {/* Noise Scale */}
          <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Noise Scale</span>
              <span style={{ fontFamily: 'monospace', color: '#7c3aed', background: 'rgba(124, 58, 237, 0.15)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>{params.noiseScale.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={params.noiseScale}
              onChange={(e) => setParams({ ...params, noiseScale: parseFloat(e.target.value) })}
              style={{ width: '100%', height: '6px', borderRadius: '3px', background: '#2a2a35', outline: 'none', cursor: 'pointer' }}
            />
          </div>

          {/* Color Shift Speed */}
          <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Color Shift</span>
              <span style={{ fontFamily: 'monospace', color: '#7c3aed', background: 'rgba(124, 58, 237, 0.15)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>{params.colorShift.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={params.colorShift}
              onChange={(e) => setParams({ ...params, colorShift: parseFloat(e.target.value) })}
              style={{ width: '100%', height: '6px', borderRadius: '3px', background: '#2a2a35', outline: 'none', cursor: 'pointer' }}
            />
          </div>

          {/* Spread */}
          <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Spread</span>
              <span style={{ fontFamily: 'monospace', color: '#7c3aed', background: 'rgba(124, 58, 237, 0.15)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>{params.spread.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={params.spread}
              onChange={(e) => setParams({ ...params, spread: parseFloat(e.target.value) })}
              style={{ width: '100%', height: '6px', borderRadius: '3px', background: '#2a2a35', outline: 'none', cursor: 'pointer' }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              onClick={() => setParams({
                particleCount: Math.floor(Math.random() * 4500 + 500),
                flowSpeed: Math.random() * 4.9 + 0.1,
                noiseScale: Math.random() * 1.9 + 0.1,
                colorShift: Math.random() * 2,
                spread: Math.random() * 4.5 + 0.5
              })}
              style={{
                flex: 1,
                padding: '0.75rem 1.25rem',
                background: 'linear-gradient(135deg, #7c3aed, #5a21b0)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.2s ease, boxShadow 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.4)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              🎲 Randomize
            </button>
            <button
              onClick={() => setParams({
                particleCount: 2000,
                flowSpeed: 1.0,
                noiseScale: 0.5,
                colorShift: 0.5,
                spread: 1.5,
                particleSize: 0.05
              })}
              style={{
                flex: 1,
                padding: '0.75rem 1.25rem',
                background: '#2a2a35',
                color: '#f0f0f0',
                border: 'none',
                borderRadius: '8px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.2s ease, boxShadow 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              ↺ Reset
            </button>
          </div>
        </div>

        {/* Code Explanation Section - Below 3D View */}
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '2rem',
          right: '340px',
          background: 'rgba(18, 18, 26, 0.95)',
          padding: '2rem',
          borderRadius: '16px',
          border: '1px solid rgba(124, 58, 237, 0.3)',
          maxWidth: '500px',
          backdropFilter: 'blur(10px)',
          maxHeight: 'calc(100vh - 4rem)',
          overflowY: 'auto'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', fontFamily: "'Space Grotesk', sans-serif", color: '#7c3aed' }}>
            Code Breakdown
          </h3>

          <div style={{ fontSize: '0.9rem', lineHeight: '1.7', color: 'rgba(240, 240, 240, 0.9)' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <strong style={{ color: '#7c3aed', fontSize: '0.95rem' }}>Particle System:</strong>
              <p style={{ margin: '0.5rem 0' }}>
                We create a pool of 2000-5000 individual particles, each with its own position, velocity, and color. Each particle moves independently based on forces applied to it.
              </p>
              <code style={{ 
                background: 'rgba(124, 58, 237, 0.15)', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px', 
                fontSize: '0.8rem',
                color: '#7c3aed',
                display: 'block',
                marginTop: '0.5rem',
                overflowX: 'auto'
              }}>
{`particles.map(p => ({
  position: p.position,
  velocity: p.velocity,
  color: new THREE.Color(),
  size: p.size
}))`}
              </code>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <strong style={{ color: '#7c3aed', fontSize: '0.95rem' }}>Perlin Noise Flow:</strong>
              <p style={{ margin: '0.5rem 0' }}>
                A mathematical function that creates smooth, organic-looking randomness. We apply it to each particle's position to create flowing, river-like patterns. Higher noiseScale = more chaotic movement.
              </p>
              <code style={{ 
                background: 'rgba(124, 58, 237, 0.15)', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px', 
                fontSize: '0.8rem',
                color: '#7c3aed',
                display: 'block',
                marginTop: '0.5rem',
                overflowX: 'auto'
              }}>
{`noise(x, y, z, time) {
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

            <div style={{ marginBottom: '1.25rem' }}>
              <strong style={{ color: '#7c3aed', fontSize: '0.95rem' }}>Motion Calculation:</strong>
              <p style={{ margin: '0.5rem 0' }}>
                Each frame, we calculate a new position for every particle by adding velocity to its current position. The velocity is determined by the noise function, creating organic movement patterns.
              </p>
              <code style={{ 
                background: 'rgba(124, 58, 237, 0.15)', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px', 
                fontSize: '0.8rem',
                color: '#7c3aed',
                display: 'block',
                marginTop: '0.5rem',
                overflowX: 'auto'
              }}>
{`particle.position.add(
  new THREE.Vector3(
    noise(pos.x, pos.y, pos.z, time) * spread,
    0,
    0
  )
)}`}
              </code>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <strong style={{ color: '#7c3aed', fontSize: '0.95rem' }}>Color Animation:</strong>
              <p style={{ margin: '0.5rem 0' }}>
                Colors shift over time using the colorShift parameter. This creates shimmering or rainbow effects as particles move through their lifecycle.
              </p>
              <code style={{ 
                background: 'rgba(124, 58, 237, 0.15)', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px', 
                fontSize: '0.8rem',
                color: '#7c3aed',
                display: 'block',
                marginTop: '0.5rem',
                overflowX: 'auto'
              }}>
{`const hue = (baseHue + time * colorShift) % 360
new THREE.Color(`hsl(${hue}, 70%, 90%)`)`}
              </code>
            </div>

            <div style={{ marginBottom: '0' }}>
              <strong style={{ color: '#7c3aed', fontSize: '0.95rem' }}>Performance Optimization:</strong>
              <p style={{ margin: '0.5rem 0' }}>
                We use InstancedMesh to render thousands of particles efficiently. Instead of drawing each particle separately, Three.js batches them together for GPU-optimized rendering.
              </p>
              <code style={{ 
                background: 'rgba(124, 58, 237, 0.15)', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px', 
                fontSize: '0.8rem',
                color: '#7c3aed',
                display: 'block',
                marginTop: '0.5rem',
                overflowX: 'auto'
              }}>
{`<InstancedMesh
  args={[geometry, material]}
  instanceColor={colorAttribute}
  instanceMatrix={matrices}
/>`}
              </code>
            </div>
          </div>
        </div>

        {/* Frame update for animation */}
        <mesh>
          <sphereGeometry args={[1000, 16, 16]} />
          <meshBasicMaterial color="#7c3aed" wireframe />
          <position position={[0, -100, -50]} />
        </mesh>
      </Canvas>

      {/* Title overlay */}
      <div style={{
        position: 'fixed',
        top: '2rem',
        left: '2rem',
        fontFamily: "'Space Grotesk', sans-serif",
        zIndex: 10
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 700,
          margin: '0 0 0.5rem 0',
          background: 'linear-gradient(135deg, #7c3aed, #5a21b0)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textFillColor: 'transparent'
        }}>
          Generative Art
        </h1>
        <p style={{ color: 'rgba(240, 240, 240, 0.7)', fontSize: '1rem' }}>
          Interactive 3D Flow Field
        </p>
      </div>
    </div>
  )
}
