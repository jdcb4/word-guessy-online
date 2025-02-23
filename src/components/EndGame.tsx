'use client';

import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { Button } from './Button';

interface EndGameProps {
  onPlayAgain: () => void;
  onBackToHome: () => void;
}

export function EndGame({ onPlayAgain, onBackToHome }: EndGameProps) {
  const { currentGame, teams } = useSelector((state: RootState) => state.game);
  
  if (!currentGame) return null;

  // Find winning team
  const winningTeamId = Object.entries(currentGame.scores)
    .reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  const winningTeam = teams.find(team => team.id === winningTeamId);

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <h2 className="text-2xl font-bold text-center">
        Game Over!
      </h2>
      
      <div className="text-center">
        <p className="text-xl mb-4">
          {winningTeam?.name} Wins!
        </p>
      </div>

      <div className="w-full max-w-md">
        <h3 className="text-xl mb-2">Final Scores:</h3>
        {teams.map(team => (
          <div key={team.id} className="flex justify-between py-2">
            <span>{team.name}</span>
            <span>{currentGame.scores[team.id] || 0} points</span>
          </div>
        ))}
      </div>

      <div className="flex gap-4 w-full max-w-md">
        <Button onClick={onBackToHome} fullWidth>
          Back to Home
        </Button>
        <Button 
          onClick={onPlayAgain} 
          fullWidth
          disabled={true} // Temporarily disabled as mentioned
          className="opacity-50"
        >
          Play Again
        </Button>
      </div>
    </div>
  );
} 