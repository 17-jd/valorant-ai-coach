import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { GEMINI_MODEL, MAX_HISTORY_LENGTH } from '../../shared/constants';
import { CoachingTip } from '../../shared/types';
import { recordApiCall } from './costTrackingService';

let model: GenerativeModel | null = null;
let conversationHistory: Content[] = [];

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

const DEATH_PROMPT = `I just died. Based on this screenshot:
1. What likely killed me (one short sentence)
2. What I should do differently next time (one short sentence)
Keep both under 15 words each.`;

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
      { text: isDeath ? DEATH_PROMPT : 'What should I do right now?' },
    ],
  };

  // Build messages with history for context
  const messages: Content[] = [...conversationHistory, userContent];

  const result = await model.generateContent({ contents: messages });
  const response = result.response;
  const text = response.text().trim();

  // Track cost
  const usage = response.usageMetadata;
  if (usage) {
    recordApiCall(usage.promptTokenCount ?? 0, usage.candidatesTokenCount ?? 0);
  }

  // Update conversation history (sliding window)
  conversationHistory.push(userContent);
  conversationHistory.push({
    role: 'model',
    parts: [{ text }],
  });

  // Keep only last N exchanges (each exchange = 2 entries: user + model)
  while (conversationHistory.length > MAX_HISTORY_LENGTH * 2) {
    conversationHistory.shift();
    conversationHistory.shift();
  }

  return {
    id: `tip-${Date.now()}`,
    text,
    timestamp: Date.now(),
    isDeathAnalysis: isDeath,
  };
}

export function clearHistory(): void {
  conversationHistory = [];
}
