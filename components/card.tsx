import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';

type CardType = {
  rank: string;
  suit: string;
};

type CardProps = {
  card: CardType;
  onPress?: (card: CardType) => void;
  onDragStart?: (event: GestureResponderEvent) => void;
  onDragEnd?: (event: GestureResponderEvent) => void;
  draggable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  size?: "normal" | "small" | "large";
};

const Card: React.FC<CardProps> = ({
  card,
  onPress,
  onDragStart,
  onDragEnd,
  draggable = false,
  selected = false,
  disabled = false,
  size = 'normal'
}) => {

  const getSuitColor = (suit: string): string => {
    return (suit === '♥' || suit === '♦') ? '#FF0000' : '#000000';
  };

  const getCardSize = (): { width: number; height: number } => {
    switch (size) {
      case 'small':
        return { width: 40, height: 56 };
      case 'large':
        return { width: 80, height: 112 };
      default:
        return { width: 60, height: 84 };
    }
  };

  return (
    <TouchableOpacity 
      onPress={() => onPress && onPress(card)} 
      disabled={disabled}
      style={[
        styles.card,
        getCardSize(),
        selected && styles.selectedCard,
        disabled && styles.disabledCard,
      ]}
    >
      <Text style={[
        styles.rank,
        { color: getSuitColor(card.suit) },
        size === 'small' && styles.smallText
      ]}>
        {card.rank}
      </Text>
      <Text style={[
        styles.suit,
        { color: getSuitColor(card.suit) },
        size === 'small' && styles.smallText
      ]}>
        {card.suit}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    margin: 2,
  },
  selectedCard: {
    borderColor: '#007AFF',
    borderWidth: 3,
    backgroundColor: '#E3F2FD',
  },
  disabledCard: {
    opacity: 0.5,
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  suit: {
    fontSize: 14,
    textAlign: 'center',
  },
  smallText: {
    fontSize: 12,
  },
});

export default Card;
export type { CardType, CardProps };