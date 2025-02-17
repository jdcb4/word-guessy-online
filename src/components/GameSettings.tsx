'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, gameActions } from '@/store';
import { Button } from './Button';

const CATEGORIES = [
  'action',
  'things',
  'places',
  'food & drink',
  'hobbies',
  'entertainment'
];

const CATEGORY_DISPLAY = {
  'action': 'Actions',
  'things': 'Things',
  'places': 'Places',
  'food & drink': 'Food & Drink',
  'hobbies': 'Hobbies',
  'entertainment': 'Entertainment'
};

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' }
];

const TURN_DURATIONS = [5, 15, 30, 45];

export function GameSettings() {
  const dispatch = useDispatch();
  const settings = useSelector((state: RootState) => state.game.settings);
  const [expanded, setExpanded] = useState(false);

  const handleCategoryToggle = (category: string) => {
    const newCategories = settings.categories.includes(category)
      ? settings.categories.filter(c => c !== category)
      : [...settings.categories, category];
    
    dispatch(gameActions.updateSettings({ categories: newCategories }));
  };

  const handleDifficultyToggle = (difficulty: string) => {
    const newDifficulties = settings.difficulties.includes(difficulty)
      ? settings.difficulties.filter(d => d !== difficulty)
      : [...settings.difficulties, difficulty];
    
    dispatch(gameActions.updateSettings({ difficulties: newDifficulties }));
  };

  return (
    <div className="bg-foreground/5 p-4 rounded-lg mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex justify-between items-center"
      >
        <span className="font-medium">Game Settings</span>
        <span>{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-6">
          {/* Rounds */}
          <div>
            <label className="block mb-2">Number of Rounds: {settings.rounds}</label>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.rounds}
              onChange={(e) => dispatch(gameActions.updateSettings({ 
                rounds: parseInt(e.target.value) 
              }))}
              className="w-full"
            />
          </div>

          {/* Turn Duration */}
          <div>
            <label className="block mb-2">Turn Duration (seconds)</label>
            <div className="flex gap-2">
              {TURN_DURATIONS.map(duration => (
                <button
                  key={duration}
                  onClick={() => dispatch(gameActions.updateSettings({ turnDuration: duration }))}
                  className={`px-3 py-1 rounded ${
                    settings.turnDuration === duration
                      ? 'bg-foreground text-background'
                      : 'bg-foreground/10'
                  }`}
                >
                  {duration}s
                </button>
              ))}
            </div>
          </div>

          {/* Difficulties */}
          <div>
            <label className="block mb-2">Difficulty Levels</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleDifficultyToggle(value)}
                  className={`px-3 py-1 rounded ${
                    settings.difficulties.includes(value)
                      ? 'bg-foreground text-background'
                      : 'bg-foreground/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="block mb-2">Categories</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => handleCategoryToggle(category)}
                  className={`px-3 py-1 rounded text-left ${
                    settings.categories.includes(category)
                      ? 'bg-foreground text-background'
                      : 'bg-foreground/10'
                  }`}
                >
                  {CATEGORY_DISPLAY[category]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 