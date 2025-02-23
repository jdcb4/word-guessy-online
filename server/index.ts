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
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  // Add transport configuration
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store active games
const games = new Map<string, {
  hostId: string;
  teams: Array<{ id: string; name: string }>;
  settings: GameSettings;
  timer?: NodeJS.Timeout;
  words?: GameWords;
  currentGame?: {
    currentTeamIndex: number;
    currentRound: number;
    scores: Record<string, number>;
    currentWord?: Word;
    timeRemaining: number;
    currentCategory: string;
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
  teams: {
    maxTeams: number;
    names: string[];
  };
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

interface GameWords {
  byCategory: {
    [category: string]: Word[];
  };
  usedWords: Set<string>;
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
          turnDuration: settings.turnDuration || 30,
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
      console.error('Detailed host-game error:', error);
      console.error('Error stack:', error.stack);
      socket.emit('error', { 
        message: 'Failed to create game. Please try again.' 
      });
    }
  });

  // Handle getting game state
  socket.on('get-game-state', ({ gameCode }) => {
    const game = games.get(gameCode);
    if (!game?.currentGame) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    // Send current game state to the requesting client
    socket.emit('game-state', {
      currentTeamIndex: game.currentGame.currentTeamIndex,
      currentRound: game.currentGame.currentRound,
      scores: game.currentGame.scores,
      timeRemaining: game.currentGame.timeRemaining,
      currentWord: game.currentGame.currentWord,
      currentCategory: game.currentGame.currentCategory,
      roundWords: game.currentGame.roundWords,
      teams: game.teams
    });
  });

  // Handle joining a game
  socket.on('join-game', ({ gameCode, teamName }) => {
    const game = games.get(gameCode);
    
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    // Check if game is full
    if (game.teams.length >= game.settings.teams.maxTeams) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }

    // Add the new team
    game.teams.push({ id: socket.id, name: teamName });
    
    // Join the socket to the game room
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
      console.log('Starting game for code:', gameCode);
      const game = games.get(gameCode);
      
      if (!game) {
        console.error('Game not found:', gameCode);
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      if (!game.settings) {
        console.error('Game settings not found:', gameCode);
        socket.emit('error', { message: 'Invalid game settings' });
        return;
      }

      if (socket.id !== game.hostId) {
        console.error('Unauthorized start attempt:', socket.id, 'expected:', game.hostId);
        socket.emit('error', { message: 'Unauthorized to start game' });
        return;
      }

      console.log('Loading words with settings:', {
        categories: game.settings.categories,
        difficulties: game.settings.difficulties
      });

      // Load and organize all available words
      const allWords = getWords({
        categories: game.settings.categories,
        difficulties: game.settings.difficulties.map(d => d.toLowerCase()) as ('easy' | 'medium' | 'hard')[]
      });

      console.log('Loaded words count:', allWords.length);

      // Initialize game state
      game.currentGame = {
        currentTeamIndex: 0,
        currentRound: 1,
        scores: {},
        timeRemaining: game.settings.turnDuration,
        currentCategory: '',
        roundWords: {
          guessed: [],
          skipped: []
        },
        usedWords: new Set(),
        availableWords: allWords,
        timer: undefined
      };

      // Initialize scores for all teams
      game.teams.forEach(team => {
        game.currentGame!.scores[team.id] = 0;
      });

      console.log('Game initialized, preparing first turn');

      // Notify all clients that the game has started
      io.to(gameCode).emit('game-started');

      // Prepare the first turn (this will emit turn-ready event)
      prepareTurn(gameCode);

    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Failed to start game' });
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

    // Get next word from the same category
    const currentCategory = game.currentGame.currentCategory;
    const categoryWords = game.currentGame.availableWords.filter(w => 
      w.category === currentCategory && !game.currentGame?.usedWords.has(w.word)
    );

    if (categoryWords.length === 0) {
      console.log('No more words in category, ending turn');
      endTurn(gameCode);
      return;
    }

    // Select random word from remaining category words
    const randomIndex = Math.floor(Math.random() * categoryWords.length);
    const nextWord = categoryWords[randomIndex];
    game.currentGame.currentWord = nextWord;

    // Emit updated state
    io.to(gameCode).emit('game-state-update', {
      currentTeamIndex: game.currentGame.currentTeamIndex,
      currentRound: game.currentGame.currentRound,
      scores: game.currentGame.scores,
      timeRemaining: game.currentGame.timeRemaining,
      currentWord: game.currentGame.currentWord,
      currentCategory: game.currentGame.currentCategory,
      roundWords: game.currentGame.roundWords,
      teams: game.teams
    });
  });

  // Handle word skipped
  socket.on('word-skipped', ({ gameCode, word }) => {
    const game = games.get(gameCode);
    if (!game?.currentGame) return;

    const currentTeam = game.teams[game.currentGame.currentTeamIndex];
    if (socket.id !== currentTeam.id) return;

    // Update words list (no score penalty for skipping)
    game.currentGame.roundWords.skipped.push(word);
    game.currentGame.usedWords.add(word);

    // Get next word from the same category
    const currentCategory = game.currentGame.currentCategory;
    const categoryWords = game.currentGame.availableWords.filter(w => 
      w.category === currentCategory && !game.currentGame?.usedWords.has(w.word)
    );

    if (categoryWords.length === 0) {
      console.log('No more words in category, ending turn');
      endTurn(gameCode);
      return;
    }

    // Select random word from remaining category words
    const randomIndex = Math.floor(Math.random() * categoryWords.length);
    const nextWord = categoryWords[randomIndex];
    game.currentGame.currentWord = nextWord;

    // Emit updated state
    io.to(gameCode).emit('game-state-update', {
      currentTeamIndex: game.currentGame.currentTeamIndex,
      currentRound: game.currentGame.currentRound,
      scores: game.currentGame.scores,
      timeRemaining: game.currentGame.timeRemaining,
      currentWord: game.currentGame.currentWord,
      currentCategory: game.currentGame.currentCategory,
      roundWords: game.currentGame.roundWords,
      teams: game.teams
    });
  });

  // Move the start-turn handler inside the connection scope
  socket.on('start-turn', ({ gameCode }) => {
    const game = games.get(gameCode);
    if (!game?.currentGame) return;

    const currentTeam = game.teams[game.currentGame.currentTeamIndex];
    if (socket.id !== currentTeam.id) return;

    startTurn(gameCode);
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

  // Add handler for end-turn event
  socket.on('end-turn', ({ gameCode }) => {
    const game = games.get(gameCode);
    if (!game?.currentGame) return;

    const currentTeam = game.teams[game.currentGame.currentTeamIndex];
    if (socket.id !== currentTeam.id) return;

    // Move to next team and prepare their turn
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
      // Prepare for next turn
      prepareTurn(gameCode);
    }
  });
});

