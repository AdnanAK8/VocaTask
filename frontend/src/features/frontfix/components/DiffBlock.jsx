import { useState } from 'react';

export default function DiffBlock({ fileHint, note, before, after, onCopy }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(after);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.('Code fix copied to clipboard!');
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.('Code copied!');
    }
  }

  return (
    <div className="diff-container">
      <div className="diff-header">
        <span className="diff-file-hint">{fileHint || 'Code Fix'}</span>
        <button
          className={`copy-btn ${copied ? 'is-copied' : ''}`}
          onClick={copy}
          title="Copy fixed code snippet to clipboard"
          aria-label="Copy fix code"
        >
          {copied ? '✓ Copied' : 'Copy Fix'}
        </button>
      </div>
      {note && <div className="code-context-note">{note}</div>}
      <div className="diff-body">
        <div className="diff-line-del">{before}</div>
        <div className="diff-line-add">{after}</div>
      </div>
    </div>
  );
}
