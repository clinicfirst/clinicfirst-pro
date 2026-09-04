import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from '@google/genai';

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('API Key present:', Boolean(apiKey));
  if (!apiKey) return;

  const ai = new GoogleGenAI({ apiKey });
  console.log('Testing gemini-3.8-flash:');
  console.time('3.8-flash');
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ parts: [{ text: 'Say hello in 5 words' }] }]
    });
    console.timeEnd('3.8-flash');
    console.log('Result:', res.text);
  } catch (err: any) {
    console.timeEnd('3.8-flash');
    console.error('Error with 3.8-flash:', err.message);
  }

  console.log('\nTesting gemini-3.6-flash (the old hardcoded model):');
  console.time('3.6-flash');
  try {
    const res2 = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ parts: [{ text: 'Say hello in 5 words' }] }]
    });
    console.timeEnd('3.6-flash');
    console.log('Result:', res2.text);
  } catch (err: any) {
    console.timeEnd('3.6-flash');
    console.error('Error with 3.6-flash:', err.message);
  }
}

test().catch(console.error);
