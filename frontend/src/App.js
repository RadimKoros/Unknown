import React, { useEffect } from 'react';
import './App.css';
import GameCanvas2D from './components/GameCanvas2D';
import HUD from './components/HUD';
import useGameStore from './stores/gameStore';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const { isGameOver, score, survivalTime, complexity } = useGameStore();
  
  // Save game session when game ends
  useEffect(() => {
    if (isGameOver && score > 0) {
      const saveSession = async () => {
        try {
          await axios.post(`${API}/game/session`, {
            score,
            survival_time: survivalTime,
            complexity_peak: complexity
          });
        } catch (error) {
          console.error('Failed to save game session:', error);
        }
      };
      
      saveSession();
    }
  }, [isGameOver, score, survivalTime, complexity]);
  
  return (
    <div className="App w-full h-screen overflow-hidden">
      <GameCanvas2D />
      <HUD />
    </div>
  );
}

export default App;