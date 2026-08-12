const mongoose = require('mongoose');

const pingSchema = new mongoose.Schema(
  {
    host: { type: String, enum: ['grid', 'generator', 'ips'], default: 'grid' },
    ts: { type: Date, required: true },
    up: { type: Boolean, required: true },
    latency: { type: Number, default: null },
  },
  { versionKey: false }
);

pingSchema.index({ host: 1, ts: 1 }, { expireAfterSeconds: 3 * 86400 });

module.exports = mongoose.model('Ping', pingSchema);