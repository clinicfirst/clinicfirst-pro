import { config } from 'dotenv';
config();
console.log('SARVAM keys:', Object.keys(process.env).filter(k => k.includes('SARVAM')));
