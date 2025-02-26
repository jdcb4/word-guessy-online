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
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
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
    turnStarted: boolean;
  };
}>();

// Near the top of the file, add socket ID mapping
const socketIdMap = new Map<string, string>();
const reverseSocketIdMap = new Map<string, string>();
const socketToGameMap = new Map<string, string>();  // Track which game each socket is in

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
  difficulty: string;
}

interface Team {
  id: string;
  name: string;
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

// Add this function to help with socket ID tracking
function updateSocketId(oldId: string, newId: string) {
  console.log('Updating socket ID mapping:', { oldId, newId });
  
  // Update the maps
  socketIdMap.set(newId, oldId);
  reverseSocketIdMap.set(oldId, newId);
  
  // Update team IDs in any games this socket is part of
  const gameCode = socketToGameMap.get(oldId);
  if (gameCode) {
    const game = games.get(gameCode);
    if (game) {
      const team = game.teams.find((t: any) => t.id === oldId);
      if (team) {
        console.log('Updating team ID:', { oldId, newId });
        team.id = newId;
      }
      socketToGameMap.delete(oldId);
      socketToGameMap.set(newId, gameCode);
    }
  }
}

// Add this helper function to log the current state
function logGameState(gameCode: string) {
  const game = games.get(gameCode);
  console.log('Current game state:', {
    gameCode,
    game: {
      teams: game?.teams,
      currentGame: game?.currentGame,
      settings: game?.settings
    },
    socketMappings: {
      socketIdMap: Array.from(socketIdMap.entries()),
      reverseSocketIdMap: Array.from(reverseSocketIdMap.entries()),
      socketToGameMap: Array.from(socketToGameMap.entries())
    }
  });
}

// Handle socket connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Add this to log all events received from this socket
  socket.onAny((event, ...args) => {
    console.log(`[${socket.id}] Event received: ${event}`, args);
  });

