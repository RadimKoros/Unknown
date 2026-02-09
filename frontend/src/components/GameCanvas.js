import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { createNoise2D } from 'simplex-noise';
import * as THREE from 'three';
import useGameStore from '../stores/gameStore';

const PARTICLE_COUNT = 8000;
const PARTICLE_SIZE = 0.015;
const FIELD_SIZE = 10;
const INFLUENCE_RADIUS = 1.5;
const MAX_COMPLEXITY = 100;

function UnknownField() {
  const meshRef = useRef();
  const { drawnPaths, currentPath, complexity, isPlaying, isPaused } = useGameStore();
  const noise = useMemo(() => createNoise2D(), []);
  
  const particles = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * FIELD_SIZE;
      positions[i3 + 1] = (Math.random() - 0.5) * FIELD_SIZE;
      positions[i3 + 2] = 0;
      
      // Light gray color for unknown field
      colors[i3] = 0.88;
      colors[i3 + 1] = 0.91;
      colors[i3 + 2] = 0.94;
    }
    
    return { positions, colors };
  }, []);
  
  useFrame((state) => {
    if (!meshRef.current || !isPlaying || isPaused) return;
    
    const positions = meshRef.current.geometry.attributes.position.array;
    const colors = meshRef.current.geometry.attributes.color.array;
    const time = state.clock.getElapsedTime();
    
    // Combine all paths
    const allPaths = [...drawnPaths];
    if (currentPath && currentPath.length > 0) {
      allPaths.push(currentPath);
    }
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const baseX = positions[i3];
      const baseY = positions[i3 + 1];
      
      // Apply noise for organic movement
      const noiseSpeed = 0.3 + (complexity / MAX_COMPLEXITY) * 0.7;
      const noiseX = noise(baseX * 0.5 + time * noiseSpeed, baseY * 0.5) * 0.02;
      const noiseY = noise(baseX * 0.5, baseY * 0.5 + time * noiseSpeed) * 0.02;
      
      let totalForceX = noiseX;
      let totalForceY = noiseY;
      let influenced = false;
      
      // Calculate repulsion from drawn paths
      allPaths.forEach((path) => {
        path.forEach((point) => {
          const dx = baseX - point.x;
          const dy = baseY - point.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < INFLUENCE_RADIUS && distance > 0.01) {
            influenced = true;
            const force = (1 - distance / INFLUENCE_RADIUS) * 0.05;
            totalForceX += (dx / distance) * force;
            totalForceY += (dy / distance) * force;
          }
        });
      });
      
      positions[i3] += totalForceX;
      positions[i3 + 1] += totalForceY;
      
      // Wrap around edges
      if (positions[i3] > FIELD_SIZE / 2) positions[i3] = -FIELD_SIZE / 2;
      if (positions[i3] < -FIELD_SIZE / 2) positions[i3] = FIELD_SIZE / 2;
      if (positions[i3 + 1] > FIELD_SIZE / 2) positions[i3 + 1] = -FIELD_SIZE / 2;
      if (positions[i3 + 1] < -FIELD_SIZE / 2) positions[i3 + 1] = FIELD_SIZE / 2;
      
      // Color variation based on influence
      if (influenced) {
        // Slightly darker when influenced
        colors[i3] = 0.7;
        colors[i3 + 1] = 0.75;
        colors[i3 + 2] = 0.82;
      } else {
        // Return to original light color
        colors[i3] = Math.min(colors[i3] + 0.01, 0.88);
        colors[i3 + 1] = Math.min(colors[i3 + 1] + 0.01, 0.91);
        colors[i3 + 2] = Math.min(colors[i3 + 2] + 0.01, 0.94);
      }
    }
    
    meshRef.current.geometry.attributes.position.needsUpdate = true;
    meshRef.current.geometry.attributes.color.needsUpdate = true;
  });
  
  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={PARTICLE_COUNT}
          array={particles.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={PARTICLE_SIZE}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}

function DrawnLine({ path }) {
  const lineObj = useMemo(() => {
    if (path.length < 2) return null;
    
    const points = path.map(p => new THREE.Vector3(p.x, p.y, 0.1));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: 0x000000,
      transparent: true,
      opacity: 0.9
    });
    
    return new THREE.Line(geometry, material);
  }, [path]);
  
  if (!lineObj) return null;
  
  return <primitive object={lineObj} />;
}

function DrawingLayer() {
  const { drawnPaths, currentPath } = useGameStore();
  
  const allPaths = useMemo(() => {
    const paths = [...drawnPaths];
    if (currentPath && currentPath.length > 1) {
      paths.push(currentPath);
    }
    return paths;
  }, [drawnPaths, currentPath]);
  
  return (
    <>
      {allPaths.map((path, pathIndex) => (
        <DrawnLine key={pathIndex} path={path} />
      ))}
    </>
  );
}

function DrawingInteraction() {
  const { camera, gl, raycaster, pointer } = useThree();
  const { 
    isPlaying, 
    isPaused,
    setCurrentPath, 
    addPath, 
    currentPath,
    updateComplexity,
    drawnPaths,
    updateScore
  } = useGameStore();
  
  const isDrawingRef = useRef(false);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  
  useEffect(() => {
    if (!isPlaying || isPaused) return;
    
    const handlePointerDown = (e) => {
      isDrawingRef.current = true;
      setCurrentPath([]);
    };
    
    const handlePointerMove = (e) => {
      if (!isDrawingRef.current) return;
      
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const intersect = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersect);
      
      if (intersect) {
        const newPoint = { x: intersect.x, y: intersect.y };
        const path = currentPath || [];
        
        // Only add point if it's far enough from last point
        if (path.length === 0 || 
            Math.hypot(newPoint.x - path[path.length - 1].x, 
                      newPoint.y - path[path.length - 1].y) > 0.05) {
          setCurrentPath([...path, newPoint]);
        }
      }
    };
    
    const handlePointerUp = () => {
      if (isDrawingRef.current && currentPath && currentPath.length > 1) {
        addPath(currentPath);
        
        // Calculate complexity
        const totalPoints = drawnPaths.reduce((sum, path) => sum + path.length, 0) + currentPath.length;
        const newComplexity = Math.min((totalPoints / 10), MAX_COMPLEXITY);
        updateComplexity(newComplexity);
        
        // Award points
        updateScore(currentPath.length);
      }
      isDrawingRef.current = false;
    };
    
    gl.domElement.addEventListener('pointerdown', handlePointerDown);
    gl.domElement.addEventListener('pointermove', handlePointerMove);
    gl.domElement.addEventListener('pointerup', handlePointerUp);
    gl.domElement.addEventListener('pointerleave', handlePointerUp);
    
    return () => {
      gl.domElement.removeEventListener('pointerdown', handlePointerDown);
      gl.domElement.removeEventListener('pointermove', handlePointerMove);
      gl.domElement.removeEventListener('pointerup', handlePointerUp);
      gl.domElement.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [isPlaying, isPaused, camera, gl, raycaster, plane, currentPath, drawnPaths]);
  
  return null;
}

function GameCanvas() {
  return (
    <div className="fixed inset-0 w-full h-full" data-testid="game-canvas">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        style={{ background: '#FFFFFF' }}
      >
        <ambientLight intensity={1} />
        <UnknownField />
        <DrawingLayer />
        <DrawingInteraction />
      </Canvas>
    </div>
  );
}

export default GameCanvas;