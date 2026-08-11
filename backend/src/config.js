require('dotenv').config();

module.exports = {
  PORT: Number(process.env.PORT) || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/outage',
  JWT_SECRET: process.env.JWT_SECRET || 'outage-watch-dev-secret',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'AdMin@123',
  DEFAULT_TARGET: process.env.TARGET || '8.8.8.8',
  DEFAULT_INTERVAL_MS: Number(process.env.PING_INTERVAL_MS) || 30000,
};