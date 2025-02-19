import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { getWords, shuffleWords } from './utils/wordUtils';
import { clearInterval } from 'timers';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Configure CORS
app.use(cors());

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"], // Allow both localhost variations
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["my-custom-header"],
  },
  // Add transport options
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store active games
const games = new Map<string, {
  hostId: string;
  teams: Array<{ id: string; name: string }>;
  settings: GameSettings;
  timer?: NodeJS.Timeout;
  currentGame?: {
    currentTeamIndex: number;
    currentRound: number;
    scores: Record<string, number>;
    currentWord?: Word;
    timeRemaining: number;
    roundWords: {
      guessed: string[];
      skipped: string[];
    };
    usedWords: Set<string>;
    availableWords: Word[];
    timer?: NodeJS.Timeout;
  };
}>();

interface GameSettings {
  rounds: number;
  turnDuration: number;
  difficulty: 'easy' | 'medium' | 'hard';
  categories: string[];
  difficulties: ('easy' | 'medium' | 'hard')[];
}

interface Word {
  word: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface GameState {
  hostId: string;
  teams: Array<{ id: string; name: string }>;
  settings: GameSettings;
  currentGame?: {
    currentTeamIndex: number;
    currentRound: number;
    scores: Record<string, number>;
    currentWord?: Word;
    timeRemaining: number;
    roundWords: {
      guessed: string[];
      skipped: string[];
    };
    usedWords: Set<string>;
    availableWords: Word[];
    timer?: NodeJS.Timeout;
  };
}

// Generate a random 6-character game code
function generateGameCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

// Handle socket connections
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle hosting a new game
  socket.on('host-game', ({ teamName, settings }) => {
    try {
      console.log('Hosting game request received:', { teamName, settings });
      
      const gameCode = generateGameCode();
      console.log('Generated game code:', gameCode);
      
      // Initialize the game with provided settings
      const gameData = {
        hostId: socket.id,
        teams: [{ id: socket.id, name: teamName }],
        settings: {
          ...settings,
          turnDuration: settings.turnDuration || 30, // Ensure turnDuration has a default
          categories: settings.categories || [],
          difficulties: settings.difficulties || ['easy']
        },
        currentGame: undefined
      };
      
      games.set(gameCode, gameData);
      console.log('Game created:', gameCode);
      
      // Join the socket to the game room
      socket.join(gameCode);
      
      // Emit game created event
      socket.emit('game-created', { gameCode });
      
      // Broadcast initial game state
      io.to(gameCode).emit('game-updated', {
        teams: gameData.teams,
        settings: gameData.settings
      });
      
      console.log('Game creation completed');
    } catch (error) {
      console.error('Error creating game:', error);
      socket.emit('error', { 
        message: 'Failed to create game. Please try again.' 
      });
    }
  });

  // Handle getting game state
  socket.on('get-game-state', ({ gameCode }) => {
    const game = games.get(gameCode);
    if (game) {
      socket.emit('game-state-update', { 
        teams: game.teams,
        settings: game.settings,
        currentTeamIndex: game.currentGame?.currentTeamIndex,
        currentRound: game.currentGame?.currentRound,
        scores: game.currentGame?.scores,
        timeRemaining: game.currentGame?.timeRemaining,
        currentWord: game.currentGame?.currentWord,
        roundWords: game.currentGame?.roundWords
      });
    }
  });

  // Handle joining a game
  socket.on('join-game', ({ gameCode, teamName }) => {
    const game = games.get(gameCode);
    
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    // Add team to the game
    game.teams.push({ id: socket.id, name: teamName });
    socket.join(gameCode);

    // Notify all players in the game about the new team
    io.to(gameCode).emit('game-updated', { 
      teams: game.teams,
      settings: game.settings 
    });

    // Notify the joining player specifically
    socket.emit('game-joined', { gameCode });
  });

