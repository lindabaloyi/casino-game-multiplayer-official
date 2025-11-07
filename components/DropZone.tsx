import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { DraggedItem } from '../types/gameTypes';

interface DropData {
  layout?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  [key: string]: any;
}

interface DropPosition {
  x: number;
  y: number;
  handled: boolean;
}

interface DropZoneProps {
  children: React.ReactNode;
  onDropAccepted: (draggedCard: DraggedItem, dropData: DropData, dropPosition: DropPosition) => void;
  style?: ViewStyle;
  dropData?: DropData;
  isValidTarget?: (draggedCard: DraggedItem, dropData?: DropData) => boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ 
  children, 
  onDropAccepted,
  style,
  dropData,
  isValidTarget = () => true 
}) => {
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleDrop = (draggedCard: DraggedItem, dropPosition: DropPosition): void => {
    if (isValidTarget(draggedCard, dropData)) {
      onDropAccepted(draggedCard, dropData || {}, dropPosition);
    }
  };

  return (
    <View 
      style={[
        style, 
        isHovered && styles.highlighted
      ]}
      onLayout={(event) => {
        // Store layout info for drop zone detection
        const { x, y, width, height } = event.nativeEvent.layout;
        if (dropData) {
          dropData.layout = { x, y, width, height };
        }
      }}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  highlighted: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
});

export default DropZone;