import { OFFLINE_KNOWLEDGE } from '../data/knowledgeBase.js';

const CONFIRMATION = 'Did this resolve your issue?';

export function matchOfflineKnowledge(query) {
  if (!query || typeof query !== 'string') {
    return {
      matched: false,
      response_type: 'follow_up_question',
      state: 'COLLECT_CONTEXT',
      title: 'FrontFix AI Support',
      greeting: "Hi! I'm here to help you fix your technical problems.",
      follow_up_question: 'What problem are you experiencing?',
      interactive_options: [
        'Website not working',
        'JavaScript or React error',
        'API or backend problem',
        'Styling or UI issue',
        'Build or deployment failure',
        'Database or connection issue',
        'Something else',
      ],
      can_skip: false,
      verification_actions: [],
    };
  }

  const lower = query.toLowerCase().trim();

  // 1. Starter Categories
  if (lower.includes('api or backend') || lower === 'api problem' || lower === 'backend problem') {
    return {
      matched: false,
      response_type: 'follow_up_question',
      state: 'COLLECT_CONTEXT',
      category: 'API & Backend Diagnostics',
      title: 'FrontFix AI Support',
      greeting: "Sure! I'll help you troubleshoot your API or backend issue. Let's understand what's happening first.",
      follow_up_question: 'What problem are you experiencing?',
      interactive_options: [
        'API request is failing.',
        "I'm getting a 400, 401, 403, 404, or 500 error.",
        'My frontend cannot connect to the backend.',
        "I'm getting a CORS error.",
        'The API returns unexpected data.',
        'The request keeps loading or times out.',
        'Something else.',
        "I'm not sure.",
      ],
      can_skip: true,
      verification_actions: [],
    };
  }

  if (lower.includes('website not working') || lower === 'website down' || lower === 'site not working') {
    return {
      matched: false,
      response_type: 'follow_up_question',
      state: 'COLLECT_CONTEXT',
      category: 'Website Availability',
      title: 'FrontFix AI Support',
      greeting: "Sure! I'll help you find out why your website isn't working. Let's start with what you're seeing.",
      follow_up_question: 'What exactly is happening?',
      interactive_options: [
        'The website shows a blank screen',
        'The website is loading very slowly',
        'I see an error message on screen',
        'Some buttons or features are not working',
        'The website is completely unavailable (Network/Server down)',
        'Something else',
        "I'm not sure",
      ],
      can_skip: true,
      verification_actions: [],
    };
  }

  if (lower.includes('javascript or react error') || lower === 'react error' || lower === 'javascript error') {
    return {
      matched: false,
      response_type: 'follow_up_question',
      state: 'COLLECT_CONTEXT',
      category: 'JavaScript & React Diagnostics',
      title: 'FrontFix AI Support',
      greeting: "Got it! Let's track down and fix this JavaScript or React error.",
      follow_up_question: 'What kind of error are you seeing?',
      interactive_options: [
        "TypeError: Cannot read properties of undefined (reading 'map')",
        'React Hook error (e.g. Invalid hook call, too many re-renders)',
        'Component crashed or fails to render',
        'State or prop is not updating',
        'Hydration or SSR mismatch error',
        'Red error in browser console (F12)',
        'Something else',
        "I'm not sure",
      ],
      can_skip: true,
      verification_actions: [],
    };
  }

  if (lower.includes('styling or ui') || lower === 'styling issue' || lower === 'ui issue') {
    return {
      matched: false,
      response_type: 'follow_up_question',
      state: 'COLLECT_CONTEXT',
      category: 'CSS & Layout Diagnostics',
      title: 'FrontFix AI Support',
      greeting: "I'll help you fix your layout and styling problem. Let's narrow down the issue.",
      follow_up_question: 'You mentioned CSS — is this about element centering, z-index stacking, flexbox overflow, or mobile viewport jumping?',
      interactive_options: [
        'Div or element refuses to center horizontally or vertically',
        'Element renders behind other content (z-index stacking issue)',
        'Text or container causes unwanted horizontal scrolling / overflow',
        'Layout breaks on mobile viewports (Responsive styling issue)',
        'Styles / CSS classes are not applying or being overridden',
        'Something else',
        "I'm not sure",
      ],
      can_skip: true,
      verification_actions: [],
    };
  }

  if (lower.includes('build or deployment') || lower === 'build failure' || lower === 'deployment failure') {
    return {
      matched: false,
      response_type: 'follow_up_question',
      state: 'COLLECT_CONTEXT',
      category: 'Build & Deployment Diagnostics',
      title: 'FrontFix AI Support',
      greeting: "Let's get your build or deployment passing. What stage is failing?",
      follow_up_question: 'What is failing in your build or deployment?',
      interactive_options: [
        'Vite / Next.js build failed (npm run build)',
        'Module not found: Cannot resolve package or dependency',
        'TypeScript compilation error (tsc -b)',
        'Deployment container failed on Vercel / Render / Docker',
        'Environment variables missing in production (.env)',
        'Something else',
        "I'm not sure",
      ],
      can_skip: true,
      verification_actions: [],
    };
  }

  if (lower.includes('database or connection') || lower === 'database error' || lower === 'database issue') {
    return {
      matched: false,
      response_type: 'follow_up_question',
      state: 'COLLECT_CONTEXT',
      category: 'Database Diagnostics',
      title: 'FrontFix AI Support',
      greeting: "I'll help you troubleshoot your database and data connection. Let's identify the issue.",
      follow_up_question: 'What issue are you experiencing with your database?',
      interactive_options: [
        'PostgreSQL connection refused / authentication failed',
        'Database migration error (Alembic / Prisma)',
        'SQLite / local database locked or missing',
        'Query timeout or database connection pool exhausted',
        'Something else',
        "I'm not sure",
      ],
      can_skip: true,
      verification_actions: [],
    };
  }

  if (lower.includes('something else') || lower === 'other') {
    return {
      matched: false,
      response_type: 'follow_up_question',
      state: 'COLLECT_CONTEXT',
      category: 'Technical Inquiry',
      title: 'FrontFix AI Support',
      greeting: "No problem! Tell me a bit about what's going wrong.",
      follow_up_question: "How would you describe the problem you're trying to solve?",
      interactive_options: [
        'My code crashes with an error message',
        'Something looks or behaves unexpectedly',
        'I need help setting up or configuring something',
        'Performance or memory issue',
        "I don't know where to start",
      ],
      can_skip: true,
      verification_actions: [],
    };
  }

  // 2. Check for 502 / proxy / network connection failure
  if (
    lower.includes('502') ||
    lower.includes('bad gateway') ||
    lower.includes('econnrefused') ||
    lower.includes('proxy error') ||
    lower.includes('failed to fetch')
  ) {
    return {
      matched: false,
      response_type: 'follow_up_question',
      state: 'COLLECT_CONTEXT',
      category: 'Network & Proxy Diagnostics',
      title: 'FrontFix AI Support',
      greeting: "I see you're encountering a 502 Bad Gateway or proxy connection error.",
      follow_up_question: 'Which of the following describes your setup right now?',
      interactive_options: [
        'Backend server is not running (uvicorn port 8000 offline)',
        'Vite terminal shows: connect ECONNREFUSED 127.0.0.1:8000',
        'Backend is running on a different port',
        'Backend returned an internal server error (500)',
      ],
      can_skip: true,
      verification_actions: [],
      source: {
        title: 'MDN Web Docs — 502 Bad Gateway',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/502',
      },
    };
  }

  // 3. Check for vague queries (blank screen, crash, not working)
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
      response_type: 'follow_up_question',
      state: 'COLLECT_CONTEXT',
      category: 'Frontend Support',
      title: 'FrontFix AI Support',
      greeting: "Let's understand what's happening first.",
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

  // 4. Match against offline knowledge base triggers
  for (const item of OFFLINE_KNOWLEDGE) {
    if (item.triggers.some((t) => lower.includes(t.toLowerCase()))) {
      const { id: _id, triggers: _triggers, ...rest } = item;
      return {
        matched: true,
        response_type: 'solution',
        state: 'PRESENT_SOLUTION',
        is_uncertain: false,
        ...rest,
        confirmation_prompt: CONFIRMATION,
        interactive_options: [],
        verification_actions: [
          'verify_solved',
          'verify_broken',
          'verify_partial',
          'verify_different_error',
          'verify_need_help',
        ],
      };
    }
  }

  // 5. Default uncatalogued offline diagnostic
  return {
    matched: false,
    response_type: 'follow_up_question',
    state: 'COLLECT_CONTEXT',
    is_uncertain: true,
    category: 'General Frontend Support',
    title: 'FrontFix AI Support',
    greeting: "Let's gather some details to diagnose this issue.",
    follow_up_question: 'To help pinpoint the fix, where does this error occur?',
    interactive_options: [
      'In an async API call (fetch / axios)',
      'During component render (useState / useEffect)',
      'In a click or form submit handler',
      'During Vite build or bundling',
    ],
    can_skip: true,
    verification_actions: [],
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
