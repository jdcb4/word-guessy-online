import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import { getWords, shuffleWords } from './utils/wordUtils';
import { clearInterval } from 'timers';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Configure CORS
app.use(cors());

// Initialize Socket.io
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  }
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

// Add this function near the other helper functions at the top of the file
function mapTeamToSocket(teamId: string, socketId: string, gameCode: string) {
  console.log(`Mapping team ${teamId} to socket ${socketId} in game ${gameCode}`);
  
  // Set both directions of mapping
  socketIdMap.set(socketId, teamId);
  reverseSocketIdMap.set(teamId, socketId);
  
  // Also store the game code mapping
  socketToGameMap.set(socketId, gameCode);
  
  // Log the current mappings for this team/socket
  console.log('Socket-team mappings updated:', {
    socketToTeam: Array.from(socketIdMap.entries())
      .filter(([key, value]) => key === socketId || value === teamId),
    teamToSocket: Array.from(reverseSocketIdMap.entries())
      .filter(([key, value]) => key === teamId || value === socketId)
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
    if (!game) {
      console.error('Game not found for state request:', gameCode);
      // socket.emit('error', { message: 'Game not found' });
      return;
    }

    if (!game.currentGame) {
      // This is not actually an error - the game exists but hasn't started yet
      console.log('Game exists but not started yet:', gameCode);
      socket.emit('game-updated', {
        teams: game.teams,
        settings: game.settings
      });
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

      // Create the team object
      const teamId = socket.id;
      const team = {
        id: teamId,
        name: teamName
      };
      
      // Add the team to the game
      game.teams.push(team);

      // Join the socket to the game room
      socket.join(gameCode);
      
      // Map this socket to the team ID and game code
      mapTeamToSocket(teamId, socket.id, gameCode);

      // Emit success events
      socket.emit('game-joined', { 
        gameCode,
        teamId: teamId,  // Send the team ID back to the client
        teamName: teamName,
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
      if (!game || !game.currentGame) {
        console.error('Game or currentGame not found:', gameCode);
        socket.emit('error', { message: 'Game not found or not started' });
        return;
      }
      
      // Store a reference to currentGame
      const currentGame = game.currentGame;
      
      const currentTeam = game.teams[currentGame.currentTeamIndex];
      console.log(`Current team: ${currentTeam.name} (${currentTeam.id})`);
      
      // Comprehensive check if this socket belongs to the active team
      const isActiveTeam = 
        // Direct match (socket ID is the team ID)
        currentTeam.id === socket.id || 
        // Socket is mapped to the team ID
        socketIdMap.get(socket.id) === currentTeam.id ||
        // Team ID is mapped to this socket
        reverseSocketIdMap.get(currentTeam.id) === socket.id;
      
      console.log(`Start turn request validation:`, { 
        socketId: socket.id,
        teamId: currentTeam.id,
        mappedTeamId: socketIdMap.get(socket.id),
        teamSocketId: reverseSocketIdMap.get(currentTeam.id),
        isActiveTeam
      });
      
      if (!isActiveTeam) {
        console.warn('Attempt to start turn from non-active team');
        socket.emit('error', { message: 'Not your turn' });
        return;
      }
      
      // If we got here, this is the active team
      console.log(`Valid start turn request from active team: ${currentTeam.name}`);
      
      // Select a random word
      const availableWords = currentGame.availableWords.filter(
        word => !currentGame.usedWords.has(word.word) && 
                word.category === currentGame.currentCategory
      ) || [];
      
      if (availableWords.length === 0) {
        console.error('No more words available!');
        socket.emit('error', { message: 'No more words available' });
        return;
      }
      
      const randomIndex = Math.floor(Math.random() * availableWords.length);
      const selectedWord = availableWords[randomIndex];
      
      // Mark this word as used
      currentGame.usedWords.add(selectedWord.word);
      currentGame.currentWord = selectedWord;
      currentGame.timeRemaining = game.settings.turnDuration;
      currentGame.turnStarted = true;
      
      // Set timer for turn
      if (currentGame.timer) {
        clearInterval(currentGame.timer);
      }
      currentGame.timer = setInterval(() => {
        // We need to re-check the game state here
        const gameCheck = games.get(gameCode);
        if (!gameCheck || !gameCheck.currentGame) {
          clearInterval(currentGame.timer);
          return;
        }
        
        if (gameCheck.currentGame.timeRemaining <= 0) {
          clearInterval(gameCheck.currentGame.timer);
          endTurn(gameCode);
          return;
        }
        gameCheck.currentGame.timeRemaining -= 1;
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
      
      // Find ALL sockets that might belong to the active team
      const activeTeamSockets = [];
      
      // Check if we have a direct mapping
      const socketId = reverseSocketIdMap.get(currentTeam.id);
      if (socketId) {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (clientSocket) {
          activeTeamSockets.push(clientSocket);
          console.log(`Found active team socket via mapping: ${socketId}`);
        }
      }
      
      // Also check if the team ID is directly a socket ID (original scenario)
      const directSocket = io.sockets.sockets.get(currentTeam.id);
      if (directSocket) {
        if (!activeTeamSockets.find(s => s.id === directSocket.id)) {
          activeTeamSockets.push(directSocket);
          console.log(`Found active team socket via direct ID: ${directSocket.id}`);
        }
      }
      
      // If no sockets found yet, try getting all sockets in the room and check their mappings
      if (activeTeamSockets.length === 0) {
        console.log('No direct mappings found, checking all sockets in the room');
        const roomSockets = io.sockets.adapter.rooms.get(gameCode);
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const clientSocket = io.sockets.sockets.get(socketId);
            if (clientSocket && socketIdMap.get(socketId) === currentTeam.id) {
              activeTeamSockets.push(clientSocket);
              console.log(`Found active team socket via room check: ${socketId}`);
            }
          }
        }
      }
      
      // Log what we found
      console.log(`Found ${activeTeamSockets.length} active team sockets:`, 
        activeTeamSockets.map(s => s.id));
      
      // Send the word only to the active team sockets
      if (activeTeamSockets.length > 0) {
        activeTeamSockets.forEach(teamSocket => {
          teamSocket.emit('word-to-guess', {
            word: selectedWord.word,
            category: selectedWord.category
          });
          console.log(`Sent word "${selectedWord.word}" to socket: ${teamSocket.id}`);
        });
      } else {
        console.warn('No active team sockets found to send the word to!');
      }
      
      console.log(`Turn started for team ${currentTeam.name} with word: ${selectedWord.word}`);
    } catch (error) {
      console.error('Error starting turn:', error);
      socket.emit('error', { message: 'Failed to start turn' });
    }
  });

  // Handle word guessed correctly
  socket.on('word-guessed', ({ gameCode, word }) => {
    const game = games.get(gameCode);
    if (!game || !game.currentGame) return;

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
    if (!game || !game.currentGame) return;

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
    if (!game || !game.currentGame) return;

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
      // Don't emit an error here since this might be a reconnection attempt
      // socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Join the socket to the game room
    socket.join(gameCode);
    
    // Map this socket to the game code
    socketToGameMap.set(socket.id, gameCode);
    
    // Try to find which team this socket belongs to
    const matchedTeam = game.teams.find(t => t.id === socket.id);
    
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

  // Update the identify-team handler to be more robust
  socket.on('identify-team', ({ gameCode, teamId, teamName }) => {
    try {
      console.log(`Socket ${socket.id} identifying as team:`, { teamId, teamName, gameCode });
      
      const game = games.get(gameCode);
      if (!game) {
        console.log('Game not found for team identification');
        return;
      }
      
      // Find the team - try multiple ways to match
      let team = game.teams.find(t => {
        // First try ID match
        if (teamId && t.id === teamId) {
          console.log(`Found team by ID match: ${t.name} (${t.id})`);
          return true;
        }
        
        // Then try name match
        if (teamName && t.name === teamName) {
          console.log(`Found team by name match: ${t.name} (${t.id})`);
          return true;
        }
        
        return false;
      });
      
      if (team) {
        // Map this socket to the team
        mapTeamToSocket(team.id, socket.id, gameCode);
        
        // Send confirmation back to client
        socket.emit('team-identified', {
          teamId: team.id,
          teamName: team.name
        });
        
        // If this is the currently active team, send them special data
        if (game.currentGame) {
          const currentTeamIndex = game.currentGame.currentTeamIndex;
          if (game.teams[currentTeamIndex].id === team.id) {
            console.log(`Identified socket belongs to active team!`);
            
            // If turn is already started, send them the current word
            if (game.currentGame.turnStarted && game.currentGame.currentWord) {
              console.log(`Sending current word to identified active team socket`);
              socket.emit('word-to-guess', {
                word: game.currentGame.currentWord.word,
                category: game.currentGame.currentWord.category
              });
            }
          }
        }
      } else {
        console.log(`No matching team found for: ${teamName} (${teamId})`);
      }
    } catch (error) {
      console.error('Error in identify-team handler:', error);
    }
  });
});

function startTurn(gameCode: string) {
  const game = games.get(gameCode);
  if (!game || !game.currentGame || !game.settings) {
    console.error('Invalid game state in startTurn:', gameCode);
    return;
  }

  // Store a reference to currentGame
  const currentGame = game.currentGame;

  // Get words for the selected category
  const categoryWords = currentGame.availableWords.filter(word => 
    word.category === currentGame.currentCategory && 
    !currentGame.usedWords.has(word.word)
  );

  if (categoryWords.length === 0) {
    console.log('No more words available in category, ending game');
    endGame(gameCode);
    return;
  }

  // Select first word
  const randomIndex = Math.floor(Math.random() * categoryWords.length);
  currentGame.currentWord = categoryWords[randomIndex];

  console.log('Starting turn with word:', currentGame.currentWord.word);

  // Start the timer and emit initial state
  startTimer(gameCode);

  // Emit turn-started event with initial game state
  io.to(gameCode).emit('game-state-update', {
    currentTeamIndex: currentGame.currentTeamIndex,
    currentRound: currentGame.currentRound,
    scores: currentGame.scores,
    timeRemaining: currentGame.timeRemaining,
    currentWord: currentGame.currentWord,
    currentCategory: currentGame.currentCategory,
    roundWords: currentGame.roundWords,
    teams: game.teams
  });
}

function endTurn(gameCode: string) {
  const game = games.get(gameCode);
  if (!game || !game.currentGame) return;

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
  if (!game || !game.currentGame) return;

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
  console.log(`Preparing turn for game: ${gameCode}`);
  
  const game = games.get(gameCode);
  if (!game || !game.currentGame) {
    console.error('Game not found or not initialized');
    return;
  }
  
  // Reset turn state
  game.currentGame.roundWords = {
    guessed: [],
    skipped: []
  };
  game.currentGame.currentWord = undefined;
  game.currentGame.turnStarted = false;
  
  // Log the current active team
  const currentTeam = game.teams[game.currentGame.currentTeamIndex];
  console.log(`Turn prepared for team: ${currentTeam.name} (${currentTeam.id})`);
  
  // Broadcast turn ready event with explicit active team ID
  io.to(gameCode).emit('turn-ready', {
    currentTeamIndex: game.currentGame.currentTeamIndex,
    currentRound: game.currentGame.currentRound,
    scores: game.currentGame.scores,
    currentCategory: game.currentGame.currentCategory,
    teams: game.teams,
    currentTeam: currentTeam,
    activeTeamId: currentTeam.id
  });
  
  // Log the mappings for the active team
  const socketId = reverseSocketIdMap.get(currentTeam.id);
  console.log('Current active team mapping check:', {
    teamId: currentTeam.id,
    mappedSocketId: socketId,
    socketExists: socketId ? io.sockets.sockets.has(socketId) : false
  });
}

// Add new function to handle the timer separately
function startTimer(gameCode: string) {
  const game = games.get(gameCode);
  if (!game || !game.currentGame) return;

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

// Export a function that takes an HTTP server and sets up Socket.IO
export default function setupSocketServer(httpServer: typeof createServer) {
  // Initialize Socket.IO with CORS settings
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"]
    }
  });
  
  // Rest of your Socket.IO code remains the same
  // ...
}

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});