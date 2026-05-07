import React, { useState, useRef, useEffect, useCallback } from 'react';
import ModelSelector from '../components/ModelSelector';
import { MODEL_MAP, callAI, speakTTS, ModelEntry } from '../lib/models';
import { SimpleMarkdown } from '../lib/markdown';

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'verse', 'ballad', 'ash', 'sage'];

const VOICE_PERSONAS: Record<string, string> = {
  Maya: 'You are Maya, a warm and insightful AI companion who speaks conversationally and naturally.',
  'GPT-4o Advanced Voice': 'You are GPT-4o in Advanced Voice mode. Speak naturally and conversationally as if on a phone call.',
  'Perplexity Voice': 'You are Perplexity Voice, concise and informative with a focus on accuracy.',
  'Grok Voice': 'You are Grok Voice, witty and direct with a touch of humor.',
  'Gemini Live': 'You are Gemini Live, helpful and engaging in real-time conversation.',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function VoiceChat() {
  const [modelId, setModelId] = useState('');
  const [voice, setVoice] = useState('alloy');
  const [voicePersona, setVoicePersona] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [error, setError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // SpeechRecognition setup
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        setListening(false);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  }, [listening]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');

    const modelEntry: ModelEntry | null = modelId ? MODEL_MAP[modelId] ?? null : null;
    const allMsgs = [...messages, userMsg];

    // Add voice persona to system message if selected
    const msgsForAPI = voicePersona
      ? [{ role: 'system' as const, content: VOICE_PERSONAS[voicePersona] }, ...allMsgs]
      : allMsgs;

    try {
      const res = await callAI(msgsForAPI, undefined, modelEntry);
      const assistantMsg: Message = { role: 'assistant', content: res.content };
      setMessages(prev => [...prev, assistantMsg]);

      if (autoSpeak) {
        speakTTS(res.content, voice);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, modelId, voice, voicePersona, autoSpeak]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const hasSR = !!(typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">🎙️ Voice Chat</h1>
      <p className="text-sm text-slate-400 mb-6">Speak or type — AI responds with voice</p>

      {/* Settings bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <ModelSelector value={modelId} onChange={setModelId} label="AI Model" />
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Voice</label>
          <select value={voice} onChange={e => setVoice(e.target.value)} className="w-full bg-slate-800/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200">
            {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Persona</label>
          <select value={voicePersona} onChange={e => setVoicePersona(e.target.value)} className="w-full bg-slate-800/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200">
            <option value="">None</option>
            {Object.keys(VOICE_PERSONAS).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer pb-2">
            <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} className="accent-violet-500" />
            Auto-speak
          </label>
        </div>
      </div>

      {/* Chat area */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 mb-4 min-h-[400px] max-h-[500px] overflow-y-auto custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 py-16">
            <div className="text-4xl mb-3">🎙️</div>
            <p>Start a conversation by speaking or typing</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-violet-600/30 border border-violet-500/30 text-violet-100'
                : 'bg-slate-700/50 border border-slate-600/30 text-slate-200'
            }`}>
              {msg.role === 'assistant' ? <SimpleMarkdown content={msg.content} /> : msg.content}
              {msg.role === 'assistant' && (
                <button onClick={() => speakTTS(msg.content, voice)} className="mt-1 text-xs text-violet-400 hover:text-violet-300">🔊 Replay</button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-slate-700/50 border border-slate-600/30 rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {error && <div className="text-red-400 text-sm mb-3">❌ {error}</div>}

      {/* Input */}
      <div className="flex gap-2">
        {hasSR && (
          <button
            onClick={toggleListening}
            className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              listening ? 'bg-red-500 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            🎤
          </button>
        )}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type or speak your message..."
          className="flex-1 bg-slate-800/80 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          disabled={loading}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="flex-shrink-0 px-5 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl font-medium transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
