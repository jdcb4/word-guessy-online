'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { Button } from './Button';

export function ActiveTeamView() {
  const { currentWord, currentGame } = useSelector((state: RootState) => state.game);
  const [timeRemaining, setTimeRemaining] = useState(30);
  
  useEffect(() => {
    if (currentGame?.timeRemaining) {
      setTimeRemaining(currentGame.timeRemaining);
    }
  }, [currentGame?.timeRemaining]);

  if (!currentWord || !currentGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-2">Loading your word...</h2>
          <p className="text-gray-500">Please wait</p>
        </div>
      </div>
    );
  }

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
          <p className="text-sm text-muted-foreground mb-2">
            Your word is:
          </p>
          <h2 className="text-4xl font-bold gradient-heading mb-4">
            {currentWord.word}
          </h2>
          <p className="text-muted-foreground">
            Category: {currentWord.category}
          </p>
        </motion.div>
        
        <div className="text-center px-4">
          <p className="mb-6">
            Describe this word to your team without saying the word itself or any part of it!
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
          <div className="max-w-md mx-auto space-y-2">
            <Button 
              variant="primary"
              size="lg"
              fullWidth
            >
              Got it!
            </Button>
            <Button 
              variant="outline"
              size="lg"
              fullWidth
            >
              Skip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 