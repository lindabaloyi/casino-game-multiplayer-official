/**
 * Core Type Definitions for Casino Card Game
 * Phase 1 of TypeScript Conversion
 */

// ===== BASIC GAME ENTITIES =====

export interface Card {
  rank: string;
  suit: string;
  source?: 'hand' | 'table' | 'captured' | 'opponentCapture' | 'temporary_stack';
}

export interface Build {
  type: 'build';
  buildId: string;
  value: number;
  cards: Card[];
  owner: number;
  isExtendable: boolean;
}

export interface TemporaryStack {
  type: 'temporary_stack';
  stackId: string;
  cards: Card[];
  owner: number;
  targetBuildId?: string; // For staging stacks targeting opponent's builds
}

export type TableEntity = Card | Build | TemporaryStack;

// ===== GAME STATE =====

export interface GameState {
  currentPlayer: number;
  playerHands: Card[][];
  tableCards: TableEntity[];
  playerCaptures: Card[][][]; // Array of players, each with array of capture groups
  deck: Card[];
  round: number;
  gameOver: boolean;
  scores?: number[];
  scoreDetails?: any; // For end game score breakdown
  lastCapturer: number | null;
  winner?: number;
}

// ===== DRAG & DROP TYPES =====

export interface DraggedItem {
  card?: Card;
  stack?: TemporaryStack;
  source: 'hand' | 'table' | 'captured' | 'opponentCapture' | 'temporary_stack';
  player: number;
  stackId?: string;
}

export interface TargetInfo {
  type: 'loose' | 'build' | 'temporary_stack';
  cardId?: string;
  buildId?: string;
  stackId?: string;
  rank?: string;
  suit?: string;
}

// ===== ACTION SYSTEM =====

export interface ActionPayload {
  draggedItem: DraggedItem;
  targetCard?: TableEntity;
  buildValue?: number;
  biggerCard?: Card;
  smallerCard?: Card;
  baseCard?: Card;
  otherCardsInBuild?: Card[];
  buildToAddTo?: Build;
  opponentBuild?: Build;
  ownBuild?: Build;
  stackToBuildFrom?: TemporaryStack;
  stack?: TemporaryStack;
  targetBuild?: Build;
  card?: Card;
  currentPlayer?: number;
}

export interface ActionOption {
  type: string;
  label: string;
  payload: ActionPayload;
}

// ===== MODAL TYPES =====

export interface ModalInfo {
  type?: string;
  title: string;
  message: string;
  card?: Card;
  currentPlayer?: number;
  actions: ActionOption[];
}

export interface ErrorModalState {
  visible: boolean;
  title: string;
  message: string;
  autoDismissMs?: number;
}

// ===== VALIDATION TYPES =====

export interface ValidationResult {
  valid: boolean;
  message?: string;
  newValue?: number;
}

export interface ComboSortingValidation {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

// ===== NOTIFICATION TYPES =====

export interface NotificationFunctions {
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string, autoDismissMs?: number) => void;
}

export interface ErrorInfo {
  title: string;
  message: string;
}

// ===== HOOK RETURN TYPES =====

export interface ModalManagerReturn {
  modalInfo: ModalInfo | null;
  setModalInfo: (modalInfo: ModalInfo | null) => void;
  handleModalAction: (action: ActionOption, executeActionCallback?: (action: ActionOption) => void) => void;
  showModal: (modalData: ModalInfo) => void;
  closeModal: () => void;
}

export interface GameActionsReturn {
  gameState: GameState;
  modalInfo: ModalInfo | null;
  errorModal: ErrorModalState;
  handleTrailCard: (card: Card, player: number, dropPosition?: any) => void;
  handleDropOnCard: (draggedItem: DraggedItem, targetInfo: TargetInfo) => void;
  handleModalAction: (action: ActionOption) => void;
  setModalInfo: (modalInfo: ModalInfo | null) => void;
  executeAction: (currentGameState: GameState, action: ActionOption) => GameState;
  handleCancelStagingStackAction: (stack: TemporaryStack) => void;
  handleStageOpponentCardAction: (item: { card: Card; player: number }) => void;
  handleConfirmStagingStackAction: (stack: TemporaryStack) => void;
  closeErrorModal: () => void;
}

// ===== UTILITY TYPES =====

export type PlayerIndex = 0 | 1;

export type CardRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type CardSuit = '♠' | '♥' | '♦' | '♣';

export type ActionType = 
  | 'capture'
  | 'build'
  | 'baseBuild'
  | 'addToOpponentBuild'
  | 'addToOwnBuild'
  | 'createBuildFromStack'
  | 'extendToMerge'
  | 'createBuildWithValue'
  | 'end_game';

// ===== HANDLER FUNCTION TYPES =====

export type TableCardDropHandler = (
  draggedItem: DraggedItem,
  targetInfo: TargetInfo,
  currentGameState: GameState,
  showError: (message: string) => void
) => GameState;

export type HandCardDropHandler = (
  draggedItem: DraggedItem,
  targetInfo: TargetInfo,
  currentGameState: GameState,
  showError: (message: string) => void,
  setModalInfo: (modalInfo: ModalInfo | null) => void,
  executeAction: (gameState: GameState, action: ActionOption) => GameState,
  createActionOption: (type: string, label: string, payload: ActionPayload) => ActionOption,
  generatePossibleActions: (
    draggedItem: DraggedItem,
    looseCard: Card,
    playerHand: Card[],
    tableCards: TableEntity[],
    playerCaptures: Card[][][],
    currentPlayer: number
  ) => ActionOption[]
) => GameState;

export type TemporaryStackDropHandler = (
  draggedItem: DraggedItem,
  targetInfo: TargetInfo,
  currentGameState: GameState,
  showError: (message: string) => void
) => GameState;