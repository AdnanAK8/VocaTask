import { useEffect, useState } from 'react';

export default function TypingIndicator({ statuses }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!statuses || statuses.length < 2) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % statuses.length), 850);
    return () => clearInterval(id);
  }, [statuses]);

  const currentIndex = statuses && statuses.length > 0 ? i % statuses.length : 0;

  return (
    <div className="typing-indicator-bubble" id="active-typing-indicator">
      <div className="typing-header">
        <span className="bot-avatar-mini">🤖</span>
        <span className="typing-status-text">{statuses ? statuses[currentIndex] : ''}</span>
      </div>
      <div className="typing-dots">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
    </div>
  );
}