function startTurn(gameCode: string) {
  const game = games.get(gameCode);
  if (!game?.currentGame || !game.settings) {
    console.error('Invalid game state in startTurn:', gameCode);
    return;
  }

  // Get words for the selected category
  const categoryWords = game.currentGame.availableWords.filter(word => 
    word.category === game.currentGame.currentCategory && 
    !game.currentGame?.usedWords.has(word.word)
  );

  if (categoryWords.length === 0) {
    console.log('No more words available in category, ending game');
    endGame(gameCode);
    return;
  }

  // Select first word
  const randomIndex = Math.floor(Math.random() * categoryWords.length);
  game.currentGame.currentWord = categoryWords[randomIndex];

  console.log('Starting turn with word:', game.currentGame.currentWord.word);

  // Start the timer and emit initial state
  startTimer(gameCode);

  // Emit turn-started event with initial game state
  io.to(gameCode).emit('game-state-update', {
    currentTeamIndex: game.currentGame.currentTeamIndex,
    currentRound: game.currentGame.currentRound,
    scores: game.currentGame.scores,
    timeRemaining: game.currentGame.timeRemaining,
    currentWord: game.currentGame.currentWord,
    currentCategory: game.currentGame.currentCategory,
    roundWords: game.currentGame.roundWords,
    teams: game.teams
  });
}

