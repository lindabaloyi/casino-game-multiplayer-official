import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Card, { CardType } from './card';
import CardStack from './CardStack';
import { calculateCardSum } from '../game-logic/card-operations.js';

// --- Types ---

type BuildType = {
  type: 'build';
  buildId: string;
  cards: CardType[];
  value: number;
  owner: number;
};

type TempStackType = {
  type: 'temporary_stack';
  stackId: string;
  cards: CardType[];
};

type LooseCardType = CardType & {
  type?: 'loose';
};

type TableCardItem = BuildType | TempStackType | LooseCardType;

type BuildStackProps = {
  build: BuildType;
  onDropStack: (draggedItem: any, info: { type: 'build'; buildId: string }) => void;
  onCardPress?: () => void;
};

type TempStackProps = {
  stack: TempStackType;
  onDropOnCard: (draggedItem: any, info: { type: 'temporary_stack'; stackId: string }) => void;
  currentPlayer: number;
  onCancelStack: (stack: TempStackType) => void;
  onConfirmStack: (stack: TempStackType) => void;
  onCardPress?: () => void;
  onDragStart?: (args?: any) => void;
  onDragEnd?: (args?: any) => void;
  onDragMove?: (args?: any) => void;
};

type LooseCardProps = {
  card: CardType;
  onDropOnCard: (draggedItem: any, info: { type: 'loose'; cardId: string; rank: string; suit: string }) => void;
  currentPlayer: number;
  onCardPress?: () => void;
  onDragStart?: (args?: any) => void;
  onDragEnd?: (args?: any) => void;
  onDragMove?: (args?: any) => void;
};

type TableCardsProps = {
  cards: TableCardItem[];
  onDropOnCard: (draggedItem: any, info: any) => void;
  currentPlayer: number;
  onCancelStack: (stack: TempStackType) => void;
  onConfirmStack: (stack: TempStackType) => void;
  onCardPress?: () => void;
  onDragStart?: (args?: any) => void;
  onDragEnd?: (args?: any) => void;
  onDragMove?: (args?: any) => void;
  isDragging?: boolean;
};

// --- Components ---
const BuildStack = memo(({ build, onDropStack, onCardPress = () => {} }: BuildStackProps) => {
  const memoizedOnDropStack = useCallback(
    (draggedItem: any) => onDropStack(draggedItem, { type: 'build', buildId: build.buildId }),
    [onDropStack, build.buildId]
  );

  const getPlayerColor = (player: number) => {
    return player === 0 ? '#FF5722' : '#2196F3';
  };

  return (
    <View style={styles.build}>
      <CardStack
        stackId={build.buildId}
        cards={build.cards}
        onDropStack={memoizedOnDropStack}
        buildValue={build.value}
        isBuild={true}
      />
      <View style={[styles.buildOwnerTag, { backgroundColor: getPlayerColor(build.owner) }]}>
        <Text style={styles.buildOwnerText}>P{build.owner + 1}</Text>
      </View>
    </View>
  );
});

const TempStack = memo(({
  stack,
  onDropOnCard,
  currentPlayer,
  onCancelStack,
  onConfirmStack,
  onCardPress = () => {},
  onDragStart,
  onDragEnd,
  onDragMove
}: TempStackProps) => {
  const memoizedOnDropStack = useCallback(
    (draggedItem: any) => onDropOnCard(draggedItem, { type: 'temporary_stack', stackId: stack.stackId }),
    [onDropOnCard, stack.stackId]
  );
  const stackValue = calculateCardSum(stack.cards);

  return (
    <View style={styles.build}>
      <TouchableOpacity
        style={styles.cancelStackButton}
        onPress={() => onCancelStack(stack)}
      >
        <Text style={styles.cancelStackText}>×</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.confirmStackButton}
        onPress={() => onConfirmStack(stack)}
      >
        <Text style={styles.confirmStackText}>✓</Text>
      </TouchableOpacity>
      <CardStack
        stackId={stack.stackId}
        cards={stack.cards}
        onDropStack={memoizedOnDropStack}
        isBuild={true}
        buildValue={stackValue}
        draggable={true}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragMove={onDragMove}
        currentPlayer={currentPlayer}
        dragSource="temporary_stack"
      />
      <View style={styles.tempStackIndicator}>
        <Text style={styles.tempStackText}>Staging</Text>
      </View>
    </View>
  );
});

