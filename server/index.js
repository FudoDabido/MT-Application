require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const app = require('./app');
const { runMigrations } = require('./db/migrations');
const { checkAndNotifyUsers } = require('./utils/pushNotifications');

const PORT = process.env.PORT || 3001;

runMigrations();

// Push notification cron — check every minute, fires once in 21:00–21:10 window
setInterval(checkAndNotifyUsers, 60 * 1000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MT server running on http://localhost:${PORT}`);
});
