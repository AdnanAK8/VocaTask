import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent, KeyboardEvent } from 'react';
import { Camera, MessageCircle, Paperclip, X } from 'lucide-react';
import { api } from '../services/api';
import type { ChatMessage } from '../types/chat';
import './ChatWidget.css';

const MAX_FILES = 5;
const MAX_MB = 10;
const MAX_HISTORY = 10;
const ACCEPT = 'image/png,image/jpeg,image/webp,.txt,.log,.json,.js,.jsx,.ts,.tsx,.css,.scss,.html,.vue,.svelte';

const GREETING = 'Describe the frontend bug. Attach the file, the console error, or a screenshot of what is broken.';

function renderText(text: string) {
  // Split on ``` fences: odd indexes are code blocks.
  return text.split('```').map((part, i) => {
    if (i % 2 === 1) {
      const code = part.replace(/^[a-zA-Z0-9]*\n/, '');
      return <pre key={i} className="cw-code">{code.trimEnd()}</pre>;
    }
    return part ? <div key={i} className="cw-text">{part}</div> : null;
  });
}

function Thumb({ file, onRemove }: { file: File; onRemove?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  // FileReader (not object URLs): nothing to revoke, and safe under StrictMode's double effect run.
  useEffect(() => {
    if (!file.type.startsWith('image/')) return;
    let active = true;
    const reader = new FileReader();
    reader.onload = () => { if (active) setUrl(reader.result as string); };
    reader.readAsDataURL(file);
    return () => { active = false; };
  }, [file]);

  return (
    <div className="cw-thumb" title={file.name}>
      {url ? <img src={url} alt="" /> : <div className="cw-fi">{(file.name.split('.').pop() || 'file').slice(0, 4)}</div>}
      <span className="cw-thumb-name">{file.name}</span>
      {onRemove && <button className="cw-x" onClick={onRemove} aria-label={`Remove ${file.name}`}><X size={14} /></button>}
    </div>
  );
}

export const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canCapture = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, busy, open]);

  const addFiles = (list: FileList | File[] | null) => {
    setError('');
    const incoming = Array.from(list ?? []);
    const tooBig = incoming.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`${tooBig.name} is over ${MAX_MB} MB.`);
      return;
    }
    if (files.length + incoming.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} attachments per message.`);
      return;
    }
    setFiles((prev) => [...prev, ...incoming]);
  };

  const captureScreenshot = async () => {
    setError('');
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 250)); // let the first frame render
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) addFiles([new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' })]);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'NotAllowedError')) {
        setError('Screenshot failed. Upload an image instead.');
      }
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(event.clipboardData.files).filter((f) => f.type.startsWith('image/'));
    if (images.length) {
      event.preventDefault();
      addFiles(images);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDrag(false);
    addFiles(event.dataTransfer.files);
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && files.length === 0) || busy) return;
    const history = messages
      .filter((m) => m.text.trim())
      .slice(-MAX_HISTORY)
      .map(({ role, text: t }) => ({ role, text: t }));
    const sentFiles = files;

    setInput('');
    setFiles([]);
    setError('');
    setMessages((prev) => [...prev, { role: 'user', text, files: sentFiles }]);
    setBusy(true);
    try {
      const reply = await api.sendChatMessage(text, sentFiles, history);
      setMessages((prev) => [...prev, { role: 'bot', text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: err instanceof Error ? err.message : 'Request failed. Try again.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div className="cw-root">
      {open && (
        <section
          className={`cw-panel${drag ? ' cw-drag' : ''}`}
          role="dialog"
          aria-label="Frontend fixer chat"
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <header className="cw-head">
            <div>
              <div className="cw-title">Frontend fixer</div>
              <div className="cw-sub">Attach code, errors or a screenshot</div>
            </div>
            <button className="cw-icon" onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button>
          </header>

          <div className="cw-body" ref={bodyRef} aria-live="polite">
            <div className="cw-msg cw-bot"><div className="cw-text">{GREETING}</div></div>
            {messages.map((m, i) => (
              <div key={i} className={`cw-msg ${m.role === 'user' ? 'cw-user' : 'cw-bot'}`}>
                {renderText(m.text)}
                {m.files && m.files.length > 0 && (
                  <div className="cw-thumbs">{m.files.map((f, j) => <Thumb key={j} file={f} />)}</div>
                )}
              </div>
            ))}
            {busy && <div className="cw-msg cw-bot cw-typing">Analyzing…</div>}
          </div>

          {error && <div className="cw-err" role="alert">{error}</div>}
          {files.length > 0 && (
            <div className="cw-tray">
              {files.map((f, i) => (
                <Thumb key={`${f.name}-${i}`} file={f} onRemove={() => setFiles((prev) => prev.filter((_, k) => k !== i))} />
              ))}
            </div>
          )}

          <div className="cw-foot">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
            <button className="cw-icon" onClick={() => fileRef.current?.click()} aria-label="Attach files" title="Attach files">
              <Paperclip size={19} />
            </button>
            {canCapture && (
              <button className="cw-icon" onClick={() => void captureScreenshot()} aria-label="Capture screenshot" title="Capture screenshot">
                <Camera size={19} />
              </button>
            )}
            <textarea
              className="cw-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={onPaste}
              onKeyDown={onKeyDown}
              placeholder="Describe the issue"
              aria-label="Message"
            />
            <button className="cw-send" onClick={() => void send()} disabled={(!input.trim() && files.length === 0) || busy}>Send</button>
          </div>
        </section>
      )}

      <button className="cw-fab" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close chat' : 'Open chat'} aria-expanded={open}>
        <MessageCircle size={26} />
      </button>
    </div>
  );
};

export default ChatWidget;