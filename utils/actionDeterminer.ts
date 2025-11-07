
import {
    GameState,
    DraggedItem,
    TargetInfo,
    ActionOption,
    ModalInfo,
  } from '../types/gameTypes';
  import {
    handleHandCardDrop,
  } from '../handlers/handleHandCardDrop';
  import {
    handleTableCardDrop,
  } from '../handlers/handleTableCardDrop';
  import {
    handleTemporaryStackDrop,
  } from '../handlers/handleTemporaryStackDrop';
  
  /**
   * Enhanced action determiner for multiplayer support.
   * Determines all possible game actions based on a drag-and-drop operation.
   * Returns either a single action, multiple actions, or null if invalid.
   */
  export const determineActions = (
    draggedItem: DraggedItem,
    targetInfo: TargetInfo,
    gameState: GameState,
  ): {
    actions: ActionOption[];
    requiresModal: boolean;
    errorMessage?: string;
  } => {
    let capturedActions: ActionOption[] = [];
    let modalInfo: ModalInfo | null = null;
    let errorMessage = '';

    // Mock functions to capture actions and modal info
    const mockSetModalInfo = (info: ModalInfo | null) => {
      modalInfo = info;
      if (info && info.actions) {
        capturedActions = [...info.actions];
      }
    };
  
    const mockExecuteAction = (
      currentGameState: GameState,
      action: ActionOption,
    ): GameState => {
      // For immediate execution, add to actions list
      capturedActions = [action];
      return currentGameState;
    };
  
    const mockShowError = (message: string) => {
      errorMessage = message;
      console.log(`Action determination error: ${message}`);
    };
  
    const mockCreateActionOption = (type: string, label: string, payload: any): ActionOption => ({
        type,
        label,
        payload,
    });
  
    const mockGeneratePossibleActions = () => [];

    // Clear previous state
    capturedActions = [];
    modalInfo = null;
    errorMessage = '';

    // Validate inputs
    if (!draggedItem || !draggedItem.source) {
      errorMessage = 'Invalid dragged item: missing source information';
      return {
        actions: [],
        requiresModal: false,
        errorMessage
      };
    }

    if (!gameState || !gameState.currentPlayer) {
      errorMessage = 'Invalid game state';
      return {
        actions: [],
        requiresModal: false,
        errorMessage
      };
    }

    try {
      // Route to the appropriate handler based on the source of the dragged item
      if (draggedItem.source === 'hand') {
        handleHandCardDrop(
          draggedItem,
          targetInfo,
          gameState,
          mockShowError,
          mockSetModalInfo,
          mockExecuteAction,
          mockCreateActionOption,
          mockGeneratePossibleActions,
        );
      } else if (draggedItem.source === 'table' || draggedItem.source === 'opponentCapture' || draggedItem.source === 'captured') {
        handleTableCardDrop(
          draggedItem,
          targetInfo,
          gameState,
          mockShowError
        );
      } else if (draggedItem.source === 'temporary_stack') {
        handleTemporaryStackDrop(
          draggedItem,
          targetInfo,
          gameState,
          mockShowError
        );
      } else {
        errorMessage = `Drag source '${draggedItem.source}' not supported in multiplayer.`;
      }
    } catch (error) {
      errorMessage = `Action determination failed: ${(error as Error).message || 'Unknown error'}`;
      console.error('Action determination error:', error);
    }
  
    return {
      actions: capturedActions,
      requiresModal: modalInfo !== null && capturedActions.length > 1,
      errorMessage: errorMessage || undefined
    };
  };

  /**
   * Legacy function for backward compatibility
   * Returns single action (first available) or null
   */
  export const determineAction = (
    draggedItem: DraggedItem,
    targetInfo: TargetInfo,
    gameState: GameState,
  ): ActionOption | null => {
    const result = determineActions(draggedItem, targetInfo, gameState);
    return result.actions.length > 0 ? result.actions[0] : null;
  };
