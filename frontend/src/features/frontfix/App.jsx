import { useEffect, useState } from 'react';
import './styles/index.css';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import HeroView from './components/HeroView.jsx';
import ChatStream from './components/ChatStream.jsx';
import InputDock from './components/InputDock.jsx';
import Toast from './components/Toast.jsx';
import useBackendStatus from './hooks/useBackendStatus.js';
import useToast from './hooks/useToast.js';
import useSidebar from './hooks/useSidebar.js';
import useChat from './hooks/useChat.js';
import { errorTelemetry } from '../../shared/services/errorTelemetry';

function formatErrorForPrompt(err) {
  if (!err) return '';
  const lines = [
    `Frontend Error Intercepted: ${err.message}`,
  ];
  if (err.source) lines.push(`Source: ${err.source}`);
  if (err.filename) lines.push(`Location: ${err.filename}${err.lineno ? `:${err.lineno}` : ''}`);
  if (err.stack) {
    const stackLines = err.stack.split('\n').slice(0, 6).join('\n');
    lines.push(`Stack trace:\n${stackLines}`);
  }
  if (err.componentStack) {
    lines.push(`Component stack:\n${err.componentStack.trim()}`);
  }
  return lines.join('\n');
}

export default function FrontFixApp({ onClose, isDrawer = false, initialError = null }) {
  const online = useBackendStatus();
  const { toast, showToast } = useToast();
  const sidebar = useSidebar();
  const chat = useChat({ online, showToast, onReset: sidebar.closeMobile });

  const [dismissedIds, setDismissedIds] = useState(() => new Set());
  const [capturedErrors, setCapturedErrors] = useState(() => errorTelemetry.getErrors());

  useEffect(() => {
    return errorTelemetry.subscribe((errs) => {
      setCapturedErrors([...errs]);
    });
  }, []);

  const activeError =
    (initialError && !dismissedIds.has(initialError.id) ? initialError : null) ||
    capturedErrors.find((e) => !dismissedIds.has(e.id)) ||
    null;

  const handleDismissError = () => {
    if (activeError?.id) {
      setDismissedIds((prev) => new Set([...prev, activeError.id]));
    }
  };

  const handleDiagnoseError = (err) => {
    const target = err || activeError;
    if (!target) return;
    const prompt = formatErrorForPrompt(target);
    chat.send(prompt);
    if (target.id) {
      setDismissedIds((prev) => new Set([...prev, target.id]));
    }
  };

  return (
    <div className={`frontfix-root ${isDrawer ? 'is-drawer' : ''}`}>
      <div className="app-layout">
        <Sidebar
          sessions={chat.sessions}
          activeId={chat.activeSessionId}
          collapsed={sidebar.collapsed}
          mobileOpen={sidebar.mobileOpen}
          onNewChat={chat.newChat}
          onSelect={chat.selectSession}
        />
        {sidebar.mobileOpen && (
          <button
            className="sidebar-backdrop"
            aria-label="Close conversation history"
            onClick={sidebar.closeMobile}
          />
        )}

        <div className="main-wrapper">
          <Header
            online={online}
            onToggleSidebar={sidebar.toggle}
            onNewChat={chat.newChat}
            onClose={onClose}
            language={chat.language}
            onLanguageChange={chat.changeLanguage}
          />

          {activeError && chat.chatStarted && (
            <div className="chat-live-error-banner" role="status">
              <div className="chat-live-error-info">
                <span className="live-error-pulse-dot" />
                <span className="chat-live-error-text">
                  <strong>New Caught Error:</strong> {activeError.message}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="chat-live-error-btn"
                  onClick={() => handleDiagnoseError(activeError)}
                >
                  ⚡ Diagnose
                </button>
                <button
                  onClick={handleDismissError}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '11px',
                    color: '#991c1c',
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <main className="chat-viewport" id="chat-viewport">
            {chat.chatStarted ? (
              <ChatStream
                messages={chat.messages}
                typingStatuses={chat.typingStatuses}
                onToast={showToast}
                onSelectOption={chat.selectOption}
                onSkipQuestions={chat.skipQuestions}
                onVerifySolution={chat.verifySolution}
                onGoBack={chat.goBack}
                onRestart={chat.restartDiagnosis}
              />
            ) : (
              <HeroView
                onPreset={chat.sendPreset}
                onSelectCategory={chat.send}
                activeError={activeError}
                onDiagnoseError={handleDiagnoseError}
                onDismissError={handleDismissError}
              />
            )}
          </main>

          <InputDock
            value={chat.input}
            onChange={chat.setInput}
            onSend={chat.send}
            onUpload={chat.upload}
            disabled={chat.sending}
            privacy={chat.privacy}
            onPrivacyChange={chat.setPrivacy}
            focusSignal={chat.focusSignal}
          />
        </div>

        <Toast message={toast.message} visible={toast.visible} />
      </div>
    </div>
  );
}
