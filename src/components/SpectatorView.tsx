'use client';

import { useEffect, useState } from 'react';
import { motion } from "framer-motion";
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';

export function SpectatorView() {
  const { currentGame, teams } = useSelector((state: RootState) => state.game);
  const [timeRemaining, setTimeRemaining] = useState(30);
  
  useEffect(() => {
    if (currentGame?.timeRemaining) {
      setTimeRemaining(currentGame.timeRemaining);
    }
  }, [currentGame?.timeRemaining]);

  if (!currentGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-2">Loading game state...</h2>
        </div>
      </div>
    );
  }

  const currentTeam = teams[currentGame.currentTeamIndex];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Timer */}
        <div className="text-center mt-4 mb-8">
          <div className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary font-bold">
            {timeRemaining} seconds
          </div>
        </div>
        
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-3xl font-bold gradient-heading mb-4">
            {currentTeam.name}'s Turn
          </h2>
          <p className="text-muted-foreground">
            Category: {currentGame.currentCategory}
          </p>
        </motion.div>
        
        <div className="bg-muted/50 rounded-lg p-6 mx-4 text-center">
          <p className="mb-2 text-lg font-medium">
            {currentTeam.name} is describing a word
          </p>
          <p className="text-sm text-muted-foreground">
            Watch and listen! Your turn will be next.
          </p>
        </div>
        
        {/* Current scores could go here */}
        <div className="mt-8 px-4">
          <h3 className="text-xl font-medium mb-4">Current Scores</h3>
          <div className="space-y-2">
            {teams.map(team => (
              <div 
                key={team.id} 
                className="flex justify-between items-center p-3 rounded-lg bg-muted/30"
              >
                <span className="font-medium">{team.name}</span>
                <span className="text-muted-foreground">
                  {currentGame.scores[team.id] || 0} points
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 