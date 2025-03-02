'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { socketService } from '@/services/socket';
import { gameActions } from '@/store/gameSlice';
import { RootState } from '@/store/store';
import { ActiveTeamView } from '@/components/ActiveTeamView';
import { SpectatorView } from '@/components/SpectatorView';
import { TurnEndSummary } from '@/components/TurnEndSummary';
import { TurnReadyView } from '@/components/TurnReadyView';
import { GameOverView } from '@/components/GameOverView';

export default function Game() {
  const params = useParams();
  const gameCode = params.code as string;
  const router = useRouter();
  const dispatch = useDispatch();
  
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'waiting' | 'turn-ready' | 'turn-active' | 'game-over'>('waiting');
  const [isMyTurn, setIsMyTurn] = useState(false);
  
  // Read team info from URL params, localStorage, or previously stored values
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myTeamName, setMyTeamName] = useState<string | null>(null);
  
  const currentGame = useSelector((state: RootState) => state.game.currentGame);
  const currentWord = useSelector((state: RootState) => state.game.currentWord);
  const teams = useSelector((state: RootState) => state.game.teams);
  
  // Load team info from localStorage if available (outside of useEffect)
  useEffect(() => {
    const storedTeamId = localStorage.getItem(`game-${gameCode}-teamId`);
    const storedTeamName = localStorage.getItem(`game-${gameCode}-teamName`);
    
    if (storedTeamId) setMyTeamId(storedTeamId);
    if (storedTeamName) setMyTeamName(storedTeamName);
    
    console.log('Loaded team info from localStorage:', { 
      storedTeamId, 
      storedTeamName 
    });
  }, [gameCode]);
  
  // Save team info to localStorage when it changes
  useEffect(() => {
    if (myTeamId && myTeamName) {
      localStorage.setItem(`game-${gameCode}-teamId`, myTeamId);
      localStorage.setItem(`game-${gameCode}-teamName`, myTeamName);
      console.log('Saved team info to localStorage:', { myTeamId, myTeamName });
    }
  }, [myTeamId, myTeamName, gameCode]);
  
  const startTurn = useCallback(() => {
    console.log('Starting turn');
    const socket = socketService.getSocket();
    socket.emit('start-turn', { gameCode });
  }, [gameCode]);
  
  // Main socket connection and event handling
  useEffect(() => {
    console.log('Game component mounted, current state:', gameState);

    const socket = socketService.getSocket();
    
    console.log('Connecting to game:', gameCode);
    
    if (!socket.connected) {
      console.log('Socket not connected, connecting now');
      socket.connect();
    }
    
    // When we connect or reconnect, identify our team
    const onConnect = () => {
      setIsConnected(true);
      console.log('Socket connected, joining game room');
      
      // Join the game room
      socket.emit('join-room', { gameCode });
      
      // Get team ID from state or localStorage
      if (myTeamId || myTeamName) {
        console.log('Identifying as team:', { myTeamId, myTeamName });
        socket.emit('identify-team', {
          gameCode,
          teamId: myTeamId,
          teamName: myTeamName
        });
      } else {
        console.log('No team info available for identification');
      }
      
      // Get latest game state
      socket.emit('get-game-state', { gameCode });
    };
    
    const onDisconnect = () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    };
    
    const onError = (err: any) => {
      console.error('Socket error:', err);
      setError(err.message || 'An error occurred');
    };
    
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('error', onError);
    
    if (socket.connected) {
      onConnect();
    }
    
    // Listen for game started event
    socket.on('game-started', () => {
      console.log('Game started event received');
      setGameState('waiting'); // Wait for turn-ready event
    });
    
    socket.on('game-state-update', (data) => {
      console.log('Game state update received:', data);
      dispatch(gameActions.setCurrentGame(data));
      
      if (data.teams) {
        dispatch(gameActions.setTeams(data.teams));
        
        // Try to identify our team if not already identified
        if (!myTeamId) {
          identifyMyTeam(data.teams);
        }
      }
    });
    
    socket.on('turn-ready', (data) => {
      console.log('Turn ready event received:', data);
      dispatch(gameActions.setCurrentGame(data));
      
      // Update currentWord state to null since we don't have a word yet
      dispatch(gameActions.setCurrentWord(null));
      
      // Check if it's our turn
      const activeTeamId = data.activeTeamId;
      const isActiveTeam = myTeamId === activeTeamId;
      console.log('Is active team check:', { myTeamId, activeTeamId, isActiveTeam });
      
      // Set game state
      setGameState('turn-ready');
      setIsMyTurn(isActiveTeam);
    });
    
    socket.on('turn-started', (data) => {
      console.log('Turn started event received:', data);
      dispatch(gameActions.setCurrentGame(data));
      
      // Check if it's our turn
      const activeTeamId = data.activeTeamId;
      const isActiveTeam = myTeamId === activeTeamId;
      console.log('Turn started team check:', { myTeamId, activeTeamId, isActiveTeam });
      
      // Set game state
      setGameState('turn-active');
      setIsMyTurn(isActiveTeam);
    });
    
    socket.on('word-to-guess', (data) => {
      console.log('Word to guess received:', data);
      dispatch(gameActions.setCurrentWord(data));
      
      // This confirms we are the active team
      setIsMyTurn(true);
      console.log('Setting isMyTurn to true because we received a word');
    });
    
    socket.on('turn-end', (data) => {
      console.log('Turn end event received:', data);
      dispatch(gameActions.setCurrentGame(data));
      setGameState('turn-ready');
      
      // Update isMyTurn based on the new active team
      const activeTeamId = data.activeTeamId;
      setIsMyTurn(myTeamId === activeTeamId);
    });
    
    socket.on('game-over', (data) => {
      console.log('Game over event received:', data);
      dispatch(gameActions.setCurrentGame(data));
      setGameState('game-over');
    });
    
    return () => {
      console.log('Cleaning up game component event listeners');
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('error', onError);
      socket.off('game-started');
      socket.off('turn-ready');
      socket.off('turn-started');
      socket.off('word-to-guess');
      socket.off('turn-end');
      socket.off('game-over');
      socket.off('game-state-update');
    };
  }, [gameCode, dispatch, gameState, myTeamId, myTeamName]);
  
  console.log('Current game state:', { gameState, isMyTurn, myTeamId, myTeamName, currentGame, teams });
  
  // Render different views based on game state
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Connecting to game...</h2>
          <p className="text-gray-600">Please wait while we establish connection</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-4">
          <h2 className="text-xl font-bold text-red-500 mb-2">Error</h2>
          <p>{error}</p>
          <button 
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-primary text-white rounded"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }
  
  if (gameState === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Waiting for game to start...</h2>
          <p className="text-gray-600">Game will begin shortly</p>
        </div>
      </div>
    );
  }
  
  if (gameState === 'turn-ready') {
    return (
      <TurnReadyView onStartTurn={startTurn} isActiveTeam={isMyTurn} />
    );
  }
  
  if (gameState === 'turn-active') {
    if (isMyTurn) {
      return <ActiveTeamView />;
    }
    return <SpectatorView />;
  }
  
  if (gameState === 'game-over') {
    return (
      <GameOverView 
        onPlayAgain={() => console.log('Play again clicked')} 
        onBackToHome={() => router.push('/')} 
      />
    );
  }
  
  // Default loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl mb-2">Loading game...</h2>
      </div>
    </div>
  );
} 