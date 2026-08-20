const app = require('./app');

app().catch((error) => {
  console.error('[startup]', error);
  process.exit(1);
});
