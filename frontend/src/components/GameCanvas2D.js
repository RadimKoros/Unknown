import React, { useRef, useEffect } from 'react';
import { createNoise2D } from 'simplex-noise';
import useGameStore from '../stores/gameStore';

const PARTICLE_COUNT = 5000;
const FIELD_SIZE = { width: window.innerWidth, height: window.innerHeight };
const INFLUENCE_RADIUS = 150;
const MAX_COMPLEXITY = 100;
const BASE_COMPLEXITY_GROWTH_RATE = 1.0; // Faster than before
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
    updateScore,
    complexitySensitivity
  } = useGameStore();
  
  const distortedPathsRef = useRef(new Map()); // Store permanently distorted versions of paths
  const pathMetadataRef = useRef(new Map()); // Store metadata about each path
  const pathBehaviorRef = useRef(new Map()); // Store behavior type for each path
  const fragmentedLinesRef = useRef([]); // Separated line fragments
  const lastFragmentationRef = useRef(0);
  
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
        
        // Calculate complexity - apply sensitivity multiplier
        const totalPoints = drawnPaths.reduce((sum, path) => 
          sum + (path.points ? path.points.length : path.length), 0
        ) + currentPath.length;
        const newComplexity = Math.min(
          (totalPoints * BASE_COMPLEXITY_GROWTH_RATE * complexitySensitivity / 10), 
          MAX_COMPLEXITY
        );
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
      
      // Hybrid distortion system: Some lines animate, some stop permanently
      const completedPaths = drawnPaths;
      const complexityFactor = complexity / MAX_COMPLEXITY;
      
      // Assign behavior to new paths
      completedPaths.forEach(pathObj => {
        const pathId = pathObj.id || 'legacy';
        if (!pathBehaviorRef.current.has(pathId)) {
          const behavior = {
            type: Math.random() < 0.5 ? 'animate' : 'permanent', // 50/50 split
            intensity: Math.random(), // How much it moves
            frozen: false, // Animated lines can freeze
            frozenAt: 0
          };
          pathBehaviorRef.current.set(pathId, behavior);
        }
      });
      
      // Randomly freeze some animated lines (they move then stop)
      if (Math.random() < 0.05 * complexityFactor) { // More frequent at high complexity
        const animatedPaths = Array.from(pathBehaviorRef.current.entries())
          .filter(([id, b]) => b.type === 'animate' && !b.frozen);
        
        if (animatedPaths.length > 0) {
          const [pathId, behavior] = animatedPaths[Math.floor(Math.random() * animatedPaths.length)];
          behavior.frozen = true;
          behavior.frozenAt = time;
          console.log(`Line ${pathId} froze in place`);
        }
      }
      
      // Process distortions based on behavior type
      completedPaths.forEach(pathObj => {
        const path = pathObj.points || pathObj;
        const pathId = pathObj.id || 'legacy';
        const metadata = pathMetadataRef.current.get(pathId) || { decisiveness: 0.5 };
        const behavior = pathBehaviorRef.current.get(pathId) || { type: 'none', intensity: 0 };
        
        if (!distortedPathsRef.current.has(pathId)) {
          distortedPathsRef.current.set(pathId, path.map(p => ({ ...p, distorted: false })));
        }
        
        const distortedPath = distortedPathsRef.current.get(pathId);
        
        // Apply distortion based on behavior type
        if (behavior.type === 'animate' && !behavior.frozen) {
          // CONTINUOUS ANIMATION - lines that keep moving
          const animationStrength = (0.5 + complexityFactor) * behavior.intensity;
          const resistance = 1 - (metadata.decisiveness * 0.2);
          
          distortedPath.forEach((point, idx) => {
            const originalPoint = path[idx];
            if (!originalPoint) return;
            
            const waveAmplitude = 30 * animationStrength;
            const waveFreq = 0.1 * (1 + behavior.intensity);
            const waveX = Math.sin(idx * waveFreq + time * 0.6) * waveAmplitude;
            const waveY = Math.cos(idx * waveFreq * 1.2 + time * 0.6) * waveAmplitude * 0.7;
            
            point.x = originalPoint.x + waveX * resistance;
            point.y = originalPoint.y + waveY * resistance;
            point.animated = true;
          });
          
        } else if (behavior.type === 'animate' && behavior.frozen) {
          // FROZEN - was animating, now permanently stopped at last position
          // Keep whatever position it had when frozen
          // (Already stored in distortedPath from previous frame)
        }
      });
      
      // PERMANENT DISTORTION EVENTS - happens faster now
      const distortionInterval = Math.max(0.5, 2 - complexityFactor * 1.5); // Much faster
      
      if (time - lastDistortionEventRef.current > distortionInterval && completedPaths.length > 0) {
        // Pick paths with 'permanent' behavior type
        const permanentPaths = completedPaths.filter((pathObj, idx) => {
          const pathId = pathObj.id || 'legacy';
          const behavior = pathBehaviorRef.current.get(pathId);
          return behavior && behavior.type === 'permanent';
        });
        
        if (permanentPaths.length > 0) {
          const pathObj = permanentPaths[Math.floor(Math.random() * permanentPaths.length)];
          const path = pathObj.points || pathObj;
          const pathId = pathObj.id || 'legacy';
          const metadata = pathMetadataRef.current.get(pathId) || { decisiveness: 0.5 };
          const behavior = pathBehaviorRef.current.get(pathId);
          
          const distortedPath = distortedPathsRef.current.get(pathId);
          
          // Pick a random segment
          const segmentLength = Math.floor(path.length * (0.2 + Math.random() * 0.4));
          const startIdx = Math.floor(Math.random() * Math.max(1, path.length - segmentLength));
          const endIdx = Math.min(startIdx + segmentLength, path.length);
          
          const distortionStrength = (0.8 + complexityFactor * 1.2) * (0.5 + behavior.intensity);
          const resistance = 1 - (metadata.decisiveness * 0.2);
          
          for (let idx = startIdx; idx < endIdx; idx++) {
            const originalPoint = path[idx];
            if (!originalPoint || distortedPath[idx].distorted) continue;
            
            const t = (idx - startIdx) / segmentLength;
            const curveFactor = Math.sin(t * Math.PI);
            
            const waveAmplitude = 40 * distortionStrength * curveFactor;
            const randomAngle = Math.random() * Math.PI * 2;
            const waveX = Math.cos(randomAngle) * waveAmplitude;
            const waveY = Math.sin(randomAngle) * waveAmplitude;
            
            const noiseDistortion = noiseRef.current(
              originalPoint.x * 0.01, 
              originalPoint.y * 0.01
            ) * distortionStrength * 30 * curveFactor;
            
            distortedPath[idx].x = originalPoint.x + (waveX + noiseDistortion * 0.7) * resistance;
            distortedPath[idx].y = originalPoint.y + (waveY + noiseDistortion) * resistance;
            distortedPath[idx].distorted = true;
            
            if (complexityFactor > 0.85 && Math.random() < 0.1) {
              distortedPath[idx].eroded = true;
            }
          }
          
          lastDistortionEventRef.current = time;
          console.log(`Permanent distortion on line ${pathId}, segment ${startIdx}-${endIdx}`);
        }
      }
      
      // LINE FRAGMENTATION - pieces of lines break off and separate
      const fragmentationInterval = Math.max(2, 5 - complexityFactor * 3);
      
      if (time - lastFragmentationRef.current > fragmentationInterval && completedPaths.length > 0 && complexityFactor > 0.1) {
        // Pick a random line to fragment
        const pathObj = completedPaths[Math.floor(Math.random() * completedPaths.length)];
        const path = pathObj.points || pathObj;
        const pathId = pathObj.id || 'legacy';
        
        if (path.length > 10) {
          // Pick a random segment to break off
          const segmentLength = Math.floor(path.length * (0.15 + Math.random() * 0.25)); // 15-40% of line
          const startIdx = Math.floor(Math.random() * (path.length - segmentLength));
          const endIdx = startIdx + segmentLength;
          
          // Extract the segment
          const fragmentPoints = [];
          for (let i = startIdx; i < endIdx; i++) {
            fragmentPoints.push({ ...path[i] });
          }
          
          // Create fragment with drift
          const driftAngle = Math.random() * Math.PI * 2;
          const driftDistance = 20 + Math.random() * 40;
          const driftX = Math.cos(driftAngle) * driftDistance;
          const driftY = Math.sin(driftAngle) * driftDistance;
          
          fragmentedLinesRef.current.push({
            points: fragmentPoints,
            offset: { x: driftX, y: driftY },
            createdAt: time,
            isDashed: true,
            dashProgress: 0
          });
          
          // Mark the original segment as fragmented
          const distortedPath = distortedPathsRef.current.get(pathId);
          if (distortedPath) {
            for (let i = startIdx; i < endIdx; i++) {
              if (distortedPath[i]) {
                distortedPath[i].fragmented = true;
              }
            }
          }
          
          lastFragmentationRef.current = time;
          console.log(`Line ${pathId} fragmented, segment ${startIdx}-${endIdx} separated`);
        }
      }
      
      // Update fragment positions (they drift away)
      fragmentedLinesRef.current.forEach(fragment => {
        const age = time - fragment.createdAt;
        const driftSpeed = 0.3;
        fragment.offset.x += Math.cos(age * 0.5) * driftSpeed;
        fragment.offset.y += Math.sin(age * 0.5) * driftSpeed;
        fragment.dashProgress = (age * 0.5) % 1;
      });
      
      // Remove old fragments
      fragmentedLinesRef.current = fragmentedLinesRef.current.filter(f => 
        time - f.createdAt < 15
      );
      
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
      
      // Draw paths - use permanently distorted versions where they exist
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Draw completed paths (with permanent distortions and fragmentations)
      drawnPaths.forEach(pathObj => {
        const pathId = pathObj.id || 'legacy';
        const path = pathObj.points || pathObj;
        
        // Use distorted version if it exists, otherwise use original
        const renderPath = distortedPathsRef.current.has(pathId) 
          ? distortedPathsRef.current.get(pathId) 
          : path;
        
        if (renderPath.length < 2) return;
        
        const complexityFactor = complexity / MAX_COMPLEXITY;
        let alpha = 0.9;
        
        // Only fade at very high complexity
        if (complexityFactor > 0.85) {
          alpha = 0.9 - (complexityFactor - 0.85) * 2;
        }
        
        ctx.globalAlpha = alpha;
        
        // Draw the path with gaps for fragmented segments
        ctx.beginPath();
        ctx.setLineDash([]); // Solid for non-fragmented parts
        
        let isFirstPoint = true;
        let inFragmentedSection = false;
        
        for (let i = 0; i < renderPath.length; i++) {
          const point = renderPath[i];
          const originalPoint = renderPath === path ? point : path[i];
          
          const x = point.x !== undefined ? point.x : originalPoint.x;
          const y = point.y !== undefined ? point.y : originalPoint.y;
          
          // Check if this segment is fragmented (broken off)
          const isFragmented = point.fragmented;
          
          if (isFragmented) {
            // Draw dashed for fragmented parts still attached
            if (!inFragmentedSection) {
              ctx.stroke(); // Finish solid line
              ctx.beginPath();
              ctx.setLineDash([5, 5]);
              inFragmentedSection = true;
              isFirstPoint = true;
            }
          } else {
            // Back to solid
            if (inFragmentedSection) {
              ctx.stroke();
              ctx.beginPath();
              ctx.setLineDash([]);
              inFragmentedSection = false;
              isFirstPoint = true;
            }
          }
          
          // Skip eroded points
          if (point.eroded && Math.random() > 0.3) {
            if (i < renderPath.length - 1) {
              isFirstPoint = true;
            }
            continue;
          }
          
          if (isFirstPoint) {
            ctx.moveTo(x, y);
            isFirstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.stroke();
        ctx.setLineDash([]); // Reset
        ctx.globalAlpha = 1;
      });
      
      // Draw separated fragments
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      
      fragmentedLinesRef.current.forEach(fragment => {
        if (fragment.points.length < 2) return;
        
        // Dashed line for fragments
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -fragment.dashProgress * 10;
        
        ctx.beginPath();
        ctx.moveTo(
          fragment.points[0].x + fragment.offset.x,
          fragment.points[0].y + fragment.offset.y
        );
        
        for (let i = 1; i < fragment.points.length; i++) {
          ctx.lineTo(
            fragment.points[i].x + fragment.offset.x,
            fragment.points[i].y + fragment.offset.y
          );
        }
        
        ctx.stroke();
      });
      
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.globalAlpha = 1;
      
      // Draw current path being drawn (NO distortion for immediate feedback)
      if (currentPath && currentPath.length > 1) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1;
        
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        
        for (let i = 1; i < currentPath.length; i++) {
          ctx.lineTo(currentPath[i].x, currentPath[i].y);
        }
        
        ctx.stroke();
      }
      
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
