const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);
const data = JSON.parse(fs.readFileSync('./data/clinicfirst.json', 'utf8'));

async function seedData() {
  console.log("Starting retry data migration to Supabase...");

  // Sanitize users
  if (data.users) {
    data.users = data.users.map(u => {
      const { doctor_id, ...rest } = u;
      return rest;
    });
  }

  // Sanitize patients
  if (data.patients) {
    data.patients = data.patients.map(p => {
      if (p.dob === "") p.dob = null;
      return p;
    });
  }

  // Sanitize appointments
  if (data.appointments) {
    data.appointments = data.appointments.map(a => {
      const { notes, ...rest } = a;
      return rest;
    });
  }

  // Sanitize calls
  if (data.calls) {
    data.calls = data.calls.map(c => {
      const { active_ai_config_version, ...rest } = c;
      return rest;
    });
  }

  const tables = ['users', 'patients', 'appointments', 'calls'];

  for (const table of tables) {
    const records = data[table];
    if (records && records.length > 0) {
      console.log(`Seeding ${records.length} records into '${table}'...`);
      const { error } = await supabase.from(table).upsert(records);
      
      if (error) {
        console.error(`Error inserting into ${table}:`, error.message);
      } else {
        console.log(`Successfully seeded ${table}.`);
      }
    }
  }
  
  console.log("Retry complete!");
}

seedData();
