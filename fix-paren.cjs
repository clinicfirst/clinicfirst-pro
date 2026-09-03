const fs = require('fs');

let clinic = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8');

clinic = clinic.replace(/          service_duration: service\?\.duration_minutes \|\| 30,\n        \};\n      \}\);\n\n      const upcomingToday/g, 
`          service_duration: service?.duration_minutes || 30,
        };
      }));

      const upcomingToday`);

clinic = clinic.replace(/          service_duration: service\?\.duration_minutes \|\| 30,\n        \};\n      \}\);\n\n      \/\/ Build a robust map/g, 
`          service_duration: service?.duration_minutes || 30,
        };
      }));

      // Build a robust map`);

fs.writeFileSync('server/routes/clinic.routes.ts', clinic);

// Let's also fix voice.routes.ts Promise.all parens
let voice = fs.readFileSync('server/routes/voice.routes.ts', 'utf8');
voice = voice.replace(/const doctor = await DoctorService\.getById\(clinic_id, a\.doctor_id\); return \{ \.\.\.a, doctor: doctor\?\.name \};\n        \}\)/g, 
`const doctor = await DoctorService.getById(clinic_id, a.doctor_id); return { ...a, doctor: doctor?.name };
        }))`);
fs.writeFileSync('server/routes/voice.routes.ts', voice);
