import { BotIcon } from './Icons.jsx';
import SuggestionCard from './SuggestionCard.jsx';
import { SUGGESTIONS } from '../data/presets.js';

const SUPPORT_CATEGORIES = [
  { id: 'website_down', label: 'Website not working', icon: '🌐', query: 'Website not working' },
  { id: 'react_error', label: 'JavaScript or React error', icon: '⚡', query: 'JavaScript or React error' },
  { id: 'api_backend', label: 'API or backend problem', icon: '🔌', query: 'API or backend problem' },
  { id: 'styling_ui', label: 'Styling or UI issue', icon: '🎨', query: 'Styling or UI issue' },
  { id: 'build_deploy', label: 'Build or deployment failure', icon: '🚀', query: 'Build or deployment failure' },
  { id: 'database', label: 'Database or connection issue', icon: '🗄️', query: 'Database or connection issue' },
  { id: 'other', label: 'Something else', icon: '❓', query: 'Something else' },
];

export default function HeroView({
  onPreset,
  onSelectCategory,
  activeError,
  onDiagnoseError,
  onDismissError,
}) {
  const handleCategoryClick = (query) => {
    if (onSelectCategory) {
      onSelectCategory(query);
    } else if (onPreset) {
      onPreset(query);
    }
  };

  return (
    <div className="hero-view" id="hero-view">
      <div className="hero-avatar">
        <BotIcon />
      </div>

      <h1 className="hero-main-title">FrontFix AI Support</h1>

      <p className="hero-description">
        Hi! I'm here to help you fix your technical problems. Let's understand what's happening and
        solve it together.
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

      <div className="hero-section-label">WHAT DO YOU NEED HELP WITH TODAY?</div>

      <div className="support-categories-grid" role="group" aria-label="Support Problem Categories">
        {SUPPORT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className="support-category-card"
            onClick={() => handleCategoryClick(cat.query)}
            title={`Start troubleshooting: ${cat.label}`}
          >
            <span className="support-category-icon">{cat.icon}</span>
            <span className="support-category-label">{cat.label}</span>
            <span className="support-category-arrow">→</span>
          </button>
        ))}
      </div>

      <div className="hero-section-label" style={{ marginTop: '24px' }}>
        OR EXPLORE COMMON VERIFIED PRESETS:
      </div>

      <div className="suggestions-grid">
        {SUGGESTIONS.map((s) => (
          <SuggestionCard key={s.key} suggestion={s} onClick={onPreset} />
        ))}
      </div>
    </div>
  );
}
