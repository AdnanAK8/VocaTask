import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Keyboard, Sparkles, AlertCircle, Volume2, Globe } from 'lucide-react';
import { api } from '../services/api';
import type { ExtractedTask } from '../types/task';

interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: Event) => void;
  onend: () => void;
}

interface ExtendedWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

interface VoiceRecorderProps {
  onTaskExtracted: (task: ExtractedTask) => void;
  onOpenSettings?: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTaskExtracted, onOpenSettings }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [selectedLang, setSelectedLang] = useState<string>(
    localStorage.getItem('speech_lang') || 'en-IN'
  );

  const timerRef = useRef<number | null>(null);
  const speechRecognizerRef = useRef<SpeechRecognitionInstance | null>(null);
  const liveTextBufferRef = useRef<string>('');

  // MediaRecorder audio capture refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const languages = [
    { code: 'en-IN', label: '🇮🇳 Hinglish / English (India)' },
    { code: 'hi-IN', label: '🇮🇳 Hindi (हिंदी)' },
    { code: 'pa-IN', label: '🌾 Punjabi (ਪੰਜਾਬੀ)' },
    { code: 'en-US', label: '🌐 English (Global)' },
  ];

  const handleLangChange = (code: string) => {
    setSelectedLang(code);
    localStorage.setItem('speech_lang', code);
  };

  const samplePrompts = [
    "Kal subah 10 baje database ka assignment submit karna hai",
    "Remind me to call mom tomorrow evening",
    "ਕੱਲ੍ਹ ਸ਼ਾਮ 7 ਵਜੇ gym ਜਾਣਾ ਹੈ",
    "कल शाम 6 बजे gym जाना है",
    "Tomorrow at 6 PM I need to call Rahul about the project",
  ];
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPromptIndex((prev) => (prev + 1) % samplePrompts.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [samplePrompts.length]);

  const startRecording = async () => {
    setErrorMsg(null);
    setLiveTranscript('');
    liveTextBufferRef.current = '';
    audioChunksRef.current = [];

    // 1. Try initializing MediaRecorder for direct audio stream capture
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
        });
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        mediaRecorder.start(250);
        mediaRecorderRef.current = mediaRecorder;
      }
    } catch (err) {
      console.warn('MediaRecorder audio stream capture unavailable:', err);
    }

    // 2. Try initializing Web Speech API for live transcription
    const extWin = window as unknown as ExtendedWindow;
    const SpeechRec = extWin.SpeechRecognition || extWin.webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const recognizer = new SpeechRec();
        recognizer.continuous = true;
        recognizer.interimResults = true;
        recognizer.lang = selectedLang;

        recognizer.onresult = (event: SpeechRecognitionEvent) => {
          let currentInterim = '';
          for (let i = 0; i < event.results.length; i++) {
            currentInterim += event.results[i][0].transcript;
          }
          liveTextBufferRef.current = currentInterim;
          setLiveTranscript(currentInterim);
        };

        recognizer.onerror = (e) => {
          console.warn('SpeechRecognition notice:', e);
        };

        recognizer.start();
        speechRecognizerRef.current = recognizer;
      } catch (err) {
        console.warn('Web Speech API start failed:', err);
      }
    }

    // Check if at least one recording method was launched
    if (!mediaRecorderRef.current && !speechRecognizerRef.current) {
      setErrorMsg('Microphone access unavailable or blocked. Please type your task below.');
      setShowTextInput(true);
      return;
    }

    setIsRecording(true);
    setRecordingSeconds(0);

    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop Speech Recognition
    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.stop();
      } catch {
        // Ignored
      }
    }

    // Stop MediaRecorder and collect stream
    let recordedBlob: Blob | null = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        const mediaRecorder = mediaRecorderRef.current;
        await new Promise<void>((resolve) => {
          mediaRecorder.onstop = () => resolve();
          mediaRecorder.stop();
        });
        if (audioChunksRef.current.length > 0) {
          recordedBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        }
        // Stop audio tracks
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.warn('Error stopping MediaRecorder:', e);
      }
    }

    setIsRecording(false);
    setIsProcessing(true);
    setErrorMsg(null);

    const spokenText = (liveTextBufferRef.current || liveTranscript).trim();

    try {
      // Option A: If live speech recognition produced text, process text directly
      if (spokenText.length >= 2) {
        const task = await api.processVoiceText(spokenText);
        onTaskExtracted(task);
      }
      // Option B: If live speech text is empty/short but audio blob exists, upload audio to backend Whisper / Gemini
      else if (recordedBlob && recordedBlob.size > 500) {
        setLiveTranscript('Transcribing audio recording...');
        const task = await api.processVoiceAudio(recordedBlob, selectedLang);
        onTaskExtracted(task);
      } else {
        setErrorMsg('No speech detected. Please speak clearly into your microphone or type below.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse task';
      setErrorMsg(msg);
      setShowTextInput(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const processDirectText = async (text: string) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const task = await api.processVoiceText(text);
      onTaskExtracted(task);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse task';
      setErrorMsg(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedText.trim() || isProcessing) return;

    await processDirectText(typedText);
    setTypedText('');
    setShowTextInput(false);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Voice Card Container */}
      <div className="relative rounded-3xl bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-slate-800/80 p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl">
        
        {/* Ambient Glow */}
        <div className={`absolute -inset-0.5 rounded-3xl bg-gradient-to-r ${isRecording ? 'from-rose-500 to-indigo-500 opacity-40 blur-xl' : 'from-indigo-500/20 to-purple-500/20 opacity-30 blur-lg'} -z-10 transition-all duration-500`} />

        {/* Top Bar: Status & Spoken Language Selector */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-4">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold tracking-wider uppercase text-indigo-300">
              {isRecording ? 'Listening & Recording...' : isProcessing ? 'AI Processing Task...' : 'Voice AI Task Creator'}
            </span>
          </div>

          {/* Language Selector Dropdown */}
          <div className="flex items-center space-x-1 bg-slate-950/70 border border-slate-800 rounded-xl px-2 py-1">
            <Globe className="w-3 h-3 text-indigo-400 flex-shrink-0" />
            <select
              value={selectedLang}
              onChange={(e) => handleLangChange(e.target.value)}
              disabled={isRecording || isProcessing}
              className="bg-transparent text-[11px] text-slate-300 focus:outline-none cursor-pointer"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code} className="bg-slate-900 text-slate-200">
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Speech Feedback or Rotating Prompt Hint */}
        <div className="min-h-12 flex items-center justify-center px-4 mb-4">
          {isRecording && liveTranscript ? (
            <div className="w-full flex items-center gap-2 p-2.5 rounded-2xl bg-indigo-950/50 border border-indigo-500/40 text-xs text-indigo-200 animate-in fade-in">
              <Volume2 className="w-4 h-4 text-indigo-400 flex-shrink-0 animate-pulse" />
              <p className="line-clamp-2 text-left font-medium">"{liveTranscript}"</p>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-slate-400 italic transition-opacity duration-300">
              "{samplePrompts[promptIndex]}"
            </p>
          )}
        </div>

        {/* Waveform Animation (When recording) */}
        {isRecording && (
          <div className="flex items-center justify-center gap-1.5 h-12 mb-4">
            <span className="w-1.5 bg-rose-400 rounded-full animate-wave-1" />
            <span className="w-1.5 bg-rose-500 rounded-full animate-wave-2" />
            <span className="w-1.5 bg-indigo-400 rounded-full animate-wave-3" />
            <span className="w-1.5 bg-indigo-500 rounded-full animate-wave-4" />
            <span className="w-1.5 bg-purple-500 rounded-full animate-wave-5" />
            <span className="w-1.5 bg-rose-400 rounded-full animate-wave-2" />
            <span className="w-1.5 bg-indigo-400 rounded-full animate-wave-1" />
          </div>
        )}

        {/* Central Circular Mic Button */}
        <div className="relative inline-flex items-center justify-center my-2">
          {/* Ripple rings */}
          {isRecording && (
            <>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-rose-500/30 animate-ping pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-indigo-500/20 animate-pulse pointer-events-none" />
            </>
          )}

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
            className={`relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 active:scale-95 ${
              isRecording
                ? 'bg-gradient-to-tr from-rose-600 to-rose-500 text-white shadow-rose-600/40 ring-4 ring-rose-500/30'
                : isProcessing
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-indigo-600/40 hover:shadow-indigo-500/50 hover:scale-105 ring-4 ring-indigo-500/20'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin text-indigo-300" />
            ) : isRecording ? (
              <Square className="w-8 h-8 fill-current" />
            ) : (
              <Mic className="w-9 h-9 sm:w-10 sm:h-10" />
            )}
          </button>
        </div>

        {/* Sub-label & Timer */}
        <div className="mt-4">
          {isRecording ? (
            <div className="flex items-center justify-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="text-sm font-semibold text-rose-400 font-mono">
                {formatSeconds(recordingSeconds)}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Tap to Finish Speaking
              </span>
            </div>
          ) : isProcessing ? (
            <p className="text-xs font-medium text-indigo-300 animate-pulse">
              AI transcribing & extracting structured task...
            </p>
          ) : (
            <p className="text-xs font-medium text-slate-300">
              Tap to Speak <span className="text-slate-500">•</span> Multilingual Voice Recognition
            </p>
          )}
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex flex-col items-center gap-1.5 text-center">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Voice Notice</span>
            </div>
            <p className="text-[11px] text-slate-300">{errorMsg}</p>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="mt-1 text-[11px] text-indigo-400 hover:underline font-semibold"
              >
                Configure AI Keys in Settings →
              </button>
            )}
          </div>
        )}

        {/* Quick Type / Keyboard Alternative */}
        <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-center">
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{showTextInput ? 'Hide text input' : 'Type instead of speaking'}</span>
          </button>
        </div>

        {/* Collapsible Text Input */}
        {showTextInput && (
          <form onSubmit={handleTextSubmit} className="mt-4 flex gap-2">
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="e.g. Kal subah 10 baje database ka assignment submit karna hai..."
              className="flex-1 bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!typedText.trim() || isProcessing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all"
            >
              Parse
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
