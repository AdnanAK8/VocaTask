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
            <span>This solved my problem</span>
          </button>
        )}
        {actions.includes('verify_broken') && (
          <button
            className="verification-btn verify-broken-btn"
            onClick={() => onVerify?.('verify_broken')}
            title="Troubleshoot further if the fix did not work"
          >
            <span className="verify-icon">❌</span>
            <span>Still not working — troubleshoot further</span>
          </button>
        )}
      </div>
    </div>
  );
}
