import React, { memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Card from './card';
import DraggableCard from './DraggableCard';

// Global dropZones interface is declared here
declare global {
  var dropZones: any[] | undefined;
}

type CardStackProps = {
  stackId: string;
  cards: any[];
  onDropStack?: (draggedItem: any) => void;
  buildValue?: number;
  isBuild?: boolean;
  draggable?: boolean;
  onDragStart?: (card: any) => void;
  onDragEnd?: (card: any, position: any) => void;
  onDragMove?: (card: any, position: any) => void;
  currentPlayer?: number;
  dragSource?: 'hand' | 'table' | 'captured' | 'opponentCapture' | 'temporary_stack';
};

const CardStack: React.FC<CardStackProps> = memo(({
  stackId,
  cards,
  onDropStack,
  buildValue,
  isBuild = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragMove,
  currentPlayer = 0,
  dragSource = 'table' as const
}) => {
  // Show only the top card for visual simplicity on mobile
  const topCard = cards[cards.length - 1];
  const cardCount = cards.length;
  const stackRef = useRef<View>(null);

  // Register and cleanup drop zone
  useEffect(() => {
    // Initialize global registry if needed
    if (!global.dropZones) global.dropZones = [];

    // Register immediately with a placeholder zone to ensure drag works even before layout
    const placeholderZone = {
      stackId,
      bounds: { x: 0, y: 0, width: 100, height: 140 }, // Default card dimensions
      onDrop: (draggedItem: any) => {
        console.log(`[DropZone] ${stackId} received drop attempt (placeholder bounds)`);
        if (onDropStack) {
          onDropStack(draggedItem);
          console.log(`[DropZone] ${stackId} handled drop successfully`);
          return true;
        }
        console.log(`[DropZone] ${stackId} no drop handler available`);
        return false;
      }
    };

    // Remove any existing zone with same ID first
    global.dropZones = global.dropZones.filter((zone: any) => zone.stackId !== stackId);
    global.dropZones.push(placeholderZone);
    console.log(`[DropZone] Registered placeholder zone ${stackId}`);

    // Cleanup function to remove this zone
    return () => {
      if (global.dropZones) {
        global.dropZones = global.dropZones.filter((zone: any) => zone.stackId !== stackId);
        console.log(`[DropZone] Cleaned up zone ${stackId}`);
      }
    };
  }, [stackId, onDropStack]);

  const handleLayout = (event: any) => {
    if (onDropStack) {
      const { x, y, width, height } = event.nativeEvent.layout;

      // Get absolute position with retry mechanism for better reliability
      const registerDropZone = () => {
        stackRef.current?.measureInWindow((pageX, pageY) => {
          if (!global.dropZones) global.dropZones = [];

          // Skip registration if position seems invalid
          if (pageX === 0 && pageY === 0) {
            console.log(`[DropZone] Skipping invalid position for ${stackId}`);
            // Retry after a short delay
            setTimeout(registerDropZone, 100);
            return;
          }

          const existingIndex = global.dropZones.findIndex((zone: any) => zone.stackId === stackId);
          const dropZone = {
            stackId,
            // Make drop zones 30% larger for more forgiving mobile detection
            bounds: {
              x: pageX - (width * 0.15),
              y: pageY - (height * 0.15),
              width: width * 1.3,
              height: height * 1.3
            },
            onDrop: (draggedItem: any) => {
              console.log(`[DropZone] ${stackId} received drop attempt`);
              if (onDropStack) {
                onDropStack(draggedItem);
                console.log(`[DropZone] ${stackId} handled drop successfully`);
                return true; // Mark as handled
              }
              console.log(`[DropZone] ${stackId} no drop handler available`);
              return false;
            }
          };

          if (existingIndex >= 0) {
            global.dropZones[existingIndex] = dropZone;
            console.log(`[DropZone] Updated zone ${stackId} at (${pageX}, ${pageY}) size ${width}x${height}`);
          } else {
            global.dropZones.push(dropZone);
            console.log(`[DropZone] Registered new zone ${stackId} at (${pageX}, ${pageY}) size ${width}x${height}`);
          }
        });
      };

      registerDropZone();
    }
  };

  const handlePress = () => {
    if (onDropStack) {
      // Simulate a drop action for mobile touch interface
      onDropStack({ source: 'touch', stackId });
    }
  };

  return (
    <TouchableOpacity
      ref={stackRef}
      style={styles.stackContainer}
      onPress={draggable ? undefined : handlePress}
      onLayout={handleLayout}
      activeOpacity={draggable ? 1.0 : 0.7}
      disabled={draggable}
    >
      {topCard && (
        draggable ? (
          <DraggableCard
            card={topCard}
            size="normal"
            draggable={draggable}
            disabled={false}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragMove={onDragMove}
            currentPlayer={currentPlayer}
            source={dragSource}
            stackId={stackId}
          />
        ) : (
          <Card
            card={topCard}
            size="normal"
            disabled={false}
          />
        )
      )}

      {/* Build value indicator */}
      {isBuild && buildValue !== undefined && (
        <View style={styles.buildValueContainer}>
          <Text style={styles.buildValueText}>{buildValue}</Text>
        </View>
      )}

      {/* Card count indicator for stacks with multiple cards */}
      {cardCount > 1 && (
        <View style={styles.cardCountContainer}>
          <Text style={styles.cardCountText}>{cardCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  stackContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  buildValueContainer: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#B8860B',
  },
  buildValueText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardCountContainer: {
    position: 'absolute',
    bottom: -8,
    left: -8,
    backgroundColor: '#2196F3',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  cardCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default CardStack;
