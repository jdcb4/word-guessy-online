'use client';

import React from 'react';
import { Team, CurrentGame } from '@/types/game';

interface SpectatorViewProps {
  currentGame: CurrentGame;
  teams: Team[];
}

export function SpectatorView({ currentGame, teams }: SpectatorViewProps) {
  if (!currentGame) return null;

  const currentTeam = teams[currentGame.currentTeamIndex];

  return (
    <div className="w-full max-w-md">
      {/* Current Team */}
      <div className="text-center mb-8">
        <div className="text-2xl font-bold mb-2">
          {currentTeam.name}'s Turn
        </div>
        <div className="text-4xl font-bold mb-2">
          {currentGame.timeRemaining}
        </div>
        <div className="text-foreground/70">seconds remaining</div>
      </div>

      {/* Scoreboard */}
      <div className="bg-foreground/5 p-4 rounded-lg mb-8">
        <h2 className="font-medium mb-4">Scoreboard</h2>
        <ul className="space-y-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex justify-between items-center"
            >
              <span>{team.name}</span>
              <span className="font-medium">
                {currentGame.scores[team.id] || 0}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Round Summary */}
      <div className="space-y-4">
        {/* Guessed Words */}
        <div>
          <h3 className="font-medium mb-2">Words Guessed This Round</h3>
          <ul className="bg-foreground/5 rounded-lg divide-y divide-foreground/10">
            {currentGame.roundWords.guessed.map((word: string) => (
              <li key={word} className="px-4 py-2 text-foreground/70">
                {word}
              </li>
            ))}
          </ul>
        </div>

        {/* Skipped Words */}
        <div>
          <h3 className="font-medium mb-2">Skipped Words</h3>
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