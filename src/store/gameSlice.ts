import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface GameState {
  currentGame: any | null;
  teams: any[];
  currentWord: any | null;
}

const initialState: GameState = {
  currentGame: null,
  teams: [],
  currentWord: null,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setCurrentGame: (state, action: PayloadAction<any>) => {
      state.currentGame = action.payload;
    },
    setTeams: (state, action: PayloadAction<any[]>) => {
      state.teams = action.payload;
    },
    setCurrentWord: (state, action: PayloadAction<any>) => {
      state.currentWord = action.payload;
    },
    resetGame: (state) => {
      state.currentGame = null;
      state.teams = [];
      state.currentWord = null;
    },
  },
});

export const gameActions = gameSlice.actions;
export default gameSlice.reducer; 