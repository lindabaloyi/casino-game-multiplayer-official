import React, { useState, useEffect } from 'react';
import { StyleSheet, Platform, View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import GameBoard from './components/GameBoard';
import StartScreen from './components/StartScreen';

import { useSocket } from './hooks/useSocket';

// Wrapper for the multiplayer game experience
const MultiplayerGame = () => {
  const { gameState, playerNumber, sendAction } = useSocket();

  const handleRestart = () => {
    // In multiplayer, restart might mean leaving the game
    // For now, just disconnect and go back to menu
    // TODO: Implement proper restart logic
  };

  const handleBackToMenu = () => {
    // Disconnect and go back to menu
    // TODO: Implement proper disconnect logic
  };

  if (!gameState) {
    return (
      <View style={styles.container}>
        <Text style={{color: 'white', fontSize: 30, textAlign: 'center'}}>
          Waiting for another player to join...
        </Text>
      </View>
    );
  }

  return <GameBoard initialState={gameState} playerNumber={playerNumber} sendAction={sendAction} onRestart={handleRestart} onBackToMenu={handleBackToMenu} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [key, setKey] = useState(0);
  const [gameMode, setGameMode] = useState<'single' | 'multiplayer' | null>(null);

  // Initialize global drop zones registry for drag and drop functionality
  useEffect(() => {
    (global as any).dropZones = [];
    console.log('[INIT] Global drop zones registry initialized');
  }, []);

  // Force landscape orientation and hide system UI on app start
  useEffect(() => {
    async function setupImmersiveMode() {
      // Lock to landscape orientation
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

      // Hide navigation bar on Android
      if (Platform.OS === 'android') {
        await NavigationBar.setVisibilityAsync('hidden');
        await NavigationBar.setBehaviorAsync('overlay-swipe');
      }
    }
    setupImmersiveMode();
  }, []);

  const handleRestart = () => {
    // In multiplayer, restart might mean leaving the game
    if (gameMode === 'multiplayer') {
      setGameMode(null); // Go back to main menu
    } else {
      setKey((prev) => prev + 1);
    }
  };

  const handleBackToMenu = () => {
    setGameMode(null);
  }

  if (!gameMode) {
    return <StartScreen onSelectMode={setGameMode} />;
  }

  if (gameMode === 'single') {
    // Pass a function to go back to the main menu
    return <GameBoard key={key} onRestart={handleRestart} onBackToMenu={handleBackToMenu} initialState={null} playerNumber={null} sendAction={() => {}} />;
  }

  return <MultiplayerGame />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f4d0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
