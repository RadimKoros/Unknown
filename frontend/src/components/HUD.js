import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../stores/gameStore';
import ComplexityMeter from './ComplexityMeter';
import { PlayCircle, PauseCircle, RotateCcw, Trophy, Minimize2, Maximize2, Move, Download, Settings } from 'lucide-react';

function HUD() {
  const {
    isPlaying,
    isPaused,
    isGameOver,
    showInstructions,
    score,
    survivalTime,
    complexity,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    updateSurvivalTime,
    hideInstructions,
    hudMinimized,
    toggleHudMinimized,
    hudPosition,
    setHudPosition
  } = useGameStore();

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  useEffect(() => {
    if (!isPlaying || isPaused) return;
    
    const interval = setInterval(() => {
      updateSurvivalTime();
      
      // Game over only at MAXIMUM complexity, not 95%
      if (complexity >= 100) {
        useGameStore.getState().endGame();
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [isPlaying, isPaused, complexity, updateSurvivalTime]);

  const handleStart = () => {
    hideInstructions();
    startGame();
  };

  const handleExportImage = () => {
    if (window.exportCanvas) {
      window.exportCanvas();
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: hudPosition.x,
      initialY: hudPosition.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    
    setHudPosition({
      x: dragRef.current.initialX + deltaX,
      y: dragRef.current.initialY + deltaY
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const handleTouchMove = (e) => {
        if (!isDragging) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - dragRef.current.startX;
        const deltaY = touch.clientY - dragRef.current.startY;
        
        setHudPosition({
          x: dragRef.current.initialX + deltaX,
          y: dragRef.current.initialY + deltaY
        });
      };
      
      const handleTouchEnd = () => {
        setIsDragging(false);
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging]);

  return (
    <>
      {/* Top HUD */}
      <AnimatePresence>
        {isPlaying && !isGameOver && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              x: hudPosition.x,
            }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-20"
            style={{ 
              transform: `translate(calc(-50% + ${hudPosition.x}px), ${hudPosition.y}px)`,
              cursor: isDragging ? 'grabbing' : 'default'
            }}
            data-testid="top-hud"
          >
            <div className="bg-white/70 backdrop-blur-xl border border-white/20 shadow-lg rounded-2xl overflow-hidden">
              {/* Drag Handle */}
              <div 
                className="flex items-center justify-between px-4 py-2 bg-white/30 border-b border-white/20 cursor-grab active:cursor-grabbing touch-none"
                onMouseDown={handleMouseDown}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                  });
                  handleMouseDown(mouseEvent);
                }}
                data-testid="hud-drag-handle"
              >
                <Move className="w-4 h-4 text-zinc-400" />
                <button
                  onClick={toggleHudMinimized}
                  className="p-1 rounded hover:bg-white/50 transition-colors"
                  data-testid="hud-minimize-button"
                >
                  {hudMinimized ? (
                    <Maximize2 className="w-4 h-4 text-zinc-600" />
                  ) : (
                    <Minimize2 className="w-4 h-4 text-zinc-600" />
                  )}
                </button>
              </div>
              
              {/* HUD Content */}
              <AnimatePresence>
                {!hudMinimized && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 sm:px-8 py-4 flex items-center gap-4 sm:gap-8 flex-wrap sm:flex-nowrap"
                  >
                    <div className="text-center">
                      <div className="text-xs sm:text-sm font-medium text-zinc-600 font-['Manrope']">Score</div>
                      <div className="text-2xl sm:text-3xl font-bold text-black font-['JetBrains_Mono']" data-testid="score-display">{score}</div>
                    </div>
                    
                    <div className="w-px h-8 sm:h-12 bg-zinc-200" />
                    
                    <div className="text-center">
                      <div className="text-xs sm:text-sm font-medium text-zinc-600 font-['Manrope']">Time</div>
                      <div className="text-2xl sm:text-3xl font-bold text-black font-['JetBrains_Mono']" data-testid="time-display">{survivalTime.toFixed(1)}s</div>
                    </div>
                    
                    <div className="w-px h-8 sm:h-12 bg-zinc-200" />
                    
                    <ComplexityMeter complexity={complexity} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Buttons */}
      <AnimatePresence>
        {isPlaying && !isGameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-8 right-8 z-20 flex flex-col gap-3"
          >
            <button
              onClick={isPaused ? resumeGame : pauseGame}
              className="p-4 rounded-full bg-white/70 backdrop-blur-xl border border-white/20 hover:bg-white/90 transition-all shadow-lg hover:scale-105 active:scale-95"
              data-testid="pause-button"
            >
              {isPaused ? (
                <PlayCircle className="w-6 h-6 text-black" />
              ) : (
                <PauseCircle className="w-6 h-6 text-black" />
              )}
            </button>
            
            <button
              onClick={handleExportImage}
              className="p-4 rounded-full bg-white/70 backdrop-blur-xl border border-white/20 hover:bg-white/90 transition-all shadow-lg hover:scale-105 active:scale-95"
              data-testid="export-button-gameplay"
              title="Export current canvas"
            >
              <Download className="w-6 h-6 text-black" />
            </button>
            
            <button
              onClick={resetGame}
              className="p-4 rounded-full bg-white/70 backdrop-blur-xl border border-white/20 hover:bg-white/90 transition-all shadow-lg hover:scale-105 active:scale-95"
              data-testid="reset-button"
            >
              <RotateCcw className="w-6 h-6 text-black" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions Overlay */}
      <AnimatePresence>
        {showInstructions && !isPlaying && !isGameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-center justify-center bg-white/40 backdrop-blur-sm"
            data-testid="instructions-overlay"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white/85 backdrop-blur-xl border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-3xl p-12 max-w-2xl mx-4"
            >
              <h1 className="text-6xl font-bold text-black mb-6 font-['Syne']" data-testid="game-title">Vast Unknown</h1>
              
              <div className="space-y-6 mb-8">
                <p className="text-xl text-zinc-700 leading-relaxed font-['Manrope']">
                  Navigate the tension between <span className="font-semibold text-black">knowing</span> and <span className="font-semibold text-black">mystery</span>.
                </p>
                
                <div className="space-y-3 text-base text-zinc-600 font-['Manrope']">
                  <p>• <span className="font-medium text-black">Draw</span> on the canvas to create knowns</p>
                  <p>• Each known <span className="font-medium text-black">deforms</span> the unknown field</p>
                  <p>• <span className="font-medium text-black">Balance</span> creation and complexity</p>
                  <p>• Survive as long as possible before chaos takes over</p>
                </div>
              </div>
              
              <button
                onClick={handleStart}
                className="w-full rounded-full bg-black text-white hover:scale-105 transition-transform active:scale-95 px-8 py-4 text-lg font-bold tracking-tight font-['Syne'] shadow-lg"
                data-testid="start-game-button"
              >
                Begin Journey
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {isGameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-center justify-center bg-white/40 backdrop-blur-sm"
            data-testid="game-over-overlay"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white/85 backdrop-blur-xl border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-3xl p-12 max-w-xl mx-4 text-center"
            >
              <div className="mb-6">
                <Trophy className="w-16 h-16 text-black mx-auto mb-4" />
                <h2 className="text-5xl font-bold text-black mb-2 font-['Syne']" data-testid="game-over-title">Overwhelmed</h2>
                <p className="text-lg text-zinc-600 font-['Manrope']">The unknown emerged from the known</p>
              </div>
              
              <div className="space-y-4 mb-8 bg-zinc-50/50 rounded-2xl p-6">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-600 font-['Manrope']">Final Score</span>
                  <span className="text-2xl font-bold text-black font-['JetBrains_Mono']" data-testid="final-score">{score}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-600 font-['Manrope']">Survival Time</span>
                  <span className="text-2xl font-bold text-black font-['JetBrains_Mono']" data-testid="final-time">{survivalTime.toFixed(1)}s</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-600 font-['Manrope']">Peak Complexity</span>
                  <span className="text-2xl font-bold text-black font-['JetBrains_Mono']" data-testid="final-complexity">{complexity.toFixed(0)}%</span>
                </div>
              </div>
              
              <button
                onClick={handleExportImage}
                className="w-full mb-3 rounded-full bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-50 px-8 py-4 text-lg font-medium font-['Syne'] transition-colors flex items-center justify-center gap-2"
                data-testid="export-button"
              >
                <Download className="w-5 h-5" />
                Export Image
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    resetGame();
                    startGame();
                  }}
                  className="flex-1 rounded-full bg-black text-white hover:scale-105 transition-transform active:scale-95 px-8 py-4 text-lg font-bold tracking-tight font-['Syne'] shadow-lg"
                  data-testid="play-again-button"
                >
                  Play Again
                </button>
                <button
                  onClick={resetGame}
                  className="rounded-full bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-50 px-8 py-4 text-lg font-medium font-['Syne'] transition-colors"
                  data-testid="main-menu-button"
                >
                  Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause Overlay */}
      <AnimatePresence>
        {isPaused && isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-25 flex items-center justify-center bg-white/30 backdrop-blur-md"
            data-testid="pause-overlay"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="text-center"
            >
              <h2 className="text-6xl font-bold text-black font-['Syne']">Paused</h2>
              <p className="text-xl text-zinc-600 mt-4 font-['Manrope']">Click resume to continue</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default HUD;