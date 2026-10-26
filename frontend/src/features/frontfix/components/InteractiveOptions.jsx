export default function InteractiveOptions({ options, canSkip, onSelectOption, onSkip }) {
  if (!Array.isArray(options) || options.length === 0) return null;

  return (
    <div className="interactive-options-container" role="group" aria-label="Quick Select Diagnostic Options">
      <div className="interactive-options-label">Select one of these to clarify:</div>
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
      {canSkip && (
        <button
          className="interactive-skip-btn"
          onClick={() => onSkip?.()}
          title="Skip questions and request best guess solution"
        >
          Skip questions & show best guess →
        </button>
      )}
    </div>
  );
}