  socket.on('register-player', ({ previousId }) => {
    if (previousId) {
      console.log('Registering player:', { 
        currentId: socket.id, 
        previousId 
      });
      updateSocketId(previousId, socket.id);
    }
  });

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
    } catch (error: unknown) {
      console.error('Detailed host-game error:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
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

  // Handle joining a team
  socket.on('join-team', ({ gameCode, teamName }) => {
    console.log('Join team request:', { 
      socketId: socket.id, 
      gameCode, 
      teamName 
    });

    try {
      const game = games.get(gameCode);
      if (!game) {
        console.error('Game not found:', gameCode);
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      // Check if game is already in progress
      if (game.currentGame) {
        console.error('Cannot join game in progress');
        socket.emit('error', { message: 'Game already in progress' });
        return;
      }

      // Add the team to the game
      game.teams.push({
        id: socket.id,
        name: teamName
      });

      // Join the socket to the game room
      socket.join(gameCode);
      
      // Map this socket to the game code
      socketToGameMap.set(socket.id, gameCode);

      // Emit success events
      socket.emit('game-joined', { 
        gameCode,
        teams: game.teams
      });

      // Broadcast updated game state to all players
      io.to(gameCode).emit('game-updated', {
        teams: game.teams,
        settings: game.settings
      });

      console.log('Player successfully joined game:', {
        gameCode,
        teamName,
        totalTeams: game.teams.length
      });

    } catch (error) {
      console.error('Error joining team:', error);
      socket.emit('error', { 
        message: 'Failed to join game. Please try again.' 
      });
    }
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
        currentCategory: game.settings.categories[0], // Set initial category
        roundWords: {
          guessed: [],
          skipped: []
        },
        usedWords: new Set(),
        availableWords: allWords,
        timer: undefined,
        turnStarted: false
      };

      // Initialize scores for all teams
      game.teams.forEach(team => {
        game.currentGame!.scores[team.id] = 0;
      });

      console.log('Game initialized, preparing first turn');

      // Update the broadcast approach for the turn-ready event
      // First, broadcast game started to everyone
      io.to(gameCode).emit('game-started');
      
      // Then, broadcast turn-ready to everyone with the active team information
      io.to(gameCode).emit('turn-ready', {
        currentTeamIndex: game.currentGame.currentTeamIndex,
        currentRound: game.currentGame.currentRound,
        scores: game.currentGame.scores,
        currentCategory: game.currentGame.currentCategory,
        teams: game.teams,
        currentTeam: game.teams[game.currentGame.currentTeamIndex],
        activeTeamId: game.teams[game.currentGame.currentTeamIndex].id
      });
      
      console.log('Turn ready broadcast complete:', {
        gameCode,
        activeTeamId: game.teams[game.currentGame.currentTeamIndex].id,
        teams: game.teams.map(t => ({ id: t.id, name: t.name }))
      });

    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Failed to start game' });
    }
  });

  // Handle starting a turn
  socket.on('start-turn', ({ gameCode }) => {
    try {
      console.log(`Socket ${socket.id} attempting to start turn for game: ${gameCode}`);
      
      const game = games.get(gameCode);
      if (!game?.currentGame) {
        socket.emit('error', { message: 'Game not found or not started' });
        return;
      }
      
      const currentTeam = game.teams[game.currentGame.currentTeamIndex];
      console.log(`Current team: ${currentTeam.name} (${currentTeam.id})`);
      
      // Get random word from category
      const currentCategory = game.currentGame.currentCategory;
      const categoryWords = game.currentGame.availableWords.filter(w => 
        w.category === currentCategory && !game.currentGame?.usedWords.has(w.word)
      );
      
      if (categoryWords.length === 0) {
        console.log('No more words in category, ending turn');
        endTurn(gameCode);
        return;
      }
      
      const randomIndex = Math.floor(Math.random() * categoryWords.length);
      const selectedWord = categoryWords[randomIndex];
      
      // Mark this word as used
      game.currentGame.usedWords.add(selectedWord.word);
      
      // Store current word
      game.currentGame.currentWord = selectedWord;
      
      // Start the timer
      game.currentGame.timeRemaining = game.settings.turnDuration;
      game.currentGame.turnStarted = true;
      
      clearInterval(game.currentGame.timer);
      game.currentGame.timer = setInterval(() => {
        if (game.currentGame.timeRemaining <= 0) {
          clearInterval(game.currentGame.timer);
          endTurn(gameCode);
          return;
        }
        game.currentGame.timeRemaining -= 1;
      }, 1000);
      
      // Broadcast to everyone that the turn has started
      io.to(gameCode).emit('turn-started', {
        currentTeamIndex: game.currentGame.currentTeamIndex,
        currentRound: game.currentGame.currentRound,
        scores: game.currentGame.scores,
        timeRemaining: game.currentGame.timeRemaining,
        currentCategory: game.currentGame.currentCategory,
        teams: game.teams,
        activeTeamId: currentTeam.id
      });
      
      // Find all sockets for the active team and send them the word
      const activeTeamSockets = [];
      
      // Get the socket ID from our mapping
      const socketId = reverseSocketIdMap.get(currentTeam.id);
      if (socketId) {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (clientSocket) {
          activeTeamSockets.push(clientSocket);
        }
      }
      
      // Direct socket ID match (if the team creator is still connected with original socket)
      const directSocket = io.sockets.sockets.get(currentTeam.id);
      if (directSocket) {
        activeTeamSockets.push(directSocket);
      }
      
      // Log what we found
      console.log(`Found ${activeTeamSockets.length} active team sockets: `, 
        activeTeamSockets.map(s => s.id));
      
      // Send the word only to the active team sockets
      activeTeamSockets.forEach(teamSocket => {
        teamSocket.emit('word-to-guess', {
          word: selectedWord.word,
          category: selectedWord.category
        });
        console.log(`Sent word to socket: ${teamSocket.id}`);
      });
      
      console.log(`Turn started for team ${currentTeam.name} with word: ${selectedWord.word}`);
    } catch (error) {
      console.error('Error starting turn:', error);
      socket.emit('error', { message: 'Failed to start turn' });
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

  // Modify the join-room handler to explicitly map socket IDs to teams
  socket.on('join-room', ({ gameCode }) => {
    console.log(`Socket ${socket.id} joining room for game: ${gameCode}`);
    
    const game = games.get(gameCode);
    if (!game) {
      console.error('Game not found for room join:', gameCode);
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Join the socket to the game room
    socket.join(gameCode);
    
    // Find if this socket belongs to a team
    let matchedTeam = game.teams.find(team => 
      team.id === socket.id || 
      socketIdMap.get(socket.id) === team.id ||
      reverseSocketIdMap.get(team.id) === socket.id
    );
    
    if (matchedTeam) {
      console.log(`Socket ${socket.id} identified as team ${matchedTeam.name} (${matchedTeam.id})`);
      
      // Update the mapping
      if (matchedTeam.id !== socket.id) {
        console.log(`Updating socket ID map for reconnection: ${matchedTeam.id} -> ${socket.id}`);
        reverseSocketIdMap.set(matchedTeam.id, socket.id);
        socketIdMap.set(socket.id, matchedTeam.id);
      }
    } else {
      console.log(`Socket ${socket.id} not matched to any team in game ${gameCode}`);
    }
    
    console.log(`Socket ${socket.id} joined room ${gameCode}`);
    
    // If game is already in progress, send current state
    if (game.currentGame) {
      const currentTeamId = game.teams[game.currentGame.currentTeamIndex]?.id;
      const isActiveTeam = matchedTeam && matchedTeam.id === currentTeamId;
      
      console.log('Sending game state on room join:', {
        socketId: socket.id,
        gameCode,
        matchedTeam: matchedTeam?.name,
        isActiveTeam,
        gamePhase: game.currentGame.turnStarted ? 'turn-active' : 'turn-ready'
      });
      
      // Send appropriate game state based on current phase
      if (game.currentGame.turnStarted) {
        // Turn is active
        socket.emit('turn-started', {
          currentTeamIndex: game.currentGame.currentTeamIndex,
          currentRound: game.currentGame.currentRound,
          scores: game.currentGame.scores,
          currentCategory: game.currentGame.currentCategory,
          teams: game.teams,
          currentTeam: game.teams[game.currentGame.currentTeamIndex],
          isMyTurn: isActiveTeam
        });
        
        // If this is the active team, also send them the current word
        if (isActiveTeam && game.currentGame.currentWord) {
          socket.emit('word-to-guess', {
            word: game.currentGame.currentWord.word,
            category: game.currentGame.currentWord.category
          });
        }
      } else {
        // Turn is ready to start
        socket.emit('turn-ready', {
          currentTeamIndex: game.currentGame.currentTeamIndex,
          currentRound: game.currentGame.currentRound,
          scores: game.currentGame.scores,
          currentCategory: game.currentGame.currentCategory,
          teams: game.teams,
          currentTeam: game.teams[game.currentGame.currentTeamIndex],
          activeTeamId: currentTeamId,
          isMyTurn: isActiveTeam
        });
      }
    } else {
      // Game not started yet, send waiting state
      socket.emit('game-updated', {
        teams: game.teams,
        settings: game.settings
      });
    }
  });

  // Add this handler near your other socket handlers
  socket.on('join-game', ({ gameCode, teamName }) => {
    // Simply redirect to join-team handler to avoid duplicate code
    socket.emit('join-team', { gameCode, teamName });
  });

  // Add this after line 390 (right after the start-game handler)
  socket.on('identify-team', ({ gameCode, teamId, teamName }) => {
    console.log(`Socket ${socket.id} identifying as team ${teamName} (${teamId}) in game ${gameCode}`);
    
    const game = games.get(gameCode);
    if (!game) {
      console.error('Game not found for team identification');
      return;
    }
    
    // Verify this is a valid team in the game
    const team = game.teams.find(t => t.id === teamId && t.name === teamName);
    if (team) {
      console.log(`Valid team identification: ${teamName} (${teamId})`);
      
      // Update the socket ID mappings
      socketIdMap.set(socket.id, teamId);
      reverseSocketIdMap.set(teamId, socket.id);
      
      console.log('Updated socket mappings:', {
        socketToTeam: Array.from(socketIdMap.entries())
          .filter(([key, value]) => key === socket.id || value === teamId),
        teamToSocket: Array.from(reverseSocketIdMap.entries())
          .filter(([key, value]) => key === teamId || value === socket.id)
      });
    } else {
      console.error(`Invalid team identification attempt: ${teamName} (${teamId})`);
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

  // Initialize turn state
  game.currentGame.timeRemaining = game.settings.turnDuration;
  game.currentGame.roundWords = {
    guessed: [],
    skipped: []
  };
  game.currentGame.currentWord = null as unknown as Word;

  // Emit turn-ready event with game state
  io.to(gameCode).emit('turn-ready', {
    currentTeamIndex: game.currentGame.currentTeamIndex,
    currentRound: game.currentGame.currentRound,
    scores: game.currentGame.scores,
    currentCategory: game.currentGame.currentCategory,
    teams: game.teams
  });
}

// Add new function to handle the timer separately
function startTimer(gameCode: string) {
  const game = games.get(gameCode);
  if (!game?.currentGame) return;

  // Clear any existing timer
  if (game.currentGame.timer) {
    clearInterval(game.currentGame.timer);
  }

  game.currentGame.timer = setInterval(() => {
    if (!game.currentGame) return;

    game.currentGame.timeRemaining--;

    // Emit time update
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