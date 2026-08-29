const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("FAILURE: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from the environment variables.");
  process.exit(1);
}

const supabase = createClient(url, key);
const data = JSON.parse(fs.readFileSync('./data/clinicfirst.json', 'utf8'));

async function seedData() {
  console.log("Starting data migration to Supabase...");

  const tables = [
    'clinics',
    'users',
    'doctors',
    'doctor_schedules',
    'doctor_leaves',
    'services',
    'doctor_services',
    'patients',
    'appointments',
    'ai_agents',
    'calls',
    'audit_logs',
    'platform_knowledge_base'
  ];

  for (const table of tables) {
    const records = data[table];
    if (records && records.length > 0) {
      console.log(`Seeding ${records.length} records into '${table}'...`);
      // Supabase insert supports an array of objects
      const { error } = await supabase.from(table).upsert(records);
      
      if (error) {
        console.error(`Error inserting into ${table}:`, error.message);
      } else {
        console.log(`Successfully seeded ${table}.`);
      }
    } else {
      console.log(`No records found for '${table}', skipping.`);
    }
  }
  
  console.log("Migration complete!");
}

seedData();
