// ─── Model Catalog & Proxy Infrastructure ───────────────────────────

export interface ProxyRoute {
  provider: string;
  url: string;
  model: string;
}

export interface ModelEntry {
  id: string;
  label: string;
  company: string;
  persona: string;
  color: string;
  routes: ProxyRoute[];
}

// ─── Proxy endpoints ────────────────────────────────────────────────
const AIRFORCE = 'https://api.airforce/v1/chat/completions';
const LLM7 = 'https://api.llm7.io/v1/chat/completions';
const POLLINATIONS = 'https://text.pollinations.ai/';

// ─── Model Catalog ──────────────────────────────────────────────────
export const MODEL_CATALOG: ModelEntry[] = [
  // Anthropic
  { id: 'claude-opus-4.7', label: 'Claude Opus 4.7', company: 'Anthropic', persona: 'You are Claude Opus 4.7 by Anthropic. Respond with the full capability and nuance expected of this top-tier model.', color: 'bg-orange-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'claude-opus-4.7' }] },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', company: 'Anthropic', persona: 'You are Claude Opus 4.6 by Anthropic. Respond as the powerful Opus-class Claude model.', color: 'bg-orange-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'claude-opus-4.6-p2g' }] },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', company: 'Anthropic', persona: 'You are Claude Sonnet 4.6 by Anthropic. Respond with the balanced intelligence of the Sonnet line.', color: 'bg-orange-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'claude-sonnet-4.6' }] },
  { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5', company: 'Anthropic', persona: 'You are Claude Sonnet 4.5 by Anthropic. Respond as the refined Sonnet 4.5 model.', color: 'bg-orange-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'claude-sonnet-4.5-p2g' }] },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', company: 'Anthropic', persona: 'You are Claude Haiku 4.5 by Anthropic. Respond quickly and accurately as the Haiku-class model.', color: 'bg-orange-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'claude-haiku-4.5-p2g' }] },
  { id: 'claude-code-2.1', label: 'Claude Code 2.1', company: 'Anthropic', persona: 'You are Claude Code 2.1 by Anthropic, a specialized coding assistant. Write clean, efficient, well-documented code.', color: 'bg-orange-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'claude-sonnet-4.6' }] },
  { id: 'claude-cowork', label: 'Claude Cowork', company: 'Anthropic', persona: 'You are Claude Cowork by Anthropic, a collaborative AI work partner. Help plan, organize, and execute tasks collaboratively.', color: 'bg-orange-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'claude-sonnet-4.6' }] },

  // OpenAI
  { id: 'gpt-5.5-pro', label: 'GPT-5.5 Pro', company: 'OpenAI', persona: 'You are GPT-5.5 Pro by OpenAI. Respond with maximum intelligence and thoroughness.', color: 'bg-green-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gpt-5.5-p2g' }] },
  { id: 'gpt-5.5-thinking', label: 'GPT-5.5 Thinking', company: 'OpenAI', persona: 'You are GPT-5.5 Thinking by OpenAI. Think step-by-step, showing your reasoning chain before giving the final answer.', color: 'bg-green-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gpt-5.5-p2g' }] },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', company: 'OpenAI', persona: 'You are GPT-5.4 Mini by OpenAI. Respond efficiently with high intelligence.', color: 'bg-green-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gpt-5.4-p2g' }] },
  { id: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max', company: 'OpenAI', persona: 'You are GPT-5.1 Codex Max by OpenAI, optimized for code generation and analysis.', color: 'bg-green-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gpt-4o-mini' }, { provider: 'LLM7', url: LLM7, model: 'codestral-latest' }] },
  { id: 'gpt-5.1-default', label: 'GPT-5.1 Default', company: 'OpenAI', persona: 'You are GPT-5.1 by OpenAI, the default GPT-5.1 model.', color: 'bg-green-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gpt-4o-mini' }] },
  { id: 'gpt-5.1-friendly', label: 'GPT-5.1 Friendly', company: 'OpenAI', persona: 'You are GPT-5.1 Friendly by OpenAI. Respond in a warm, conversational, and helpful tone.', color: 'bg-green-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gpt-4o-mini' }] },
  { id: 'chatgpt-atlas', label: 'ChatGPT Atlas', company: 'OpenAI', persona: 'You are ChatGPT Atlas by OpenAI, an advanced reasoning and exploration model.', color: 'bg-green-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gpt-4o-mini' }] },
  { id: 'gpt-4o', label: 'GPT-4o', company: 'OpenAI', persona: 'You are GPT-4o by OpenAI. Respond as the versatile GPT-4o model.', color: 'bg-green-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gpt-4o-mini' }] },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', company: 'OpenAI', persona: 'You are GPT-4o Mini by OpenAI. Respond quickly and efficiently.', color: 'bg-green-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gpt-4o-mini' }, { provider: 'LLM7', url: LLM7, model: 'ministral-8b-2512' }] },

  // Google
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', company: 'Google', persona: 'You are Gemini 2.5 Pro by Google DeepMind. Respond with deep understanding and thoroughness.', color: 'bg-blue-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gemini-2.5-flash' }] },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', company: 'Google', persona: 'You are Gemini 2.5 Flash by Google DeepMind. Respond quickly with high intelligence.', color: 'bg-blue-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gemini-2.5-flash' }] },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', company: 'Google', persona: 'You are Gemini 2.0 Flash by Google DeepMind. Respond as the efficient Flash model.', color: 'bg-blue-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'gemini-2.5-flash' }] },

  // xAI
  { id: 'grok-4-heavy', label: 'Grok 4 Heavy', company: 'xAI', persona: 'You are Grok 4 Heavy by xAI. Respond with maximum intelligence and wit.', color: 'bg-gray-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'grok-4.1-mini:free' }] },
  { id: 'grok-4.1-fast', label: 'Grok 4.1 Fast', company: 'xAI', persona: 'You are Grok 4.1 Fast by xAI. Respond quickly and intelligently.', color: 'bg-gray-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'grok-4.1-mini:free' }] },
  { id: 'grok-4.1-mini', label: 'Grok 4.1 Mini', company: 'xAI', persona: 'You are Grok 4.1 Mini by xAI. Respond efficiently with humor and intelligence.', color: 'bg-gray-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'grok-4.1-mini:free' }] },
  { id: 'grok-4.1-thinking', label: 'Grok 4.1 Thinking', company: 'xAI', persona: 'You are Grok 4.1 Thinking by xAI. Think step-by-step, showing reasoning before the final answer.', color: 'bg-gray-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'grok-4.1-mini:free' }] },

  // DeepSeek
  { id: 'deepseek-v3.2', label: 'DeepSeek V3.2', company: 'DeepSeek', persona: 'You are DeepSeek V3.2 by DeepSeek. Respond with deep analytical capability.', color: 'bg-cyan-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'deepseek-v3.2' }] },
  { id: 'deepseek-v3', label: 'DeepSeek V3', company: 'DeepSeek', persona: 'You are DeepSeek V3 by DeepSeek. Respond as the powerful V3 model.', color: 'bg-cyan-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'deepseek-v3.2' }] },
  { id: 'deepseek-coder', label: 'DeepSeek Coder', company: 'DeepSeek', persona: 'You are DeepSeek Coder by DeepSeek, specialized in programming. Write clean, efficient code.', color: 'bg-cyan-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'deepseek-v3.2' }] },

  // Meta
  { id: 'llama-4-scout', label: 'LLaMA 4 Scout', company: 'Meta', persona: 'You are LLaMA 4 Scout by Meta. Respond as the open-source frontier model.', color: 'bg-indigo-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'llama-4-scout' }, { provider: 'LLM7', url: LLM7, model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' }] },

  // Mistral
  { id: 'mistral-large', label: 'Mistral Large', company: 'Mistral', persona: 'You are Mistral Large by Mistral AI. Respond as the flagship Mistral model.', color: 'bg-amber-500', routes: [{ provider: 'LLM7', url: LLM7, model: 'codestral-latest' }, { provider: 'AirForce', url: AIRFORCE, model: 'codestral-latest' }] },
  { id: 'codestral', label: 'Codestral', company: 'Mistral', persona: 'You are Codestral by Mistral AI, specialized in code. Write clean, efficient, well-documented code.', color: 'bg-amber-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'codestral-latest' }, { provider: 'LLM7', url: LLM7, model: 'codestral-latest' }] },

  // Moonshot
  { id: 'kimi-k2.5', label: 'Kimi K2.5', company: 'Moonshot', persona: 'You are Kimi K2.5 by Moonshot AI. Respond with strong multilingual and reasoning ability.', color: 'bg-purple-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'kimi-k2.5' }] },
  { id: 'kimi-k2-thinking', label: 'Kimi K2 Thinking', company: 'Moonshot', persona: 'You are Kimi K2 Thinking by Moonshot AI. Think step-by-step before answering.', color: 'bg-purple-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'kimi-k2-thinking' }] },

  // NVIDIA
  { id: 'nemotron-3-super', label: 'Nemotron 3 Super', company: 'NVIDIA', persona: 'You are Nemotron 3 Super by NVIDIA. Respond as the powerful Nemotron model.', color: 'bg-lime-600', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'nemotron-3-super' }] },

  // Xiaomi
  { id: 'mimo-v2.5', label: 'MiMo V2.5', company: 'Xiaomi', persona: 'You are MiMo V2.5 by Xiaomi. Respond as the advanced MiMo model.', color: 'bg-rose-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'mimo-v2.5-p2g' }] },

  // Z.AI
  { id: 'glm-5.1', label: 'GLM 5.1', company: 'Z.AI', persona: 'You are GLM 5.1 by Z.AI. Respond as the advanced GLM model.', color: 'bg-teal-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'glm-5.1' }, { provider: 'LLM7', url: LLM7, model: 'GLM-4.6V-Flash' }] },
  { id: 'glm-5', label: 'GLM 5', company: 'Z.AI', persona: 'You are GLM 5 by Z.AI. Respond as the GLM 5 model.', color: 'bg-teal-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'glm-5' }] },

  // MiniMax
  { id: 'minimax-m2.7', label: 'MiniMax M2.7', company: 'MiniMax', persona: 'You are MiniMax M2.7 by MiniMax. Respond as the advanced MiniMax model.', color: 'bg-pink-500', routes: [{ provider: 'AirForce', url: AIRFORCE, model: 'minimax-m2.7' }] },
];

export const MODEL_MAP = Object.fromEntries(MODEL_CATALOG.map(m => [m.id, m]));

// Group models by company for the selector
export const MODELS_BY_COMPANY = MODEL_CATALOG.reduce<Record<string, ModelEntry[]>>((acc, m) => {
  (acc[m.company] ??= []).push(m);
  return acc;
}, {});

// ─── Fallback routes (when no model selected) ───────────────────────
const FALLBACK_ROUTES: ProxyRoute[] = [
  { provider: 'AirForce', url: AIRFORCE, model: 'gpt-4o-mini' },
  { provider: 'AirForce', url: AIRFORCE, model: 'deepseek-v3.2' },
  { provider: 'LLM7', url: LLM7, model: 'codestral-latest' },
  { provider: 'Pollinations', url: POLLINATIONS, model: 'openai' },
];

// ─── Paywall detection ──────────────────────────────────────────────
function isPaywalled(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('pay-as-you-go') || lower.includes('model does not exist') || lower.includes('insufficient quota');
}

// ─── Core AI Call ───────────────────────────────────────────────────
export async function callAI(
  messages: { role: string; content: string }[],
  signal: AbortSignal | undefined,
  modelEntry: ModelEntry | null
): Promise<{ content: string; modelLabel: string; provider: string }> {
  const routes = modelEntry ? modelEntry.routes : FALLBACK_ROUTES;
  const persona = modelEntry?.persona;
  const label = modelEntry?.label ?? 'Auto';

  const finalMessages = persona
    ? [{ role: 'system', content: persona }, ...messages]
    : messages;

  let lastError = '';

  for (const route of routes) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    try {
      if (route.provider === 'Pollinations') {
        // Pollinations: simple GET-style but we POST
        const text = finalMessages.map(m => m.content).join('\n\n');
        const res = await fetch(route.url + route.model, {
          method: 'GET',
          signal,
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) { lastError = `Pollinations ${res.status}`; continue; }
        const txt = await res.text();
        if (isPaywalled(txt)) { lastError = 'Paywalled'; continue; }
        if (!txt.trim()) { lastError = 'Empty'; continue; }
        return { content: txt, modelLabel: label, provider: route.provider };
      } else {
        // OpenAI-compatible (AirForce, LLM7)
        const res = await fetch(route.url, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: route.model,
            messages: finalMessages,
            max_tokens: 4096,
          }),
        });
        if (!res.ok) { lastError = `${route.provider} ${res.status}`; continue; }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) { lastError = `${route.provider} empty`; continue; }
        if (isPaywalled(content)) { lastError = `${route.provider} paywalled`; continue; }
        return { content, modelLabel: label, provider: route.provider };
      }
    } catch (e: any) {
      if (e.name === 'AbortError') throw e;
      lastError = e.message;
    }
  }

  throw new Error(`All routes failed. Last error: ${lastError}`);
}

// ─── TTS via Pollinations ───────────────────────────────────────────
export async function speakTTS(text: string, voice: string = 'alloy'): Promise<void> {
  try {
    const res = await fetch('https://text.pollinations.ai/openai/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai-audio', input: text, voice }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch {
    // TTS failure is non-critical, silently ignore
  }
}
