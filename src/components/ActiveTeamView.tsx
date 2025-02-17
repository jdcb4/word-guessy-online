'use client';

import { useEffect } from 'react';
import { Button } from './Button';

interface ActiveTeamViewProps {
  currentGame: any;
  onCorrectGuess: () => void;
  onSkip: () => void;
}

export function ActiveTeamView({ currentGame, onCorrectGuess, onSkip }: ActiveTeamViewProps) {
  if (!currentGame) return null;

  return (
    <div className="w-full max-w-md">
      {/* Timer */}
      <div className="text-center mb-8">
        <div className="text-6xl font-bold mb-2">
          {currentGame.timeRemaining}
        </div>
        <div className="text-foreground/70">seconds remaining</div>
      </div>

      {/* Current Word */}
      <div className="bg-foreground/5 p-6 rounded-lg mb-8 text-center">
        <div className="text-sm text-foreground/70 mb-2">
          {currentGame.currentWord?.category} - {currentGame.currentWord?.difficulty}
        </div>
        <div className="text-4xl font-bold mb-4">
          {currentGame.currentWord?.word}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Button onClick={onCorrectGuess} variant="success">
          Correct! (+1)
        </Button>
        <Button onClick={onSkip} variant="danger">
          Skip (-1)
        </Button>
      </div>

      {/* Round Summary */}
      <div className="space-y-4">
        <div>
          <h3 className="font-medium mb-2">Guessed Words ({currentGame.roundWords.guessed.length})</h3>
          <ul className="bg-foreground/5 rounded-lg divide-y divide-foreground/10">
            {currentGame.roundWords.guessed.map((word: string) => (
              <li key={word} className="px-4 py-2 text-foreground/70">
                {word}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-medium mb-2">Skipped Words ({currentGame.roundWords.skipped.length})</h3>
          <ul className="bg-foreground/5 rounded-lg divide-y divide-foreground/10">
            {currentGame.roundWords.skipped.map((word: string) => (
              <li key={word} className="px-4 py-2 text-foreground/70">
                {word}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
} 