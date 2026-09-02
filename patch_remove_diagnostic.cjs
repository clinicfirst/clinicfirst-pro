const fs = require('fs');
let code = fs.readFileSync('server/app.ts', 'utf8');

const routeCode = `
import { supabase } from './supabaseDiff';
import { requireAuth } from './auth';
app.get('/api/diagnostic/verify-supabase', requireAuth, async (req, res) => {
  if (req.user?.role !== 'PLATFORM_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const configured = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  let clientInitialized = false;
  let connectionPass = false;
  if (supabase) {
    clientInitialized = true;
    try {
      const { data, error } = await supabase.from('platform_ai_config').select('id').limit(1);
      if (!error) connectionPass = true;
    } catch(e) {}
  }
  res.json({
    configured: configured ? 'YES' : 'NO',
    clientInitialized: clientInitialized ? 'YES' : 'NO',
    connectionPass: connectionPass ? 'PASS' : 'FAIL'
  });
});
`;

code = code.replace(routeCode, '');
fs.writeFileSync('server/app.ts', code);
