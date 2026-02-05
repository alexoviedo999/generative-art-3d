import { useControls, Leva } from '@leva-ui/react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function App() {
  const { particleCount, flowSpeed, noiseScale, colorShift, spread } = useControls({
    particleCount: { value: 2000, min: 500, max: 5000, step: 100 },
    flowSpeed: { value: 1.0, min: 0.1, max: 5.0, step: 0.1 },
    noiseScale: { value: 0.5, min: 0.1, max: 2.0, step: 0.1 },
    colorShift: { value: 0.5, min: 0.0, max: 2.0, step: 0.1 },
    spread: { value: 1.5, min: 0.5, max: 5.0, step: 0.1 }
  })

  const particlesRef = useRef<THREE.Vector3[]>(() => {
    const particles: THREE.Vector3[] = []
    for (let i = 0; i < 5000; i++) {
      particles.push(new THREE.Vector3())
    }
    return particles
  }())

  const colorsRef = useRef<THREE.Color[]>(() => {
    const colors: THREE.Color[] = []
    for (let i = 0; i < 5000; i++) {
      colors.push(new THREE.Color())
    }
    return colors
  }())

  // Perlin noise function
  const noise = (x: number, y: number, z: number, time: number): number => {
    const X = Math.floor(x / 10) * 0.01
    const Y = Math.floor(y / 10) * 0.01
    const Z = Math.floor(z / 10) * 0.01
    return (Math.sin(X) + Math.sin(Y) + Math.sin(Z)) * Math.sin(time + X + Y + Z) * noiseScale
  }

  // Animation frame
  const frameCountRef = useRef(0)
  useFrame((state) => {
    const frame = frameCountRef.current++
    const time = state.clock.elapsedTime * flowSpeed

    const particles = particlesRef.current
    const colors = colorsRef.current

    // Update particles
    for (let i = 0; i < particleCount; i++) {
      const particle = particles[i]
      const velocity = new THREE.Vector3(
        noise(particle.x, particle.y, particle.z, time) * spread,
        0,
        0
      )

      particle.add(velocity)

      // Update color
      const hue = (frame + i * 0.1 + time * colorShift) % 360
      colors[i].setHSL(hue / 360, 0.7, 0.9)
    }

    frameCountRef.current = frame
  })

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0f', fontFamily: "'Space Grotesk', sans-serif", overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 30], fov: 60 }} style={{ background: '#0a0a0f' }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />

        <Points
          positions={particlesRef}
          colors={colorsRef}
          count={particleCount}
          size={0.05}
        />

        <OrbitControls enableZoom={true} enablePan={true} />

        {/* Floating Controls Panel */}
        <div style={{
          position: 'fixed',
          top: '2rem',
          right: '2rem',
          width: '340px',
          padding: '1.5rem',
          background: 'rgba(18, 18, 26, 0.9)',
          borderRadius: '16px',
          border: '1px solid rgba(124, 58, 237, 0.3)',
          color: '#f0f0f0',
          backdropFilter: 'blur(10px)',
          maxHeight: 'calc(100vh - 4rem)',
          overflowY: 'auto'
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

          {/* Leva Controls - Beautiful and Simple! */}
          <Leva collapsed={false} oneLineLabels={false} flat={false} />

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
      </Canvas>
    </div>
  )
}

export default App
