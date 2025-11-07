import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface StartScreenProps {
  onSelectMode: (mode: 'single' | 'multiplayer') => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onSelectMode }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Casino Card Game</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => onSelectMode('single')}>
          <Text style={styles.buttonText}>Single Player</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => onSelectMode('multiplayer')}>
          <Text style={styles.buttonText}>Multiplayer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f4d0f', // Same as GameBoard
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 80,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  buttonContainer: {
    width: '60%',
  },
  button: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonText: {
    color: 'white',
    fontSize: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default StartScreen;
