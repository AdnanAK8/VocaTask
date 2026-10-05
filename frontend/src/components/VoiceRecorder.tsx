import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Keyboard, Sparkles, AlertCircle, Volume2 } from 'lucide-react';
import { api } from '../services/api';
import type { ExtractedTask } from '../types/task';

// Type definitions for browser SpeechRecognition
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
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTaskExtracted }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [typedText, setTypedText] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const speechRecognizerRef = useRef<SpeechRecognitionInstance | null>(null);

  // Example voice prompts in various languages
  const samplePrompts = [
    "Kal subah 10 baje DBMS assignment submit karna hai",
    "Call Rahul tomorrow at 6 PM about the project",
    "ਕੱਲ੍ਹ ਸ਼ਾਮ 7 ਵਜੇ gym ਜਾਣਾ ਹੈ",
    "कल शाम 8 बजे डॉक्टर का अपॉइंटमेंट है",
    "Pay electricity bill this Friday",
  ];
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPromptIndex((prev) => (prev + 1) % samplePrompts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [samplePrompts.length]);

  const startRecording = async () => {
    setErrorMsg(null);
    setLiveTranscript('');
    audioChunksRef.current = [];

    // 1. Initialize browser-native live speech recognizer if supported
    const extWin = window as unknown as ExtendedWindow;
    const SpeechRec = extWin.SpeechRecognition || extWin.webkitSpeechRecognition;
    let liveTextBuffer = '';

    if (SpeechRec) {
      try {
        const recognizer = new SpeechRec();
        recognizer.continuous = true;
        recognizer.interimResults = true;
        
        recognizer.onresult = (event: SpeechRecognitionEvent) => {
          let currentInterim = '';
          for (let i = 0; i < event.results.length; i++) {
            currentInterim += event.results[i][0].transcript;
          }
          liveTextBuffer = currentInterim;
          setLiveTranscript(currentInterim);
        };

        recognizer.onerror = (e) => {
          console.warn('SpeechRecognition notice:', e);
        };

        recognizer.start();
        speechRecognizerRef.current = recognizer;
      } catch (err) {
        console.warn('Live SpeechRecognition could not start:', err);
      }
    }

    // 2. Initialize MediaRecorder for high-fidelity audio capture
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported on this browser. Please use text input.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop audio tracks
        stream.getTracks().forEach((track) => track.stop());

        // Stop live recognizer if running
        if (speechRecognizerRef.current) {
          try {
            speechRecognizerRef.current.stop();
          } catch {
            // Ignored
          }
        }

        const finalMime = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
        
        // Prioritize live recognized text if captured accurately
        if (liveTextBuffer && liveTextBuffer.trim().length > 3) {
          await processDirectText(liveTextBuffer);
        } else if (audioBlob.size > 1000) {
          await processAudio(audioBlob, finalMime.includes('mp4') ? 'voice.m4a' : 'voice.webm');
        } else {
          setErrorMsg("Audio was too short. Please speak clearly.");
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.error('Microphone error:', err);
      const msg = err instanceof Error ? err.message : 'Could not access microphone';
      setErrorMsg(msg.includes('Permission') ? 'Microphone permission denied. Enable it in browser settings.' : msg);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
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

  const processAudio = async (blob: Blob, filename: string) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const task = await api.processVoiceAudio(blob, filename);
      onTaskExtracted(task);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process voice';
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
    <div className="w-full max-w-md mx-auto my-6 px-4">
      {/* Voice Card Container */}
      <div className="relative rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl">
        
        {/* Ambient Glow */}
        <div className={`absolute -inset-0.5 rounded-3xl bg-gradient-to-r ${isRecording ? 'from-rose-500 to-indigo-500 opacity-40 blur-xl' : 'from-indigo-500/20 to-purple-500/20 opacity-30 blur-lg'} -z-10 transition-all duration-500`} />

        {/* Header Status */}
        <div className="flex items-center justify-center space-x-2 mb-4">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold tracking-wider uppercase text-indigo-300">
            {isRecording ? 'Listening in any language...' : isProcessing ? 'AI Processing Speech...' : 'Voice-First AI Task Creator'}
          </span>
        </div>

        {/* Live Speech Feedback or Rotating Prompt Hint */}
        <div className="min-h-12 flex items-center justify-center px-4 mb-4">
          {isRecording && liveTranscript ? (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/70 border border-indigo-500/30 text-xs text-indigo-200 animate-in fade-in">
              <Volume2 className="w-4 h-4 text-indigo-400 flex-shrink-0 animate-pulse" />
              <p className="line-clamp-2 italic">"{liveTranscript}"</p>
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
              <div className="absolute w-24 h-24 rounded-full bg-rose-500/30 animate-ping" />
              <div className="absolute w-28 h-28 rounded-full bg-indigo-500/20 animate-pulse" />
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
              <span className="text-xs text-slate-400 font-medium">Tap to Finish</span>
            </div>
          ) : isProcessing ? (
            <p className="text-xs font-medium text-indigo-300 animate-pulse">
              Translating & extracting structured task...
            </p>
          ) : (
            <p className="text-xs font-medium text-slate-300">
              Tap to Speak <span className="text-slate-500">•</span> Any Language
            </p>
          )}
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
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
              placeholder="e.g. Kal shaam 6 baje gym jana hai..."
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
