import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define player interface
interface Player {
  id: string;
  name: string;
  // Add other player properties as needed
}

// Define game state interface
interface Team {
  id: string;
  name: string;
}

interface GameSettings {
  teams: {
    maxTeams: number;
    names: string[];
  };
  rounds: number;
  turnDuration: number;
  difficulties: ('easy' | 'medium' | 'hard')[];
  categories: string[];
}

interface GameState {
  gameCode: string | null;
  teams: Team[];
  isHost: boolean;
  isPlaying: boolean;
  settings: GameSettings;
  currentGame: {
    currentTeamIndex: number;
    currentRound: number;
    scores: Record<string, number>; // teamId -> score
    currentWord?: {
      word: string;
      category: string;
      difficulty: string;
    };
    timeRemaining: number;
    roundWords: {
      guessed: string[];
      skipped: string[];
    };
    usedWords: Set<string>;
  } | null;
}

const initialState: GameState = {
  gameCode: null,
  teams: [],
  isHost: false,
  isPlaying: false,
  settings: {
    teams: {
      maxTeams: 4,
      names: ['Team 1', 'Team 2', 'Team 3', 'Team 4']
    },
    rounds: 3,
    turnDuration: 30,
    difficulties: ['easy', 'medium'],
    categories: ['action', 'things', 'places', 'food & drink', 'hobbies', 'entertainment']
  },
  currentGame: null
};

// Create a game slice for managing game state
const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setGameCode(state, action: PayloadAction<string | null>) {
      state.gameCode = action.payload;
    },
    setTeams(state, action: PayloadAction<Team[]>) {
      state.teams = action.payload;
    },
    setIsHost(state, action: PayloadAction<boolean>) {
      state.isHost = action.payload;
    },
    setIsPlaying(state, action: PayloadAction<boolean>) {
      state.isPlaying = action.payload;
    },
    resetGame(state) {
      Object.assign(state, initialState);
    },
    updateSettings(state, action: PayloadAction<Partial<GameSettings>>) {
      state.settings = { ...state.settings, ...action.payload };
    },
    setCurrentGame: (state, action: PayloadAction<GameState['currentGame']>) => {
      state.currentGame = action.payload;
    },
    updateTimeRemaining: (state, action: PayloadAction<number>) => {
      if (state.currentGame) {
        state.currentGame.timeRemaining = action.payload;
      }
    },
    updateScore: (state, action: PayloadAction<{ teamId: string; score: number }>) => {
      if (state.currentGame) {
        state.currentGame.scores[action.payload.teamId] = action.payload.score;
      }
    },
    addGuessedWord: (state, action: PayloadAction<string>) => {
      if (state.currentGame) {
        state.currentGame.roundWords.guessed.push(action.payload);
        state.currentGame.usedWords.add(action.payload);
      }
    },
    addSkippedWord: (state, action: PayloadAction<string>) => {
      if (state.currentGame) {
        state.currentGame.roundWords.skipped.push(action.payload);
        state.currentGame.usedWords.add(action.payload);
      }
    }
  },
});

// Export actions before creating store
const { setGameCode, setTeams, setIsHost, setIsPlaying, resetGame, updateSettings, setCurrentGame, updateTimeRemaining, updateScore, addGuessedWord, addSkippedWord } = gameSlice.actions;

// Create and export store
export const store = configureStore({
  reducer: {
    game: gameSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Export actions
export const gameActions = gameSlice.actions;

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;