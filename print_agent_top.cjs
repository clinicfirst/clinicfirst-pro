const https = require('https');
const token = process.env.SANJEEVANI_TOKEN;

const options = {
  hostname: 'clinicfirst.vercel.app',
  port: 443,
  path: '/api/clinic/ai-agent',
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
};
const req = https.request(options, res => {
  let data = '';
  res.on('data', c => data+=c);
  res.on('end', () => {
    const json = JSON.parse(data);
    const { instructions_note, ...rest } = json.agent;
    console.log("Agent fields without huge instructions_note:", rest);
    console.log("provider_agent_id:", json.agent.provider_agent_id);
  });
});
req.end();