  // Handle starting the game
  socket.on('start-game', ({ gameCode }) => {
    try {
      const game = games.get(gameCode);
      if (!game || !game.settings || socket.id !== game.hostId) {
        socket.emit('error', { message: 'Unauthorized to start game' });
        return;
      }

      // Get filtered and shuffled words based on settings
      const availableWords = shuffleWords(getWords({
        categories: game.settings.categories || [],
        difficulties: game.settings.difficulties.map(d => d.toLowerCase()) as ('easy' | 'medium' | 'hard')[]
      }));

      if (availableWords.length === 0) {
        socket.emit('error', { message: 'No words available with current settings' });
        return;
      }

      // Initialize game state with the correct turn duration
      game.currentGame = {
        currentTeamIndex: 0,
        currentRound: 1,
        scores: {},
        timeRemaining: game.settings.turnDuration, // Use selected turnDuration
        roundWords: {
          guessed: [],
          skipped: []
        },
        usedWords: new Set(),
        availableWords,
        currentWord: availableWords[0]
      };

      // Initialize scores for all teams
      game.teams.forEach(team => {
        if (game.currentGame) {
          game.currentGame.scores[team.id] = 0;
        }
      });

      // Emit game-started event
      io.to(gameCode).emit('game-started', { 
        redirect: `/game/${gameCode}` 
      });

      // Emit initial game state to all players
      io.to(gameCode).emit('game-state-update', {
        currentTeamIndex: game.currentGame.currentTeamIndex,
        currentRound: game.currentGame.currentRound,
        scores: game.currentGame.scores,
        timeRemaining: game.currentGame.timeRemaining,
        currentWord: game.currentGame.currentWord,
        roundWords: game.currentGame.roundWords,
        teams: game.teams // Include teams in the update
      });

      // Start the first turn with correct settings
      startTurn(gameCode);

      console.log('Game started:', gameCode);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { 
        message: 'Failed to start game. Please try again.' 
      });
    }
  });

  // Handle word guessed correctly
  socket.on('word-guessed', ({ gameCode, word }) => {
    const game = games.get(gameCode);
    if (!game?.currentGame) return;

    const currentTeam = game.teams[game.currentGame.currentTeamIndex];
    if (socket.id !== currentTeam.id) return;

    // Update scores and words
    game.currentGame.scores[currentTeam.id] = 
      (game.currentGame.scores[currentTeam.id] || 0) + 1;
    game.currentGame.roundWords.guessed.push(word);
    game.currentGame.usedWords.add(word);

    // Get next word
    const nextWord = game.currentGame.availableWords.find(w => 
      !game.currentGame?.usedWords.has(w.word)
    );
    game.currentGame.currentWord = nextWord;

    io.to(gameCode).emit('game-state-update', game.currentGame);
  });

  // Handle word skipped
  socket.on('word-skipped', ({ gameCode, word }) => {
    const game = games.get(gameCode);
    if (!game?.currentGame) return;

    const currentTeam = game.teams[game.currentGame.currentTeamIndex];
    if (socket.id !== currentTeam.id) return;

    // Update scores and words
    game.currentGame.scores[currentTeam.id] = 
      Math.max(0, (game.currentGame.scores[currentTeam.id] || 0) - 1);
    game.currentGame.roundWords.skipped.push(word);
    game.currentGame.usedWords.add(word);

    // Get next word
    const nextWord = game.currentGame.availableWords.find(w => 
      !game.currentGame?.usedWords.has(w.word)
    );
    game.currentGame.currentWord = nextWord;

    io.to(gameCode).emit('game-state-update', game.currentGame);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Clean up any games where this socket was the host
    for (const [code, game] of games.entries()) {
      if (game.hostId === socket.id) {
        if (game.currentGame?.timer) {
          clearInterval(game.currentGame.timer);
        }
        games.delete(code);
        io.to(code).emit('game-ended', { message: 'Host disconnected' });
      } else {
        game.teams = game.teams.filter(team => team.id !== socket.id);
        io.to(code).emit('game-updated', { teams: game.teams });
      }
    }
  });
});

function startTurn(gameCode: string) {
  const game = games.get(gameCode);
  if (!game?.currentGame || !game.settings) return;

  // Reset turn state with the correct turn duration
  game.currentGame.timeRemaining = game.settings.turnDuration;
  game.currentGame.roundWords = { guessed: [], skipped: [] };

  // Get the next word for the turn
  const nextWord = game.currentGame.availableWords.find(w => 
    !game.currentGame.usedWords.has(w.word)
  );
  game.currentGame.currentWord = nextWord;

  // Clear any existing timer
  if (game.currentGame.timer) {
    clearInterval(game.currentGame.timer);
  }

  // Start the timer
  game.currentGame.timer = setInterval(() => {
    if (!game.currentGame) return;

    game.currentGame.timeRemaining--;
    
    if (game.currentGame.timeRemaining <= 0) {
      clearInterval(game.currentGame.timer);
      endTurn(gameCode);
    } else {
      io.to(gameCode).emit('game-state-update', game.currentGame);
    }
  }, 1000);

  // Emit the updated game state
  io.to(gameCode).emit('game-state-update', game.currentGame);
}

function endTurn(gameCode: string) {
  const game = games.get(gameCode);
  if (!game?.currentGame) return;

  // Clear timer
  if (game.currentGame.timer) {
    clearInterval(game.currentGame.timer);
  }

  // Move to next team
  game.currentGame.currentTeamIndex = 
    (game.currentGame.currentTeamIndex + 1) % game.teams.length;

  // Check if round is complete
  if (game.currentGame.currentTeamIndex === 0) {
    game.currentGame.currentRound++;
  }

  // Check if game is over
  if (game.currentGame.currentRound > game.settings.rounds) {
    endGame(gameCode);
  } else {
    startTurn(gameCode);
  }
}

function endGame(gameCode: string) {
  const game = games.get(gameCode);
  if (!game?.currentGame) return;

  // Find winner
  const winner = Object.entries(game.currentGame.scores)
    .reduce((a, b) => (a[1] > b[1] ? a : b));
  
  const winningTeam = game.teams.find(team => team.id === winner[0]);

  io.to(gameCode).emit('game-ended', {
    winner: winningTeam?.name || 'Unknown Team',
    finalScores: game.currentGame.scores
  });

  // Clean up game
  games.delete(gameCode);
}

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});