'use client';

import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { Button } from './Button';

interface TurnEndSummaryProps {
  onEndTurn: () => void;
  isActiveTeam: boolean;
}

export function TurnEndSummary({ onEndTurn, isActiveTeam }: TurnEndSummaryProps) {
  const { currentGame, teams } = useSelector((state: RootState) => state.game);
  
  if (!currentGame) return null;
  
  const currentTeam = teams[currentGame.currentTeamIndex];

  return (
    <div className="flex flex-col items-center gap-6 p-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center">
        {currentTeam.name}'s Turn Summary
      </h2>

      {/* Score section */}
      <div className="w-full">
        <h3 className="text-xl mb-2">Current Scores:</h3>
        {teams.map(team => (
          <div key={team.id} className="flex justify-between py-2">
            <span>{team.name}</span>
            <span>{currentGame.scores[team.id] || 0} points</span>
          </div>
        ))}
      </div>

      {/* Words summary */}
      <div className="w-full space-y-4">
        <div>
          <h3 className="text-xl mb-2">Words Guessed:</h3>
          <ul className="list-disc pl-4">
            {currentGame.roundWords.guessed.map((word, index) => (
              <li key={`guessed-${word}-${index}`}>{word}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xl mb-2">Words Skipped:</h3>
          <ul className="list-disc pl-4">
            {currentGame.roundWords.skipped.map((word, index) => (
              <li key={`skipped-${word}-${index}`}>{word}</li>
            ))}
          </ul>
        </div>
      </div>

      {isActiveTeam ? (
        <Button onClick={onEndTurn} fullWidth>
          End Turn
        </Button>
      ) : (
        <p className="text-center text-foreground/60">
          Waiting for {currentTeam.name} to end their turn...
        </p>
      )}
    </div>
  );
} 