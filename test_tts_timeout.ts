import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from '@google/genai';

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('No GEMINI_API_KEY found');
    return;
  }
  const ai = new GoogleGenAI({ apiKey });

  console.log('Testing Audio TTS with gemini-3.6-flash:');
  const start = Date.now();
  try {
    const ttsResponse = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [{ parts: [{ text: 'Hello, welcome to our clinic.' }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_5S')), 5000))
    ]);
    console.log(`Audio succeeded in ${Date.now() - start}ms`);
  } catch (err: any) {
    console.log(`Audio failed/timed out in ${Date.now() - start}ms:`, err.message);
  }
}

test();
