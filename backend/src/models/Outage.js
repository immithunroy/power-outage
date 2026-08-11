const mongoose = require('mongoose');

const outageSchema = new mongoose.Schema(
  {
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, default: null, index: true },
    durationMs: { type: Number, default: null },
  },
  { versionKey: false }
);

outageSchema.index({ startedAt: 1, endedAt: 1 });

module.exports = mongoose.model('Outage', outageSchema);