const LooseCard = ({
  card,
  onDropOnCard,
  currentPlayer,
  onCardPress = () => {},
  onDragStart,
  onDragEnd,
  onDragMove
}: LooseCardProps) => {
  return (
    <View style={styles.looseCardContainer}>
      <CardStack
        stackId={`loose-stack-${card.rank}-${card.suit}`}
        cards={[card]}
        onDropStack={useCallback(
          (draggedItem: any) =>
            onDropOnCard(draggedItem, { type: 'loose', cardId: `${card.rank}-${card.suit}`, rank: card.rank, suit: card.suit }),
          [onDropOnCard, card.rank, card.suit]
        )}
        draggable={true}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragMove={onDragMove}
        currentPlayer={currentPlayer}
        dragSource="table"
      />
    </View>
  );
};

const TableCards = ({
  cards,
  onDropOnCard,
  currentPlayer,
  onCancelStack,
  onConfirmStack,
  onCardPress = () => {},
  onDragStart,
  onDragEnd,
  onDragMove,
  isDragging = false
}: TableCardsProps) => {
  const memoizedOnDropOnCard = useCallback(onDropOnCard, [onDropOnCard]);


  return (
    <View style={styles.tableCards}>
      {/* Horizontal card container using flexbox - no ScrollView interference */}
      <View style={styles.cardsContainer}>
        {cards.length === 0 ? (
          <View style={styles.emptyTable}>
            <Text style={styles.emptyText}>No cards on table</Text>
          </View>
        ) : (
          cards.map((item, index) => {

            if (item.type === 'build') {
              return (
                <BuildStack
                  key={item.buildId ? `build-${item.buildId}` : `build-fallback-${index}`}
                  build={item as BuildType}
                  onDropStack={memoizedOnDropOnCard}
                  onCardPress={onCardPress}
                />
              );
            }
            if (item.type === 'temporary_stack') {
              return (
                <TempStack
                  key={item.stackId ? `stack-${item.stackId}` : `stack-fallback-${index}`}
                  stack={item as TempStackType}
                  onDropOnCard={memoizedOnDropOnCard}
                  currentPlayer={currentPlayer}
                  onCancelStack={onCancelStack}
                  onConfirmStack={onConfirmStack}
                  onCardPress={onCardPress}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragMove={onDragMove}
                />
              );
            }
            // Default to rendering a loose card - fixed key generation with fallback
            const looseCard = item as LooseCardType;
            const safeRank = looseCard.rank || 'Unknown';
            const safeSuit = looseCard.suit || 'Unknown';
            return (
              <LooseCard
                key={`loose-card-${index}-${safeRank}-${safeSuit}`}
                card={looseCard}
                onDropOnCard={memoizedOnDropOnCard}
                currentPlayer={currentPlayer}
                onCardPress={onCardPress}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragMove={onDragMove}
              />
            );
          })
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tableCards: {
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    padding: 10,
    flex: 1,
  },
  cardsContainer: {
    flex: 1,
    minHeight: 180,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    flexWrap: 'wrap',
  },
  emptyTable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
    minWidth: 200,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontStyle: 'italic',
  },
  build: {
    position: 'relative',
    margin: 8,
  },
  buildOwnerTag: {
    position: 'absolute',
    top: -5,
    left: -5,
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  buildOwnerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cancelStackButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#F44336',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cancelStackText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  confirmStackButton: {
    position: 'absolute',
    top: -10,
    left: -10,
    backgroundColor: '#4CAF50',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  confirmStackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tempStackIndicator: {
    position: 'absolute',
    bottom: -15,
    left: 0,
    right: 0,
    backgroundColor: '#9C27B0',
    borderRadius: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  tempStackText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  looseCardContainer: {
    margin: 4,
  },
});

export default memo(TableCards);
