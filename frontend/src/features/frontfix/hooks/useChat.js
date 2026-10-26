import { useCallback, useRef, useState } from 'react';
import { BACKEND_URL } from '../config.js';
import { PRESET_SAMPLES } from '../data/presets.js';
import { sanitizeClientSide } from '../utils/sanitize.js';
import { matchOfflineKnowledge, analyzeLog } from '../utils/diagnose.js';
import { matchConversationalMessage } from '../utils/conversation.js';

const TYPING_DELAY_MS = 1000;
const MAX_SESSIONS = 12;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const TYPING_STATUSES = [
  'Searching knowledge base and possible causes...',
  'Evaluating diagnostic match...',
  'Preparing step-by-step guidance...',
];
const CONVERSATION_TYPING_STATUSES = ['Putting together a reply...'];

const INITIAL_SESSIONS = [
  {
    id: 'sample-cors',
    title: 'CORS policy blocked: No...',
    date: 'Oct 19',
    query: "CORS policy blocked: No 'Access-Control-Allow-Origin' header present",
    presetKey: 'cors_policy_blocked',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let idCounter = 0;
const nextId = () => `m-${Date.now()}-${idCounter++}`;

export default function useChat({ online, showToast, onReset }) {
  const [messages, setMessages] = useState([]);
  const [typingStatuses, setTypingStatuses] = useState(null);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [privacy, setPrivacy] = useState(true);
  const [focusSignal, setFocusSignal] = useState(0);
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState(INITIAL_SESSIONS[0].id);

  // Diagnostic state machine & multilingual support state
  const [currentState, setCurrentState] = useState('UNDERSTAND_PROBLEM');
  const [caseSummary, setCaseSummary] = useState(null);
  const [language, setLanguage] = useState('auto');

  // Sent to the backend with each query; a ref because it doesn't affect rendering.
  const historyRef = useRef([]);

  const chatStarted = messages.length > 0 || typingStatuses !== null;

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: nextId(), ...msg }]);
  }, []);

  function addHistoryEntry(titleSource, query) {
    const title = titleSource.length > 22 ? `${titleSource.slice(0, 22)}...` : titleSource;
    const session = {
      id: `session-${Date.now()}`,
      title,
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      query,
      presetKey: null,
    };
    setSessions((prev) => [session, ...prev].slice(0, MAX_SESSIONS));
    setActiveSessionId(session.id);
  }

  const send = useCallback(
    async (textOverride, options = {}) => {
      if (sending) return;

      let query = (typeof textOverride === 'string' ? textOverride : input).trim();
      if (!query) return;
      if (privacy) query = sanitizeClientSide(query);

      addMessage({ type: 'user', text: query });
      historyRef.current.push({ role: 'user', content: query });
      addHistoryEntry(query.split('\n')[0], query);

      setInput('');
      setSending(true);

      const conversationalReply =
        currentState === 'UNDERSTAND_PROBLEM' && !options.action
          ? matchConversationalMessage(query)
          : null;

      setTypingStatuses(conversationalReply ? CONVERSATION_TYPING_STATUSES : TYPING_STATUSES);

      try {
        await sleep(TYPING_DELAY_MS);

        let result = null;
        if (conversationalReply) {
          result = conversationalReply;
        } else if (online) {
          try {
            const baseUrl = BACKEND_URL || '';
            const res = await fetch(`${baseUrl}/api/diagnose`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query,
                enable_privacy: privacy,
                conversation_history: historyRef.current,
                state: currentState,
                case_summary: caseSummary,
                language: language,
                action: options.action || null,
              }),
            });
            if (res.ok) {
              const body = await res.json();
              result = body.data;
              if (result?.case_summary) {
                setCaseSummary(result.case_summary);
              }
              if (result?.state) {
                setCurrentState(result.state);
              }
            }
          } catch (e) {
            console.warn('Backend call failed, using offline KB:', e);
          }
        }

        if (!result) result = matchOfflineKnowledge(query);

        setTypingStatuses(null);
        addMessage({ type: 'bot', data: result });
        historyRef.current.push({ role: 'assistant', content: result.title || result.problem });
      } catch {
        setTypingStatuses(null);
        addMessage({ type: 'bot', data: matchOfflineKnowledge(query) });
      } finally {
        setSending(false);
      }
    },
    [sending, input, privacy, addMessage, currentState, caseSummary, language, online]
  );

  const selectOption = useCallback(
    (optionText) => {
      send(optionText);
    },
    [send]
  );

  const skipQuestions = useCallback(() => {
    send('Please provide a preliminary diagnosis based on what we have discussed so far.', {
      action: 'skip_questions',
    });
  }, [send]);

  const verifySolution = useCallback(
    (actionType) => {
      const actionTexts = {
        verify_solved: 'Yes, it worked! Issue resolved.',
        verify_broken: 'No, the problem remains.',
        verify_partial: 'It fixed part of the problem.',
        verify_different_error: 'I got a different error after applying the fix.',
        verify_need_help: 'I need help applying the fix.',
      };
      const text = actionTexts[actionType] || 'Verification status update.';
      send(text, { action: actionType });
    },
    [send]
  );

  const changeLanguage = useCallback(
    (newLang) => {
      setLanguage(newLang);
      const labels = {
        auto: 'Auto Detect',
        en: 'English',
        hi: 'Hindi (हिन्दी)',
        pa: 'Punjabi (ਪੰਜਾਬੀ)',
        hinglish: 'Hinglish',
      };
      showToast?.(`Language set to ${labels[newLang] || newLang}`);
    },
    [showToast]
  );

  const goBack = useCallback(() => {
    setMessages((prev) => {
      if (prev.length <= 2) return prev;
      return prev.slice(0, -2);
    });
    if (historyRef.current.length >= 2) {
      historyRef.current = historyRef.current.slice(0, -2);
    }
    showToast?.('Reverted to previous step.');
  }, [showToast]);

  const newChat = useCallback(() => {
    setMessages([]);
    setTypingStatuses(null);
    setInput('');
    setCurrentState('UNDERSTAND_PROBLEM');
    setCaseSummary(null);
    historyRef.current = [];
    setActiveSessionId(null);
    onReset?.();
    showToast?.('New support session started');
  }, [onReset, showToast]);

  const restartDiagnosis = useCallback(() => {
    newChat();
  }, [newChat]);

  function sendPreset(key) {
    send(PRESET_SAMPLES[key] || key);
  }

  async function upload(file) {
    if (file.size > MAX_FILE_BYTES) {
      alert('File exceeds maximum allowed size of 2MB.');
      return;
    }

    showToast(`Analyzing log file: ${file.name}...`);
    addMessage({
      type: 'user',
      text: `📁 Uploaded log file: ${file.name} (${Math.round(file.size / 1024)} KB)`,
    });
    setTypingStatuses(['Scanning log signatures and stack traces...']);

    const [text] = await Promise.all([file.text(), sleep(TYPING_DELAY_MS)]);

    setTypingStatuses(null);
    addMessage({ type: 'log', filename: file.name, analysis: analyzeLog(text) });
  }

  function selectSession(session) {
    setActiveSessionId(session.id);
    if (session.presetKey) {
      sendPreset(session.presetKey);
    } else if (session.query) {
      setInput(session.query);
      setFocusSignal((n) => n + 1);
    }
  }

  return {
    messages,
    typingStatuses,
    sending,
    input,
    setInput,
    privacy,
    setPrivacy,
    focusSignal,
    sessions,
    activeSessionId,
    chatStarted,
    currentState,
    caseSummary,
    language,
    changeLanguage,
    selectOption,
    skipQuestions,
    verifySolution,
    goBack,
    restartDiagnosis,
    send,
    sendPreset,
    upload,
    newChat,
    selectSession,
  };
}
