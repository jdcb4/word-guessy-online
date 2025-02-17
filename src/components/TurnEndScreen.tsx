'use client';

import { useSelector } from 'react-redux';
import { socketService } from '@/services/socketService';
import { RootState } from '@/store';
import { Button } from './Button';

export function TurnEndScreen({ 
  roundWords,
  scores,
  currentTeam,
  nextTeam,
  onConfirmEnd 
}: {
  roundWords: { guessed: string[], skipped: string[] };
  scores: Record<string, number>;
  currentTeam: string;
  nextTeam: string;
  onConfirmEnd: () => void;
}) {
  const teams = useSelector((state: RootState) => state.game.teams);
  const currentTeamObj = teams.find(team => team.name === currentTeam);
  const isMyTurn = currentTeamObj?.id === socketService.getSocket().id;

  return (
    <div className="fixed inset-0 bg-background/95 flex items-center justify-center p-4">
      <div className="bg-foreground/5 p-6 rounded-lg max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Turn Complete!</h2>
        
        <div className="space-y-4 mb-6">
          <div>
            <h3 className="font-medium mb-2">Words Guessed ({roundWords.guessed.length})</h3>
            <ul className="grid grid-cols-2 gap-2">
              {roundWords.guessed.map(word => (
                <li key={word} className="bg-green-500/10 p-2 rounded">{word}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Words Skipped ({roundWords.skipped.length})</h3>
            <ul className="grid grid-cols-2 gap-2">
              {roundWords.skipped.map(word => (
                <li key={word} className="bg-red-500/10 p-2 rounded">{word}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Team Standings</h3>
            <ul className="space-y-2">
              {teams.map(team => (
                <li 
                  key={team.id} 
                  className={`flex justify-between p-2 rounded ${
                    team.name === currentTeam ? 'bg-foreground/10' : ''
                  }`}
                >
                  <span>{team.name}</span>
                  <span>{scores[team.id] || 0} points</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {isMyTurn ? (
          <div className="space-y-2">
            <p className="text-center text-foreground/70 mb-4">
              Your turn is complete! Click below to pass to {nextTeam}.
            </p>
            <Button onClick={onConfirmEnd} fullWidth>
              End Turn
            </Button>
          </div>
        ) : (
          <p className="text-center text-foreground/70">
            Waiting for {currentTeam} to end their turn...
          </p>
        )}
      </div>
    </div>
  );
} 