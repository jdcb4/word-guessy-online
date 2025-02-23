'use client';

import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { Button } from './Button';

interface TurnGetReadyProps {
  onStartTurn: () => void;
  isActiveTeam: boolean;
}

export function TurnGetReady({ onStartTurn, isActiveTeam }: TurnGetReadyProps) {
  const { currentGame, teams } = useSelector((state: RootState) => state.game);
  
  if (!currentGame) return null;
  
  const currentTeam = teams[currentGame.currentTeamIndex];

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <h2 className="text-2xl font-bold text-center">
        {isActiveTeam ? "It's Your Turn!" : `${currentTeam.name}'s Turn`}
      </h2>
      
      <div className="text-center">
        <p className="text-lg mb-2">Category:</p>
        <p className="text-2xl font-bold">{currentGame.currentCategory}</p>
      </div>

      {isActiveTeam ? (
        <Button onClick={onStartTurn} fullWidth>
          Start Turn
        </Button>
      ) : (
        <p className="text-center text-foreground/60">
          Waiting for {currentTeam.name} to start their turn...
        </p>
      )}
    </div>
  );
} 