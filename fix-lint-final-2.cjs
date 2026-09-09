const { execSync } = require('child_process');
try {
  execSync('npm run lint');
  console.log('Lint passed.');
} catch (e) {
  console.log(e.stdout.toString());
}
