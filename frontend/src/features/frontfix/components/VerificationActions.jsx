export default function VerificationActions({ actions, onVerify }) {
  if (!Array.isArray(actions) || actions.length === 0) return null;

  return (
    <div className="verification-actions-container" role="group" aria-label="Solution Verification">
      <div className="verification-label">Did this resolve your issue?</div>
      <div className="verification-btn-group">
        {actions.includes('verify_solved') && (
          <button
            className="verification-btn verify-solved-btn"
            onClick={() => onVerify?.('verify_solved')}
            title="Confirm this solution resolved your issue"
          >
            <span className="verify-icon">✅</span>
            <span>Yes, it worked</span>
          </button>
        )}
        {actions.includes('verify_broken') && (
          <button
            className="verification-btn verify-broken-btn"
            onClick={() => onVerify?.('verify_broken')}
            title="Troubleshoot further if the fix did not work"
          >
            <span className="verify-icon">❌</span>
            <span>No, the problem remains</span>
          </button>
        )}
        {actions.includes('verify_partial') && (
          <button
            className="verification-btn verify-partial-btn"
            onClick={() => onVerify?.('verify_partial')}
            title="Report that part of the issue is resolved"
          >
            <span className="verify-icon">⚠️</span>
            <span>It fixed part of the problem</span>
          </button>
        )}
        {actions.includes('verify_different_error') && (
          <button
            className="verification-btn verify-diff-btn"
            onClick={() => onVerify?.('verify_different_error')}
            title="Report a different error that appeared"
          >
            <span className="verify-icon">🔄</span>
            <span>I got a different error</span>
          </button>
        )}
        {actions.includes('verify_need_help') && (
          <button
            className="verification-btn verify-help-btn"
            onClick={() => onVerify?.('verify_need_help')}
            title="Request beginner-friendly help applying this fix"
          >
            <span className="verify-icon">❓</span>
            <span>I need help applying the fix</span>
          </button>
        )}
      </div>
    </div>
  );
}
