import { OFFLINE_KNOWLEDGE } from '../data/knowledgeBase.js';

const CONFIRMATION = 'Did this resolve your issue?';

export function matchOfflineKnowledge(query) {
  if (!query || typeof query !== 'string') {
    return {
      matched: false,
      state: 'COLLECT_CONTEXT',
      title: 'Need More Context to Diagnose',
      problem: 'Please describe the problem or paste the error message you are encountering.',
      likely_cause: 'Without an error message or symptoms, we cannot identify the root cause.',
      follow_up_question: 'What type of issue are you facing?',
      interactive_options: [
        'JavaScript error (e.g. Cannot read properties of undefined)',
        'Network error (502 Bad Gateway, 404, CORS)',
        'React render crash / White Screen',
        'CSS layout / flexbox alignment problem',
      ],
      can_skip: false,
      verification_actions: [],
    };
  }

  const lower = query.toLowerCase().trim();

  // 1. Check for 502 / proxy / network connection failure
  if (
    lower.includes('502') ||
    lower.includes('bad gateway') ||
    lower.includes('econnrefused') ||
    lower.includes('proxy error') ||
    lower.includes('failed to fetch')
  ) {
    return {
      matched: false,
      state: 'COLLECT_CONTEXT',
      category: 'Network & Proxy Diagnostics',
      title: '502 Bad Gateway / Backend Connection Diagnostic',
      problem: `Identified connection failure: "${query.slice(0, 80)}"`,
      likely_cause:
        'A 502 Bad Gateway or proxy error means the frontend development server (Vite on port 5173) cannot communicate with the backend server (FastAPI on port 8000).',
      follow_up_question: 'Which of the following describes your setup right now?',
      interactive_options: [
        'Backend server is not running (uvicorn port 8000 offline)',
        'Vite terminal shows: connect ECONNREFUSED 127.0.0.1:8000',
        'Backend is running on a different port',
        'Backend returned an internal server error (500)',
      ],
      can_skip: true,
      verification_actions: ['verify_solved', 'verify_broken'],
      fix_steps: [
        '1. Ensure the backend terminal is running: .\\backend\\venv\\Scripts\\Activate.ps1 followed by uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload',
        '2. Verify that http://127.0.0.1:8000/api/health returns {"status": "ok"}.',
        '3. Check frontend/vite.config.ts proxy setting for /api pointing to http://127.0.0.1:8000.',
      ],
      source: {
        title: 'MDN Web Docs — 502 Bad Gateway',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/502',
      },
    };
  }

  // 2. Check for vague queries (blank screen, crash, not working)
  const isVague =
    lower.length < 12 ||
    lower.includes('blank') ||
    lower.includes('crash') ||
    lower.includes('not working') ||
    lower.includes('broken') ||
    lower.includes('freeze') ||
    lower.includes('white screen');

  const hasSpecificCode =
    lower.includes('map') ||
    lower.includes('cors') ||
    lower.includes('hook') ||
    lower.includes('undefined') ||
    lower.includes('typeerror') ||
    lower.includes('syntaxerror');

  if (isVague && !hasSpecificCode) {
    return {
      matched: false,
      state: 'COLLECT_CONTEXT',
      category: 'Frontend Diagnostic Clarification',
      title: 'Need a Few Details to Diagnose',
      problem: `Your issue: "${query.slice(0, 80)}"`,
      likely_cause:
        'A blank screen or crash usually stems from an unhandled runtime exception in a React component, missing conditional rendering guards, or a failed initial network fetch.',
      follow_up_question: 'What happens when the application fails or crashes?',
      interactive_options: [
        'The page becomes completely blank (White Screen)',
        'I see a red error message in the browser console (F12)',
        'A component fails or disappears after clicking a button',
        'The application freezes or hangs on page load',
      ],
      can_skip: true,
      verification_actions: [],
      source: {
        title: 'React.dev — Error Boundaries & Catching Errors',
        url: 'https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary',
      },
    };
  }

  // 3. Match against offline knowledge base triggers
  for (const item of OFFLINE_KNOWLEDGE) {
    if (item.triggers.some((t) => lower.includes(t.toLowerCase()))) {
      const { id: _id, triggers: _triggers, ...rest } = item;
      return {
        matched: true,
        state: 'PRESENT_SOLUTION',
        is_uncertain: false,
        ...rest,
        confirmation_prompt: CONFIRMATION,
        interactive_options: [],
        verification_actions: ['verify_solved', 'verify_broken'],
      };
    }
  }

  // 4. Default uncatalogued offline diagnostic
  return {
    matched: false,
    state: 'COLLECT_CONTEXT',
    is_uncertain: true,
    category: 'General Frontend Runtime',
    title: 'Diagnostic Analysis for Frontend Error',
    problem: `Identified issue: "${query.slice(0, 80)}...".`,
    likely_cause:
      'This error does not directly match catalogued presets. It usually occurs due to an asynchronous timing condition, undefined object access, or unhandled promise rejection.',
    follow_up_question: 'To help pinpoint the fix, where does this error occur?',
    interactive_options: [
      'In an async API call (fetch / axios)',
      'During component render (useState / useEffect)',
      'In a click or form submit handler',
      'During Vite build or bundling',
    ],
    can_skip: true,
    fix_steps: [
      '1. Open DevTools (F12) Console tab to inspect the exact file and line number.',
      '2. Wrap the suspect code in a try/catch guard or React Error Boundary.',
      '3. Open DevTools Network tab to inspect failed API responses.',
    ],
    code_before: '// ❌ Unhandled exception\nconst res = doAction();',
    code_after:
      "// ✅ Fixed: Wrap with safety guard\ntry {\n  const res = doAction();\n} catch (err) {\n  console.error('Caught error safely:', err);\n}",
    extra_tips:
      'State whether you are running in SSR (Next.js/Remix) or client SPA (Vite/CRA) for targeted solutions.',
    verification_actions: ['verify_solved', 'verify_broken'],
    source: {
      title: 'MDN Web Docs — Error Handling',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling',
    },
  };
}

// Scan an uploaded log for known error signatures
export function analyzeLog(text) {
  const lower = text.toLowerCase();
  const top_issues = [];

  for (const item of OFFLINE_KNOWLEDGE) {
    const symptom = item.triggers.find((t) => lower.includes(t.toLowerCase()));
    if (symptom) top_issues.push({ symptom, diagnosis: item });
  }

  return {
    total_lines_analyzed: text.split('\n').length,
    total_error_lines_detected: top_issues.length,
    unique_issues_identified: top_issues.length,
    top_issues,
  };
}
