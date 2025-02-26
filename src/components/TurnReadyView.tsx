'use client';

import { motion } from "framer-motion";
import { Button } from './Button';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';

interface TurnReadyViewProps {
  onStartTurn: () => void;
  isActiveTeam: boolean;
}

export function TurnReadyView({ onStartTurn, isActiveTeam }: TurnReadyViewProps) {
  const { currentGame, teams } = useSelector((state: RootState) => state.game);
  if (!currentGame) return null;

  const currentTeam = teams[currentGame.currentTeamIndex];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24">
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

        {/* Fixed Action Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
          <div className="max-w-md mx-auto">
            {isActiveTeam ? (
              <Button 
                onClick={onStartTurn} 
                variant="primary"
                size="lg"
                fullWidth
              >
                Start Turn
              </Button>
            ) : (
              <p className="text-center text-muted-foreground">
                Waiting for {currentTeam.name} to start their turn...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 