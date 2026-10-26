import { BotIcon } from './Icons.jsx';
import SuggestionCard from './SuggestionCard.jsx';
import { SUGGESTIONS } from '../data/presets.js';

export default function HeroView({ onPreset, activeError, onDiagnoseError, onDismissError }) {
  return (
    <div className="hero-view" id="hero-view">
      <div className="hero-avatar">
        <BotIcon />
      </div>

      <h1 className="hero-main-title">FrontendFix AI</h1>

      <p className="hero-description">
        Share any frontend error or tell me what feels broken. I’ll diagnose the root cause and provide
        a clear, copyable code fix in real time.
      </p>

      {activeError && (
        <div className="live-error-hero-card" role="alert">
          <div className="live-error-badge-row">
            <span className="live-error-pulse-dot" />
            <span className="live-error-badge-text">LIVE ISSUE INTERCEPTED</span>
            <span className="live-error-source-tag">{activeError.source || 'runtime'}</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#991b1b', opacity: 0.8 }}>
              {activeError.timestamp}
            </span>
          </div>
          <div className="live-error-message">{activeError.message}</div>
          {activeError.filename && (
            <div className="live-error-meta">
              📍 {activeError.filename}{activeError.lineno ? `:${activeError.lineno}` : ''}
            </div>
          )}
          <div className="live-error-actions">
            <button
              className="live-error-diagnose-btn"
              onClick={() => onDiagnoseError?.(activeError)}
              title="Diagnose this intercepted error with AI"
            >
              ⚡ Diagnose with AI Fix
            </button>
            {onDismissError && (
              <button
                className="live-error-dismiss-btn"
                onClick={onDismissError}
                title="Dismiss this error notification"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      <div className="hero-section-label">OR TRY ONE OF THESE REAL FRONTEND ISSUES:</div>

      <div className="suggestions-grid">
        {SUGGESTIONS.map((s) => (
          <SuggestionCard key={s.key} suggestion={s} onClick={onPreset} />
        ))}
      </div>
    </div>
  );
}
