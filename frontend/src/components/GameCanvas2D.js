import React, { useRef, useEffect } from 'react';
import { createNoise2D } from 'simplex-noise';
import useGameStore from '../stores/gameStore';

const PARTICLE_COUNT = 5000;
const FIELD_SIZE = { width: window.innerWidth, height: window.innerHeight };
const INFLUENCE_RADIUS = 150;
const MAX_COMPLEXITY = 100;

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
        allPaths.push(currentPath);
      }
      
      particlesRef.current.forEach(particle => {
        // Noise-based movement
        const noiseSpeed = 0.3 + (complexity / MAX_COMPLEXITY) * 0.7;
        const noiseX = noiseRef.current(particle.baseX * 0.005 + time * noiseSpeed, particle.baseY * 0.005) * 20;
        const noiseY = noiseRef.current(particle.baseX * 0.005, particle.baseY * 0.005 + time * noiseSpeed) * 20;
        
        let totalForceX = noiseX * 0.1;
        let totalForceY = noiseY * 0.1;
        let influenced = false;
        
        // Repulsion from drawn paths
        allPaths.forEach(path => {
          path.forEach(point => {
            const dx = particle.x - point.x;
            const dy = particle.y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < INFLUENCE_RADIUS && distance > 1) {
              influenced = true;
              const force = (1 - distance / INFLUENCE_RADIUS) * 5;
              totalForceX += (dx / distance) * force;
              totalForceY += (dy / distance) * force;
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
      
      // Draw paths
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      allPaths.forEach(path => {
        if (path.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
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
