import { StarIcon, DocIcon } from './Icons.jsx';

export default function Header({ online, onToggleSidebar, onNewChat, onClose }) {
  return (
    <header className="top-header">
      <div className="header-left">
        <button className="hamburger-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div className="header-logo-icon">
          <StarIcon />
        </div>

        <div className="header-titles">
          <div className="header-title-row">
            <span className="header-title">FrontFix AI</span>
          </div>
          <span className="header-subtitle">Technical Issue Resolution &amp; Diagnostics</span>
        </div>
      </div>

      <div className="header-right">
        <div className={`status-pill-offline${online ? ' online' : ''}`} id="status-pill">
          <span className="status-indicator-dot"></span>
          <span id="status-text">{online ? 'Connected' : 'Offline Mode'}</span>
        </div>

        <div className="pill-badge-white" title="Verified local frontend diagnostics knowledge base active">
          <DocIcon />
          <span>Local Fallback</span>
        </div>

        <button className="btn-new-chat" onClick={onNewChat} title="Start new diagnosis">
          + New Chat
        </button>

        {onClose && (
          <button
            className="frontfix-close-btn"
            onClick={onClose}
            aria-label="Close chatbot"
            title="Close chatbot"
          >
            ✕
          </button>
        )}
      </div>
    </header>
  );
}
