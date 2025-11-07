import { useState, useCallback } from 'react';
import { ModalInfo, ActionOption, ModalManagerReturn } from '../types/gameTypes';

/**
 * Modal Management Hook
 * Extracted from useGameActions.js to handle all modal-related state and actions
 * Manages decision dialogs that appear when players have multiple action choices
 * Now fully typed for TypeScript safety
 */
export const useModalManager = (): ModalManagerReturn => {
  const [modalInfo, setModalInfo] = useState<ModalInfo | null>(null);

  const handleModalAction = useCallback((action: ActionOption, executeActionCallback?: (action: ActionOption) => void): void => {
    if (executeActionCallback && action) {
      executeActionCallback(action);
    }
    setModalInfo(null);
  }, []);

  const showModal = useCallback((modalData: ModalInfo): void => {
    setModalInfo(modalData);
  }, []);

  const closeModal = useCallback((): void => {
    setModalInfo(null);
  }, []);

  return {
    modalInfo,
    setModalInfo,
    handleModalAction,
    showModal,
    closeModal
  };
};