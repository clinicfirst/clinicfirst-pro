const fs = require('fs');

let clinic = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8');
clinic = clinic.replace(/          \};\n        \}\)\n        \.sort/g, '          };\n        }))\n        .sort');
fs.writeFileSync('server/routes/clinic.routes.ts', clinic);

