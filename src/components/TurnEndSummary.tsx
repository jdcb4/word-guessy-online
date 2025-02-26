'use client';

import { motion } from "framer-motion";
import { Button } from './Button';
import { RootState } from "@/store/store";
import { useSelector } from "react-redux";

interface TurnEndSummaryProps {
  onEndTurn: () => void;
  isActiveTeam: boolean;
}

export function TurnEndSummary({ onEndTurn, isActiveTeam }: TurnEndSummaryProps) {
  const { currentGame, teams } = useSelector((state: RootState) => state.game);
  
  if (!currentGame) return null;
  
  const currentTeam = teams[currentGame.currentTeamIndex];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Turn Summary Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-3xl font-bold gradient-heading">
            {currentTeam.name}'s Turn Summary
          </h2>
        </motion.div>

        {/* Score Summary */}
        <motion.div 
          className="card mx-4 mb-8"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
        >
          <h3 className="text-xl font-medium mb-4">Current Scores</h3>
          <div className="space-y-2">
            {teams.map(team => (
              <div 
                key={team.id} 
                className={`flex justify-between items-center p-3 rounded-lg ${
                  team.id === currentTeam.id ? 'bg-primary/5' : ''
                }`}
              >
                <span className="font-medium">{team.name}</span>
                <span className="text-muted-foreground">
                  {currentGame.scores[team.id] || 0} points
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Words Summary */}
        <div className="grid grid-cols-2 gap-4 px-4">
          {/* Guessed Words */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h3 className="font-medium mb-2">
              Guessed ({currentGame.roundWords.guessed.length})
            </h3>
            <ul className="bg-foreground/5 rounded-lg divide-y divide-foreground/10">
              {currentGame.roundWords.guessed.map((word: string) => (
                <li key={word} className="px-3 py-2 text-foreground/70 text-sm">
                  {word}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Skipped Words */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h3 className="font-medium mb-2">
              Skipped ({currentGame.roundWords.skipped.length})
            </h3>
            <ul className="bg-foreground/5 rounded-lg divide-y divide-foreground/10">
              {currentGame.roundWords.skipped.map((word: string) => (
                <li key={word} className="px-3 py-2 text-foreground/70 text-sm">
                  {word}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>

      {/* Fixed Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-md mx-auto">
          {isActiveTeam ? (
            <Button 
              onClick={onEndTurn} 
              variant="primary"
              size="lg"
              fullWidth
            >
              End Turn
            </Button>
          ) : (
            <p className="text-center text-muted-foreground">
              Waiting for {currentTeam.name} to end their turn...
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 