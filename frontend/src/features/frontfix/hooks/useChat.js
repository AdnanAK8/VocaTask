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
const API_ORIGIN_OPTIONS = ['React application', 'Postman', 'Backend service', 'Not sure'];
const WEBSITE_SYMPTOM_OPTIONS = [
  'The website shows a blank or black screen',
  'The website is loading very slowly',
  'I see an error message on screen',
  'Some buttons or features are not working',
  'The website is completely unavailable',
  'Something else',
  "I'm not sure",
];
const WEBSITE_TIMING_OPTIONS = [
  'Immediately when I open the website',
  'After logging in',
  'After clicking a button',
  'After refreshing the page',
  'It happens randomly',
];
const CONSOLE_OPTIONS = [
  'Yes, I see a red error message',
  'No errors are visible',
  "I don't know how to check",
];

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
  const [apiFlow, setApiFlow] = useState(null);
  const apiProblemRef = useRef('');
  const [websiteFlow, setWebsiteFlow] = useState(null);
  const websiteAnswersRef = useRef([]);

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

      let requestQuery = query;
      let apiQuestionReply = null;
      const normalizedQuery = query.toLowerCase().replace(/[.!?]+$/, '').trim();
      const isWebsiteCategory = ['website not working', 'website down', 'site not working'].includes(
        normalizedQuery
      );
      const mentionsBlankScreen =
        /\b(?:blank|black|white)\s+(?:screen|page)\b|\bscreen\s+is\s+(?:blank|black|white)\b|\bcompletely\s+(?:blank|black|white)\b/.test(
          normalizedQuery
        );
      const hasConcreteError =
        /\b(?:typeerror|referenceerror|syntaxerror|cors|uncaught|econnrefused|404|500|502)\b/.test(
          normalizedQuery
        ) || query.split('\n').length > 2;

      if (
        !options.action &&
        !apiFlow &&
        currentState === 'UNDERSTAND_PROBLEM' &&
        ['api or backend problem', 'api problem', 'backend problem'].includes(normalizedQuery)
      ) {
        apiQuestionReply = { ...matchOfflineKnowledge(query), can_skip: false };
        setApiFlow('problem');
        setCurrentState('COLLECT_CONTEXT');
      } else if (!options.action && apiFlow === 'problem') {
        if (normalizedQuery === 'api request is failing') {
          apiProblemRef.current = query;
          apiQuestionReply = {
            matched: false,
            response_type: 'follow_up_question',
            state: 'COLLECT_CONTEXT',
            title: 'FrontFix AI Support',
            follow_up_question: 'Where are you making the API request from?',
            interactive_options: API_ORIGIN_OPTIONS,
            can_skip: false,
            verification_actions: [],
          };
          setApiFlow('origin');
        } else {
          setApiFlow(null);
        }
      } else if (!options.action && apiFlow === 'origin') {
        requestQuery = [
          'API or backend problem',
          `Problem: ${apiProblemRef.current}`,
          `Request origin: ${query}`,
        ].join('\n');
        apiProblemRef.current = '';
        setApiFlow(null);
      } else if (
        !options.action &&
        !apiFlow &&
        !websiteFlow &&
        currentState === 'UNDERSTAND_PROBLEM' &&
        isWebsiteCategory
      ) {
        apiQuestionReply = {
          ...matchOfflineKnowledge(query),
          interactive_options: WEBSITE_SYMPTOM_OPTIONS,
          can_skip: false,
        };
        setWebsiteFlow('symptom');
      } else if (
        !options.action &&
        !apiFlow &&
        !websiteFlow &&
        currentState === 'UNDERSTAND_PROBLEM' &&
        mentionsBlankScreen &&
        !hasConcreteError
      ) {
        websiteAnswersRef.current = [query];
        apiQuestionReply = {
          matched: false,
          response_type: 'follow_up_question',
          state: 'COLLECT_CONTEXT',
          title: 'FrontFix AI Support',
          greeting: "I understand the page is blank. Let's gather a couple of details before diagnosing it.",
          follow_up_question: 'When does the blank or black screen appear?',
          interactive_options: WEBSITE_TIMING_OPTIONS,
          can_skip: false,
          verification_actions: [],
        };
        setWebsiteFlow('timing');
        setCurrentState('COLLECT_CONTEXT');
      } else if (!options.action && websiteFlow === 'symptom') {
        websiteAnswersRef.current = [query];
        apiQuestionReply = {
          matched: false,
          response_type: 'follow_up_question',
          state: 'COLLECT_CONTEXT',
          title: 'FrontFix AI Support',
          follow_up_question: mentionsBlankScreen
            ? 'When does the blank or black screen appear?'
            : 'When does this problem happen?',
          interactive_options: WEBSITE_TIMING_OPTIONS,
          can_skip: false,
          verification_actions: [],
        };
        setWebsiteFlow('timing');
        setCurrentState('COLLECT_CONTEXT');
      } else if (!options.action && websiteFlow === 'timing') {
        websiteAnswersRef.current.push(query);
        apiQuestionReply = {
          matched: false,
          response_type: 'follow_up_question',
          state: 'COLLECT_CONTEXT',
          title: 'FrontFix AI Support',
          follow_up_question: 'Do you see an error in your browser console (press F12, then choose Console)?',
          interactive_options: CONSOLE_OPTIONS,
          can_skip: false,
          verification_actions: [],
        };
        setWebsiteFlow('console');
      } else if (!options.action && websiteFlow === 'console') {
        websiteAnswersRef.current.push(query);
        requestQuery = [
          'Website not working',
          ...websiteAnswersRef.current.map((answer, index) => `Troubleshooting detail ${index + 1}: ${answer}`),
        ].join('\n');
        websiteAnswersRef.current = [];
        setWebsiteFlow(null);
      }

      addMessage({ type: 'user', text: query });
      historyRef.current.push({ role: 'user', content: query });
      addHistoryEntry(query.split('\n')[0], query);

      setInput('');
      setSending(true);

      const conversationalReply =
        !apiQuestionReply && currentState === 'UNDERSTAND_PROBLEM' && !options.action
          ? matchConversationalMessage(query)
          : null;

      setTypingStatuses(
        apiQuestionReply || conversationalReply ? CONVERSATION_TYPING_STATUSES : TYPING_STATUSES
      );

      try {
        await sleep(TYPING_DELAY_MS);

        let result = null;
        if (apiQuestionReply) {
          result = apiQuestionReply;
        } else if (conversationalReply) {
          result = conversationalReply;
        } else if (online) {
          try {
            const baseUrl = BACKEND_URL || '';
            const res = await fetch(`${baseUrl}/api/diagnose`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: requestQuery,
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

        if (!result) result = matchOfflineKnowledge(requestQuery);

        setTypingStatuses(null);
        addMessage({ type: 'bot', data: result });
        historyRef.current.push({ role: 'assistant', content: result.title || result.problem });
      } catch {
        setTypingStatuses(null);
        addMessage({ type: 'bot', data: matchOfflineKnowledge(requestQuery) });
      } finally {
        setSending(false);
      }
    },
    [
      sending,
      input,
      privacy,
      addMessage,
      currentState,
      caseSummary,
      language,
      online,
      apiFlow,
      websiteFlow,
    ]
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
    setApiFlow(null);
    apiProblemRef.current = '';
    setWebsiteFlow(null);
    websiteAnswersRef.current = [];
    showToast?.('Reverted to previous step.');
  }, [showToast]);

  const newChat = useCallback(() => {
    setMessages([]);
    setTypingStatuses(null);
    setInput('');
    setCurrentState('UNDERSTAND_PROBLEM');
    setCaseSummary(null);
    setApiFlow(null);
    apiProblemRef.current = '';
    setWebsiteFlow(null);
    websiteAnswersRef.current = [];
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
