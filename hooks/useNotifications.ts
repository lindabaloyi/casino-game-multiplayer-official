import { getErrorInfo } from '../utils/errorMapping';
import { NotificationFunctions, ErrorModalState, ErrorInfo } from '../types/gameTypes';

/**
 * Mobile notification functions using custom ErrorModal
 * Extracted from useGameActions.js for better reusability and organization
 * Now fully typed for TypeScript safety
 */
export const useNotifications = (setErrorModal: (modal: ErrorModalState) => void): NotificationFunctions => ({
  showError: (message: string): void => {
    const errorInfo: ErrorInfo = getErrorInfo(message);
    setErrorModal({
      visible: true,
      title: errorInfo.title,
      message: errorInfo.message,
    });
  },
  showWarning: (message: string): void => {
    setErrorModal({
      visible: true,
      title: 'Notice',
      message: message,
    });
  },
  showInfo: (message: string, autoDismissMs?: number): void => {
    const dismissTime = autoDismissMs || (message.includes('Round') ? 3000 : undefined);

    setErrorModal({
      visible: true,
      title: 'Game Info',
      message: message,
      autoDismissMs: dismissTime,
    });
  },
});