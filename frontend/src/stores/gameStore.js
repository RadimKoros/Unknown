import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // Game state
  isPlaying: false,
  isPaused: false,
  isGameOver: false,
  showInstructions: true,
  
  // Game metrics
  score: 0,
  survivalTime: 0,
  complexity: 0,
  startTime: null,
  
  // Drawing data
  drawnPaths: [],
  currentPath: null,
  
  // Actions
  startGame: () => set({ 
    isPlaying: true, 
    isPaused: false,
    isGameOver: false,
    showInstructions: false,
    score: 0, 
    survivalTime: 0, 
    complexity: 0,
    drawnPaths: [],
    currentPath: null,
    startTime: Date.now()
  }),
  
  pauseGame: () => set({ isPaused: true }),
  
  resumeGame: () => set({ isPaused: false }),
  
  endGame: () => set({ isGameOver: true, isPlaying: false }),
  
  resetGame: () => set({ 
    isPlaying: false,
    isPaused: false,
    isGameOver: false,
    score: 0, 
    survivalTime: 0, 
    complexity: 0,
    drawnPaths: [],
    currentPath: null,
    startTime: null
  }),
  
  updateScore: (delta) => set((state) => ({ 
    score: state.score + delta 
  })),
  
  updateComplexity: (value) => set({ complexity: value }),
  
  updateSurvivalTime: () => {
    const state = get();
    if (state.startTime && state.isPlaying && !state.isPaused) {
      const elapsed = (Date.now() - state.startTime) / 1000;
      set({ survivalTime: elapsed });
    }
  },
  
  addPath: (path) => set((state) => ({ 
    drawnPaths: [...state.drawnPaths, path],
    currentPath: null
  })),
  
  setCurrentPath: (path) => set({ currentPath: path }),
  
  clearCurrentPath: () => set({ currentPath: null }),
  
  hideInstructions: () => set({ showInstructions: false })
}));

export default useGameStore;