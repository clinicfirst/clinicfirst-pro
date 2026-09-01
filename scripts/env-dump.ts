import dotenv from 'dotenv';
dotenv.config();
console.log(Object.keys(process.env).filter(k => k.includes('SUPA') || k.includes('DB') || k.includes('DATA')));
