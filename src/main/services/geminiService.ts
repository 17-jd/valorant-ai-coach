import { GoogleGenerativeAI, GenerativeModel, Content, Part } from '@google/generative-ai';
import { GEMINI_MODEL, MAX_HISTORY_LENGTH } from '../../shared/constants';
import { CoachingTip } from '../../shared/types';
import { recordApiCall } from './costTrackingService';

let model: GenerativeModel | null = null;
let conversationHistory: Content[] = [];

// Session death log — tracks each death this session for pattern detection
const sessionDeathLog: string[] = [];

const SYSTEM_PROMPT = `You are an elite Valorant tactical coach providing real-time callouts during a competitive match. You are watching my screen.

RULES:
- Give ONLY 1-2 short actionable tips (max 15 words each)
- Use Valorant terminology (peek, jiggle, trade, lurk, rotate, default, retake, post-plant)
- Prioritize URGENCY: what should the player do RIGHT NOW
- Never explain "why" — only say WHAT to do
- Each tip on its own line, no bullets, no numbering
- If you see the spike, mention time pressure
- If economy (credits) is visible, factor that in
- If the round appears lost, say "save" or "exit"
- Do NOT repeat the same tip twice in a row

CONTEXT YOU CAN READ:
- Minimap (top-left): teammate/enemy positions
- Kill feed (top-right): who just died
- Health/shield (bottom): current HP
- Ability bar (bottom-center): available abilities
- Ammo (bottom-right): magazine status
- Score + timer (top-center): round state
- Economy (buy phase): credits
- Spike indicator: planted or carried`;

function buildDeathPrompt(): string {
  const hasHistory = sessionDeathLog.length > 0;

  const historySection = hasHistory
    ? `\n\nMY DEATHS THIS SESSION:\n${sessionDeathLog.map((d, i) => `Death ${i + 1}: ${d}`).join('\n')}\n`
    : '';

  const patternInstruction = hasHistory
    ? `\n4. Am I repeating a mistake pattern across my deaths? If yes, name it in one sentence.`
    : '';

  return `I just died. You are seeing my last ${sessionDeathLog.length > 0 ? 'several' : '5'} screenshots before death in chronological order (oldest first, most recent last).${historySection}

Analyze clearly and specifically:
1. What killed me and from where (one sentence, max 20 words)
2. What tactical mistake led to this death (one sentence, max 20 words)
3. What I should do differently next time (one sentence, max 20 words)${patternInstruction}

Be direct and specific. Use Valorant terminology. No filler words.`;
}

export function initializeGemini(apiKey: string): void {
  const genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });
  conversationHistory = [];
}

export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const testModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await testModel.generateContent('Say "ok" if you can read this.');
    return !!result.response.text();
  } catch {
    return false;
  }
}

export async function analyzeScreenshot(
  base64Image: string,
  isDeath: boolean = false
): Promise<CoachingTip> {
  if (!model) throw new Error('Gemini not initialized. Set API key first.');

  const userContent: Content = {
    role: 'user',
    parts: [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
      { text: isDeath ? buildDeathPrompt() : 'What should I do right now?' },
    ],
  };

  const messages: Content[] = [...conversationHistory, userContent];
  const result = await model.generateContent({ contents: messages });
  const response = result.response;
  const text = response.text().trim();

  const usage = response.usageMetadata;
  if (usage) {
    recordApiCall(usage.promptTokenCount ?? 0, usage.candidatesTokenCount ?? 0);
  }

  conversationHistory.push(userContent);
  conversationHistory.push({ role: 'model', parts: [{ text }] });

  while (conversationHistory.length > MAX_HISTORY_LENGTH * 2) {
    conversationHistory.shift();
    conversationHistory.shift();
  }

  if (isDeath) {
    // Save first line as session death summary
    const summary = text.split('\n')[0].replace(/^\d+\.\s*/, '').slice(0, 120);
    sessionDeathLog.push(summary);
  }

  return {
    id: `tip-${Date.now()}`,
    text,
    timestamp: Date.now(),
    isDeathAnalysis: isDeath,
  };
}

// Analyze death using rolling buffer — sends multiple screenshots at once
export async function analyzeDeathWithBuffer(screenshots: string[]): Promise<CoachingTip> {
  if (!model) throw new Error('Gemini not initialized. Set API key first.');

  const imageParts: Part[] = screenshots.map((base64) => ({
    inlineData: {
      mimeType: 'image/jpeg' as const,
      data: base64,
    },
  }));

  const userContent: Content = {
    role: 'user',
    parts: [
      ...imageParts,
      { text: buildDeathPrompt() },
    ],
  };

  const result = await model.generateContent({ contents: [userContent] });
  const response = result.response;
  const text = response.text().trim();

  const usage = response.usageMetadata;
  if (usage) {
    recordApiCall(usage.promptTokenCount ?? 0, usage.candidatesTokenCount ?? 0);
  }

  // Save first line as session death summary
  const summary = text.split('\n')[0].replace(/^\d+\.\s*/, '').slice(0, 120);
  sessionDeathLog.push(summary);

  return {
    id: `tip-${Date.now()}`,
    text,
    timestamp: Date.now(),
    isDeathAnalysis: true,
  };
}

export function clearSessionContext(): void {
  sessionDeathLog.length = 0;
  conversationHistory = [];
}

export function clearHistory(): void {
  conversationHistory = [];
}
