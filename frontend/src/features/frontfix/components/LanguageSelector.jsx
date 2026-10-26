export default function LanguageSelector({ currentLanguage = 'auto', onLanguageChange }) {
  const languages = [
    { code: 'auto', label: '🌐 Auto Detect' },
    { code: 'en', label: '🇬🇧 English' },
    { code: 'hi', label: '🇮🇳 हिन्दी (Hindi)' },
    { code: 'pa', label: '🇮🇳 ਪੰਜਾਬੀ (Punjabi)' },
    { code: 'hinglish', label: '🗣️ Hinglish' },
  ];

  return (
    <div className="language-selector-wrapper" title="Change diagnostic response language">
      <select
        className="language-selector-dropdown"
        value={currentLanguage}
        onChange={(e) => onLanguageChange?.(e.target.value)}
        aria-label="Select response language"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
