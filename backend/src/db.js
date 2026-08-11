const mongoose = require('mongoose');
const config = require('./config');

async function connect() {
  await mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('[db] connected to MongoDB');
}

module.exports = { connect };