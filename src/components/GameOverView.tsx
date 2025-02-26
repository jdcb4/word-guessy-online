'use client';

import { motion } from "framer-motion";
import { Button } from './Button';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';

interface GameOverViewProps {
  onPlayAgain: () => void;
  onBackToHome: () => void;
}

export function GameOverView({ onPlayAgain, onBackToHome }: GameOverViewProps) {
  const { currentGame, teams } = useSelector((state: RootState) => state.game);
  if (!currentGame) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-3xl font-bold gradient-heading mb-4">
            Game Over!
          </h2>
        </motion.div>

        {/* Final Scores */}
        <motion.div 
          className="card mx-4 mb-8"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
        >
          <h3 className="text-xl font-medium mb-4">Final Scores</h3>
          <div className="space-y-2">
            {teams.map(team => (
              <div 
                key={team.id} 
                className="flex justify-between items-center p-3 rounded-lg"
              >
                <span className="font-medium">{team.name}</span>
                <span className="text-muted-foreground">
                  {currentGame.scores[team.id] || 0} points
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
          <div className="max-w-md mx-auto space-y-4">
            <Button 
              onClick={onPlayAgain} 
              variant="primary"
              size="lg"
              fullWidth
            >
              Play Again
            </Button>
            <Button 
              onClick={onBackToHome} 
              variant="outline"
              size="lg"
              fullWidth
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 