import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import jobsRouter from './routes/jobs.js';
import parseRouter from './routes/parse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/jobs', jobsRouter);
app.use('/api/parse', parseRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 生产环境托管前端
const clientDist = path.join(__dirname, '..', 'dist');
app.use(express.static(clientDist));
// SPA fallback（Express 5 语法）
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(clientDist, 'index.html'), err => { if (err) next(); });
});

app.listen(PORT, () => {
  console.log(`📋 秋招追踪 → http://localhost:${PORT}`);
  console.log(`💾 数据库: ${path.join(__dirname, '..', 'data', 'qiuzhao.db')}`);
});
