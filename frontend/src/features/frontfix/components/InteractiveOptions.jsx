export default function InteractiveOptions({
  options,
  stepLabel,
  canSkip,
  onSelectOption,
  onSkip,
  onGoBack,
  onRestart,
}) {
  if (!Array.isArray(options) || options.length === 0) return null;

  return (
    <div className="interactive-options-container" role="group" aria-label="Quick Select Diagnostic Options">
      <div className="interactive-options-header">
        <span className="interactive-options-label">Select one of these to continue:</span>
        {stepLabel && <span className="interactive-step-pill">{stepLabel}</span>}
      </div>

      <div className="interactive-options-grid">
        {options.map((opt, idx) => (
          <button
            key={idx}
            className="interactive-option-chip"
            onClick={() => onSelectOption?.(opt)}
            title={`Select: ${opt}`}
          >
            <span className="chip-bullet">•</span>
            <span className="chip-text">{opt}</span>
          </button>
        ))}
      </div>

      <div className="interactive-footer-row">
        {canSkip && (
          <button
            className="interactive-skip-btn"
            onClick={() => onSkip?.()}
            title="Skip questions and request best guess solution"
          >
            Skip questions & show best guess →
          </button>
        )}
        <div className="interactive-nav-group">
          {onGoBack && (
            <button
              className="interactive-nav-btn"
              onClick={() => onGoBack?.()}
              title="Change your previous answer"
            >
              ← Change previous answer
            </button>
          )}
          {onRestart && (
            <button
              className="interactive-nav-btn restart-nav-btn"
              onClick={() => onRestart?.()}
              title="Restart diagnosis from the beginning"
            >
              ↺ Restart diagnosis
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
