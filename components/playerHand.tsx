import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import DraggableCard from './DraggableCard';
import { CardType } from './card';

interface PlayerHandProps {
  player: number;
  cards: CardType[];
  isCurrent: boolean;
  onDragStart?: (card: CardType) => void;
  onDragEnd?: (draggedItem: any, dropPosition: any) => void;
  onDragMove?: (card: CardType, position: { x: number; y: number }) => void;
  currentPlayer: number;
  tableCards?: any[]; // Add tableCards to check for temporary stacks
}

const PlayerHand = memo<PlayerHandProps>(({
  player,
  cards,
  isCurrent,
  onDragStart,
  onDragEnd,
  onDragMove,
  currentPlayer,
  tableCards = []
}) => {
  // Check if current player has used a hand card in their temporary stack
  const hasUsedHandCardInTurn = tableCards.some(
    item => item.type === 'temporary_stack' &&
            item.owner === currentPlayer &&
            item.cards &&
            item.cards.some(card => card.source === 'hand')
  );
  
  // Disable hand card dragging if player has already used a hand card this turn
  const canDragHandCards = isCurrent && !hasUsedHandCardInTurn;
  return (
    <View style={styles.playerHand}>
      {cards.map((card, index) => {
        const handKey = `hand-p${player}-${index}-${card.rank}-${card.suit}`;
        
        return (
          <DraggableCard
            key={handKey}
            card={card}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragMove={onDragMove}
            disabled={!canDragHandCards}
            draggable={canDragHandCards}
            size="normal"
            currentPlayer={currentPlayer}
            source="hand"
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  playerHand: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
});

export default PlayerHand;
export type { PlayerHandProps };