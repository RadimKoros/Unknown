import React, { useRef, useEffect } from 'react';
import { createNoise2D } from 'simplex-noise';
import useGameStore from '../stores/gameStore';

const PARTICLE_COUNT = 5000;
const FIELD_SIZE = { width: window.innerWidth, height: window.innerHeight };
const INFLUENCE_RADIUS = 150;
const MAX_COMPLEXITY = 100;
const COMPLEXITY_GROWTH_RATE = 0.5; // Slower growth
const CONNECTION_REWARD = 5; // Complexity reduction for connecting to unknown's curves

function GameCanvas2D() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const noiseRef = useRef(createNoise2D());
  const animationFrameRef = useRef(null);
  const isDrawingRef = useRef(false);
  
  const { 
    drawnPaths, 
    currentPath,
    setCurrentPath,
    addPath,
    isPlaying,
    isPaused,
    complexity,
    updateComplexity,
    drawnPaths: paths,
    updateScore
  } = useGameStore();
  
  const distortedPathsRef = useRef(new Map()); // Store distorted versions of paths
  const pathMetadataRef = useRef(new Map()); // Store metadata about each path
  
  // Export canvas function
  useEffect(() => {
    window.exportCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vast-unknown-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    };
    
    return () => {
      delete window.exportCanvas;
    };
  }, []);
  
  // Initialize particles
  useEffect(() => {
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * FIELD_SIZE.width,
        y: Math.random() * FIELD_SIZE.height,
        baseX: Math.random() * FIELD_SIZE.width,
        baseY: Math.random() * FIELD_SIZE.height,
        vx: 0,
        vy: 0
      });
    }
    particlesRef.current = particles;
  }, []);
  
  // Drawing handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlaying || isPaused) return;
    
    const getPosition = (e) => {
      const rect = canvas.getBoundingClientRect();
      
      // Handle touch events
      if (e.touches && e.touches.length > 0) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top
        };
      }
      
      // Handle mouse events
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };
    
    const handleStart = (e) => {
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = getPosition(e);
      setCurrentPath([pos]);
    };
    
    const handleMove = (e) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      
      const pos = getPosition(e);
      const path = currentPath || [];
      
      if (path.length === 0 || 
          Math.hypot(pos.x - path[path.length - 1].x, pos.y - path[path.length - 1].y) > 3) {
        setCurrentPath([...path, pos]);
      }
    };
    
    const handleEnd = (e) => {
      if (isDrawingRef.current && currentPath && currentPath.length > 1) {
        e.preventDefault();
        
        // Calculate path metadata for "decisiveness"
        const pathLength = currentPath.length;
        const startPoint = currentPath[0];
        const endPoint = currentPath[currentPath.length - 1];
        const straightLineDistance = Math.hypot(
          endPoint.x - startPoint.x,
          endPoint.y - startPoint.y
        );
        
        // Calculate actual path distance
        let actualDistance = 0;
        for (let i = 1; i < currentPath.length; i++) {
          actualDistance += Math.hypot(
            currentPath[i].x - currentPath[i - 1].x,
            currentPath[i].y - currentPath[i - 1].y
          );
        }
        
        // Decisiveness: straightness and speed
        const straightness = straightLineDistance / Math.max(actualDistance, 1);
        const speed = pathLength / Math.max(actualDistance, 1);
        const decisiveness = straightness * Math.min(speed * 2, 1);
        
        // Store metadata
        const pathId = Date.now() + Math.random();
        pathMetadataRef.current.set(pathId, {
          decisiveness,
          createdAt: Date.now(),
          intensity: decisiveness * (1 + complexity / 100)
        });
        
        // Add path with metadata
        const pathWithMeta = { points: currentPath, id: pathId };
        addPath(pathWithMeta);
        
        // Calculate complexity
        const totalPoints = drawnPaths.reduce((sum, path) => 
          sum + (path.points ? path.points.length : path.length), 0
        ) + currentPath.length;
        const newComplexity = Math.min((totalPoints / 10), MAX_COMPLEXITY);
        updateComplexity(newComplexity);
        
        // Award points with bonus for decisive lines
        const bonus = Math.floor(decisiveness * 10);
        updateScore(currentPath.length + bonus);
      }
      isDrawingRef.current = false;
    };
    
    // Mouse events
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseleave', handleEnd);
    
    // Touch events
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleEnd, { passive: false });
    
    return () => {
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('mouseleave', handleEnd);
      
      canvas.removeEventListener('touchstart', handleStart);
      canvas.removeEventListener('touchmove', handleMove);
      canvas.removeEventListener('touchend', handleEnd);
      canvas.removeEventListener('touchcancel', handleEnd);
    };
  }, [isPlaying, isPaused, currentPath, drawnPaths]);
  
  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let time = 0;
    
    const animate = () => {
      if (!isPlaying || isPaused) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      
      time += 0.01;
      
      // Clear canvas
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      const allPaths = [...drawnPaths];
      if (currentPath && currentPath.length > 0) {
        allPaths.push({ points: currentPath, id: 'current' });
      }
      
      // Create distorted versions of paths based on complexity and particle proximity
      allPaths.forEach(pathObj => {
        const path = pathObj.points || pathObj;
        const pathId = pathObj.id || 'legacy';
        const metadata = pathMetadataRef.current.get(pathId) || { decisiveness: 0.5, intensity: 0.5 };
        
        if (!distortedPathsRef.current.has(pathId)) {
          distortedPathsRef.current.set(pathId, path.map(p => ({ ...p })));
        }
        
        const distortedPath = distortedPathsRef.current.get(pathId);
        
        // Apply unknown's influence on the known lines
        const complexityFactor = complexity / MAX_COMPLEXITY;
        const backLashStrength = complexityFactor * metadata.intensity * 0.5;
        
        distortedPath.forEach((point, idx) => {
          const originalPoint = path[idx];
          if (!originalPoint) return;
          
          // Calculate particle density around this point
          let nearbyParticles = 0;
          let forceX = 0;
          let forceY = 0;
          
          particlesRef.current.forEach(particle => {
            const dx = particle.x - originalPoint.x;
            const dy = particle.y - originalPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < INFLUENCE_RADIUS * 0.8) {
              nearbyParticles++;
              // Particles push the line points
              const pushForce = (1 - distance / (INFLUENCE_RADIUS * 0.8)) * backLashStrength;
              forceX -= (dx / distance) * pushForce * 2;
              forceY -= (dy / distance) * pushForce * 2;
            }
          });
          
          // Add noise-based distortion (unknown's chaos)
          const noiseDistortion = noiseRef.current(
            originalPoint.x * 0.01 + time * 0.5, 
            originalPoint.y * 0.01
          ) * backLashStrength * 30;
          
          // Decisive lines resist more, but still get affected
          const resistance = 1 - (metadata.decisiveness * 0.5);
          
          // Apply distortion
          point.x = originalPoint.x + (forceX + noiseDistortion) * resistance;
          point.y = originalPoint.y + (forceY + noiseDistortion * 0.5) * resistance;
          
          // Add erosion effect at high complexity
          if (complexityFactor > 0.6) {
            const erosion = Math.random() < complexityFactor * 0.1;
            if (erosion) {
              point.eroded = true;
            }
          }
        });
      });
      
      particlesRef.current.forEach(particle => {
        // Noise-based movement
        const noiseSpeed = 0.3 + (complexity / MAX_COMPLEXITY) * 0.7;
        const noiseX = noiseRef.current(particle.baseX * 0.005 + time * noiseSpeed, particle.baseY * 0.005) * 20;
        const noiseY = noiseRef.current(particle.baseX * 0.005, particle.baseY * 0.005 + time * noiseSpeed) * 20;
        
        let totalForceX = noiseX * 0.1;
        let totalForceY = noiseY * 0.1;
        let influenced = false;
        
        // Repulsion from drawn paths
        allPaths.forEach(pathObj => {
          const path = pathObj.points || pathObj;
          const metadata = pathMetadataRef.current.get(pathObj.id) || { decisiveness: 0.5 };
          
          path.forEach(point => {
            const dx = particle.x - point.x;
            const dy = particle.y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < INFLUENCE_RADIUS && distance > 1) {
              influenced = true;
              
              // Decisive lines push particles harder
              const pushMultiplier = 1 + metadata.decisiveness;
              const force = (1 - distance / INFLUENCE_RADIUS) * 5 * pushMultiplier;
              totalForceX += (dx / distance) * force;
              totalForceY += (dy / distance) * force;
              
              // At high complexity, particles become more chaotic near decisive lines
              if (complexity > 50 && metadata.decisiveness > 0.7) {
                const chaos = (Math.random() - 0.5) * 0.2 * (complexity / 100);
                totalForceX += chaos;
                totalForceY += chaos;
              }
            }
          });
        });
        
        particle.vx = totalForceX;
        particle.vy = totalForceY;
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Wrap around edges
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.y > canvas.height) particle.y = 0;
        if (particle.y < 0) particle.y = canvas.height;
        
        // Draw particle
        ctx.fillStyle = influenced ? 'rgba(112, 120, 130, 0.6)' : 'rgba(224, 232, 240, 0.8)';
        ctx.fillRect(particle.x, particle.y, 2, 2);
      });
      
      // Draw paths with distortion
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      allPaths.forEach(pathObj => {
        const pathId = pathObj.id || 'legacy';
        const path = pathObj.points || pathObj;
        const distortedPath = distortedPathsRef.current.get(pathId) || path;
        const metadata = pathMetadataRef.current.get(pathId) || { decisiveness: 0.5 };
        
        if (distortedPath.length < 2) return;
        
        // Vary line appearance based on decisiveness and complexity
        const complexityFactor = complexity / MAX_COMPLEXITY;
        const alpha = 0.9 - (complexityFactor * 0.3 * (1 - metadata.decisiveness));
        ctx.globalAlpha = alpha;
        
        // Draw the distorted path
        ctx.beginPath();
        ctx.moveTo(distortedPath[0].x, distortedPath[0].y);
        
        for (let i = 1; i < distortedPath.length; i++) {
          const point = distortedPath[i];
          
          // Skip eroded points
          if (point.eroded && Math.random() > 0.5) {
            ctx.moveTo(point.x, point.y);
            continue;
          }
          
          ctx.lineTo(point.x, point.y);
        }
        
        ctx.stroke();
        ctx.globalAlpha = 1;
        
        // Draw glow effect for decisive lines at high complexity
        if (metadata.decisiveness > 0.7 && complexityFactor > 0.5) {
          ctx.strokeStyle = `rgba(239, 68, 68, ${complexityFactor * 0.3})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(distortedPath[0].x, distortedPath[0].y);
          for (let i = 1; i < distortedPath.length; i++) {
            if (!distortedPath[i].eroded) {
              ctx.lineTo(distortedPath[i].x, distortedPath[i].y);
            }
          }
          ctx.stroke();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
        }
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isPaused, drawnPaths, currentPath, complexity]);
  
  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        FIELD_SIZE.width = window.innerWidth;
        FIELD_SIZE.height = window.innerHeight;
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full cursor-crosshair"
      data-testid="game-canvas"
      style={{ touchAction: 'none' }}
    />
  );
}

export default GameCanvas2D;