function endTurn(gameCode: string) {
  const game = games.get(gameCode);
  if (!game?.currentGame) return;

  // Clear timer
  if (game.currentGame.timer) {
    clearInterval(game.currentGame.timer);
  }

  // Emit turn-ended event with summary data
  io.to(gameCode).emit('turn-ended', {
    currentTeamIndex: game.currentGame.currentTeamIndex,
    currentRound: game.currentGame.currentRound,
    scores: game.currentGame.scores,
    roundWords: game.currentGame.roundWords,
    teams: game.teams,
    lastWord: game.currentGame.currentWord // Include the last word being displayed
  });

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
    // Instead of starting turn immediately, prepare for next turn
    prepareTurn(gameCode);
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

// Update prepareTurn function to properly set up the turn-ready state
function prepareTurn(gameCode: string) {
  const game = games.get(gameCode);
  if (!game?.currentGame) return;

  // Get available categories (those that still have unused words)
  const availableCategories = game.settings.categories.filter(category => {
    const categoryWords = game.currentGame!.availableWords.filter(w => 
      w.category === category && !game.currentGame!.usedWords.has(w.word)
    );
    return categoryWords.length > 0;
  });

  if (availableCategories.length === 0) {
    console.log('No more words available in any category');
    endGame(gameCode);
    return;
  }

  // Select random category for this turn
  const randomCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];
  game.currentGame.currentCategory = randomCategory;

  // Reset turn state
  game.currentGame.roundWords = { guessed: [], skipped: [] };
  game.currentGame.timeRemaining = game.settings.turnDuration;
  
  // Clear any existing timer
  if (game.currentGame.timer) {
    clearInterval(game.currentGame.timer);
    game.currentGame.timer = undefined;
  }

  console.log('Turn ready for team:', game.teams[game.currentGame.currentTeamIndex].name);

  // Emit turn-ready event
  io.to(gameCode).emit('turn-ready', {
    currentTeamIndex: game.currentGame.currentTeamIndex,
    currentRound: game.currentGame.currentRound,
    currentCategory: randomCategory,
    scores: game.currentGame.scores,
    teams: game.teams
  });
}

// Add new function to handle the timer separately
function startTimer(gameCode: string) {
  const game = games.get(gameCode);
  if (!game?.currentGame) return;

  // Emit initial state for this turn
  io.to(gameCode).emit('game-state-update', {
    currentTeamIndex: game.currentGame.currentTeamIndex,
    currentRound: game.currentGame.currentRound,
    scores: game.currentGame.scores,
    timeRemaining: game.currentGame.timeRemaining,
    currentWord: game.currentGame.currentWord,
    currentCategory: game.currentGame.currentCategory,
    roundWords: game.currentGame.roundWords,
    teams: game.teams
  });

  // Start the timer
  game.currentGame.timer = setInterval(() => {
    if (!game.currentGame) return;

    game.currentGame.timeRemaining--;
    
    // Emit time update
    io.to(gameCode).emit('game-state-update', {
      timeRemaining: game.currentGame.timeRemaining,
      currentWord: game.currentGame.currentWord,
      currentTeamIndex: game.currentGame.currentTeamIndex,
      scores: game.currentGame.scores,
      roundWords: game.currentGame.roundWords
    });

    // Check if time is up
    if (game.currentGame.timeRemaining <= 0) {
      clearInterval(game.currentGame.timer);
      endTurn(gameCode);
    }
  }, 1000);
}

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});