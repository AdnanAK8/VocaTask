import { useEffect } from 'react';
import FrontFixApp from '../App.jsx';
import './FrontFixDrawer.css';
import type { CapturedError } from '../../../shared/services/errorTelemetry';

interface FrontFixDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialError?: CapturedError | null;
}

export const FrontFixDrawer = ({ isOpen, onClose, initialError }: FrontFixDrawerProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="frontfix-drawer-container">
      <div
        className="frontfix-drawer-backdrop"
        onClick={onClose}
        aria-label="Close FrontFix Chatbot"
      />
      <aside
        className="frontfix-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="FrontFix AI Diagnostic Chatbot"
      >
        <FrontFixApp onClose={onClose} isDrawer={true} initialError={initialError} />
      </aside>
    </div>
  );
};
