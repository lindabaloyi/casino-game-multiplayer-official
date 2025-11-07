import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { GameState } from '../types/gameTypes';

// Use localhost for web and IP for mobile for simplified testing
const SERVER_URL = Platform.OS === 'web'
  ? 'http://localhost:3001'
  : 'http://192.168.18.2:3001'; // Replace with your machine's actual local IP address

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerNumber, setPlayerNumber] = useState<number | null>(null);
  const [modalInfo, setModalInfo] = useState(null);

  useEffect(() => {
    // Connect to the server
    socketRef.current = io(SERVER_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to server with ID:', socketRef.current?.id);
    });

    socketRef.current.on('game-start', (data: { gameState: GameState; playerNumber: number }) => {
      console.log('Game is starting!');
      setGameState(data.gameState);
      setPlayerNumber(data.playerNumber);
    });

    socketRef.current.on('game-update', (newGameState: GameState) => {
      console.log('Received game update.');
      setGameState(newGameState);
    });
    socketRef.current.on('game-update', (newGameState: GameState) => {
      console.log('Received game update.');
      setGameState(newGameState);

      // Check if the server sent multi-choice modal info for staging stack action
      // For example, if newGameState includes a special property 'modalOptions' or 'options' in root or nested
      if ((newGameState as any).modalOptions) {
        // Ideally this should be better typed and integrated, but for now:
        setModalInfo((prev) => ({
          title: 'Choose Your Action',
          message: 'This combination can form multiple actions. Please choose one:',
          actions: (newGameState as any).modalOptions,
        }));
      }
    });

    socketRef.current.on('error', (error: { message: string }) => {
        console.log('Received error from server:', error.message);
        alert(`Server Error: ${error.message}`);
    });

    socketRef.current.on('player-number', (num: number) => {
      console.log(`Assigned player number: ${num}`);
      setPlayerNumber(num);
    });



    // Disconnect on cleanup
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const sendAction = (type: string, payload: object) => {
    console.log(`Sending action: ${type}`);
    socketRef.current?.emit('game-action', { type, payload });
  };

  return { gameState, playerNumber, sendAction };
};
