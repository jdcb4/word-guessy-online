'use client';

import { Button } from './Button';

export function BeginTurnScreen({
  team,
  isMyTurn,
  onStartTurn
}: {
  team: string;
  isMyTurn: boolean;
  onStartTurn: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-background/95 flex items-center justify-center p-4">
      <div className="bg-foreground/5 p-6 rounded-lg max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-4">{team}'s Turn</h2>
        
        {isMyTurn ? (
          <>
            <p className="mb-6">Get ready to play!</p>
            <Button onClick={onStartTurn} fullWidth>
              Start Turn
            </Button>
          </>
        ) : (
          <p className="text-foreground/70">
            Waiting for {team} to start their turn...
          </p>
        )}
      </div>
    </div>
  );
} 