// One-off diagnostic — not imported by the app. Run manually (npm run
// verify:gemini) after rotating GEMINI_API_KEY to check whether the new key
// actually has gemini-2.5-pro quota, or is still flash-only like the
// previous key (see the comment block at the top of geminiClient.js for
// why MODEL_PRO is currently aliased to flash). Flip MODEL_PRO back to a
// real pro model only after this reports pro as working.
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-pro-latest'];

async function tryModel(client, model) {
  try {
    const response = await client.models.generateContent({
      model,
      contents: 'Reply with exactly one word: ok',
      config: { maxOutputTokens: 10, thinkingConfig: { thinkingBudget: 0 } },
    });
    return { model, ok: true, text: response.text?.trim() };
  } catch (err) {
    return { model, ok: false, error: err.message };
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in the environment. Nothing to verify.');
    process.exit(1);
  }
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log('Checking GEMINI_API_KEY against each model...\n');
  for (const model of MODELS_TO_TRY) {
    const result = await tryModel(client, model);
    if (result.ok) {
      console.log(`✅ ${model} — working (replied: "${result.text}")`);
    } else {
      console.log(`❌ ${model} — failed: ${result.error}`);
    }
  }
  console.log('\nIf gemini-2.5-pro (or gemini-pro-latest) shows ✅ above, update MODEL_PRO in server/agent/geminiClient.js accordingly.');
}

main();
