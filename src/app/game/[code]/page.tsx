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
  const router = useRouter();
  const dispatch = useDispatch();
  const { currentGame, teams } = useSelector((state: RootState) => state.game);
  const [gameState, setGameState] = useState<'waiting' | 'turn-ready' | 'turn-active' | 'game-over'>('waiting');
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myTeamName, setMyTeamName] = useState<string | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  
  const gameCode = params.code as string;
  
  const startTurn = useCallback(() => {
    console.log('Starting turn');
    const socket = socketService.getSocket();
    socket.emit('start-turn', { gameCode });
  }, [gameCode]);
  
  // When the component mounts, try to identify which team this client belongs to
  useEffect(() => {
    // Check in localStorage if we previously identified our team
    const savedTeamId = localStorage.getItem(`game_${gameCode}_teamId`);
    const savedTeamName = localStorage.getItem(`game_${gameCode}_teamName`);
    
    if (savedTeamId && savedTeamName) {
      console.log('Found saved team info:', { savedTeamId, savedTeamName });
      setMyTeamId(savedTeamId);
      setMyTeamName(savedTeamName);
    }
  }, [gameCode]);

  // Main socket connection and event handling effect
  useEffect(() => {
    console.log('Game component mounted, current state:', gameState);
    
    const socket = socketService.getSocket();
    
    console.log('Connecting to game:', gameCode);
    
    if (!socket.connected) {
      console.log('Socket not connected, connecting now');
      socket.connect();
    }
    
    const onConnect = () => {
      console.log('Socket connected, joining game room:', gameCode);
      setIsConnected(true);
      socket.emit('join-room', { gameCode });
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
      
      // Store the game state in Redux
      dispatch(gameActions.setCurrentGame(data));
      
      if (data.teams) {
        dispatch(gameActions.setTeams(data.teams));
        
        // Try to identify our team if not already identified
        if (!myTeamId) {
          identifyMyTeam(data.teams);
        }
      }
      
      // Use the saved team ID to determine if it's our turn
      const activeTeamId = data.activeTeamId;
      const isActiveTeam = myTeamId === activeTeamId;
      
      console.log('Turn ready check:', { 
        mySocketId: socket.id, 
        myTeamId,
        myTeamName,
        activeTeamId, 
        isActiveTeam,
        teams: data.teams?.map(t => ({ id: t.id, name: t.name }))
      });
      
      setIsMyTurn(isActiveTeam);
      setGameState('turn-ready');
    });
    
    // Helper function to identify which team this client belongs to
    const identifyMyTeam = (teamsList: any[]) => {
      // First check if we're the host
      if (teamsList.length > 0 && !myTeamId) {
        // The host is usually the first team
        const possibleTeam = teamsList[0];
        
        // Save our team information
        console.log('Identified as team:', possibleTeam.name);
        setMyTeamId(possibleTeam.id);
        setMyTeamName(possibleTeam.name);
        
        // Store team info in localStorage for persistence
        localStorage.setItem(`game_${gameCode}_teamId`, possibleTeam.id);
        localStorage.setItem(`game_${gameCode}_teamName`, possibleTeam.name);
        
        // Also tell the server about our identity
        socket.emit('identify-team', {
          gameCode,
          teamId: possibleTeam.id,
          teamName: possibleTeam.name
        });
      }
    };
    
    socket.on('turn-started', (data) => {
      console.log('Turn started event received:', data);
      dispatch(gameActions.setCurrentGame(data));
      
      // Set game state to turn-active
      setGameState('turn-active');
      
      // Check if it's our turn (we'll wait for the word-to-guess event to confirm)
      const activeTeamId = data.activeTeamId;
      const isActiveTeam = myTeamId === activeTeamId;
      console.log('Turn started check:', { 
        myTeamId, 
        activeTeamId,
        isActiveTeam
      });
      
      setIsMyTurn(isActiveTeam);
    });
    
    socket.on('word-to-guess', (data) => {
      console.log('Word to guess received:', data);
      dispatch(gameActions.setCurrentWord(data));
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