require('dotenv').config();
const app = require('./app');
const { runMigrations } = require('./db/migrations');

const PORT = process.env.PORT || 3001;

runMigrations();

app.listen(PORT, () => {
  console.log(`MT server running on http://localhost:${PORT}`);
});
