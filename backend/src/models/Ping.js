const mongoose = require('mongoose');

const pingSchema = new mongoose.Schema(
  {
    ts: { type: Date, required: true },
    up: { type: Boolean, required: true },
    latency: { type: Number, default: null },
  },
  { versionKey: false }
);

pingSchema.index({ ts: 1 }, { expireAfterSeconds: 3 * 86400 });
pingSchema.index({ ts: 1, up: 1 });

module.exports = mongoose.model('Ping', pingSchema);