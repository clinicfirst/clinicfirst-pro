const fs = require('fs');

let service = fs.readFileSync('server/services/clinic.service.ts', 'utf8');
service = service.replace(/static async update/g, `static async create(clinic: Clinic): Promise<Clinic> {
    if (!supabase) {
      if (!db.data.clinics) db.data.clinics = [];
      db.data.clinics.push(clinic);
      db.flush();
      return clinic;
    }
    const { data, error } = await supabase.from('clinics').insert(clinic).select().single();
    if (error) throw new Error(error.message);
    return data;
  }\n\n  static async update`);
fs.writeFileSync('server/services/clinic.service.ts', service);

let content = fs.readFileSync('server/routes/platform.routes.ts', 'utf8');
content = content.replace(/throw new Error\("createClinic not implemented"\);/g, 'await ClinicService.create(newClinic);');
fs.writeFileSync('server/routes/platform.routes.ts', content);

