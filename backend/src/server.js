const express = require('express');
const cors = require('cors');
const config = require('./config');
const { connect } = require('./db');
const pinger = require('./services/pinger');
const growattService = require('./services/growattService');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/status'));
app.use('/api', require('./routes/stats'));
app.use('/api', require('./routes/settings'));
app.use('/api', require('./routes/growatt'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

app.use((err, _req, res, _next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

async function main() {
  await connect();
  await pinger.ensureLoop();
  await growattService.ensurePoller();
  app.listen(config.PORT, () => console.log(`[server] API listening on :${config.PORT}`));
}

main().catch((e) => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});