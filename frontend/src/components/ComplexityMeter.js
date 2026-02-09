import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

function ComplexityMeter({ complexity }) {
  const complexityPercent = Math.min(complexity, 100);
  
  const color = useMemo(() => {
    if (complexityPercent < 33) return '#10B981'; // Green
    if (complexityPercent < 66) return '#F59E0B'; // Orange
    return '#EF4444'; // Red
  }, [complexityPercent]);
  
  const label = useMemo(() => {
    if (complexityPercent < 33) return 'Stable';
    if (complexityPercent < 66) return 'Tension';
    return 'Critical';
  }, [complexityPercent]);
  
  // Create wobble effect based on complexity
  const wobble = useMemo(() => {
    const intensity = complexityPercent / 100;
    return {
      scale: 1 + Math.sin(Date.now() / 200) * 0.02 * intensity,
      rotate: Math.sin(Date.now() / 300) * 2 * intensity
    };
  }, [complexityPercent]);
  
  return (
    <div className="text-center" data-testid="complexity-meter">
      <div className="text-sm font-medium text-zinc-600 mb-2 font-['Manrope']">Complexity</div>
      
      <div className="relative w-24 h-24">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="#E5E7EB"
            strokeWidth="6"
            fill="none"
          />
          
          {/* Progress circle */}
          <motion.circle
            cx="48"
            cy="48"
            r="40"
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={`${2 * Math.PI * 40 * (1 - complexityPercent / 100)}`}
            strokeLinecap="round"
            animate={{
              strokeDashoffset: `${2 * Math.PI * 40 * (1 - complexityPercent / 100)}`,
            }}
            transition={{ duration: 0.3 }}
          />
        </svg>
        
        {/* Center text */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center"
          animate={wobble}
          transition={{ duration: 0.1 }}
        >
          <span className="text-2xl font-bold text-black font-['JetBrains_Mono']" data-testid="complexity-percent">
            {complexityPercent.toFixed(0)}
          </span>
          <span className="text-xs font-medium font-['Manrope']" style={{ color }} data-testid="complexity-label">
            {label}
          </span>
        </motion.div>
      </div>
    </div>
  );
}

export default ComplexityMeter;