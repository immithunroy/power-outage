const mongoose = require('mongoose');

const outageSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['grid', 'generator'], default: 'grid' },
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, default: null, index: true },
    durationMs: { type: Number, default: null },
  },
  { versionKey: false }
);

outageSchema.index({ kind: 1, startedAt: 1, endedAt: 1 });

module.exports = mongoose.model('Outage', outageSchema);