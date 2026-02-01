import cors from 'cors';
import express from 'express';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'kas-racing-server' });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
