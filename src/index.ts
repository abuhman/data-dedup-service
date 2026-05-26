import express from 'express';
import jobsRouter from './api/jobs.js';
import prisma from './db.js';
import { logger } from './utils/logger.js';
import rateLimit
from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import { getCache, setCache } from './utils/cache';

const limiter = rateLimit({
  windowMs: 60 * 1000,

  max: 30,

  message: {
    error: 'Too many requests',
  },
});

const app = express();

app.use(express.json());
app.use('/jobs', limiter);
app.use('/auth', limiter);
app.use('/jobs', jobsRouter);
app.use('/auth', authRoutes);
console.log('AUTH ROUTES OBJECT:', authRoutes);

const PORT = 3000;

app.get('/', (_req, res) => {
  res.send('Server is running');
});

app.get('/health', (req, res) => {
  logger.info({
    requestId:
      req.headers['x-request-id'],
    route: '/health',
    event: 'health_check',
  });
  res.json({
    status: 'ok',
  });
});

app.get('/ready', async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ready',
    });
  } catch {
    res.status(503).json({
      status: 'not_ready',
    });
  }
});

app.get('/metrics', async (_req, res) => {
  let cached;

  try {
    cached = await getCache('metrics');
  } catch {
    cached = null;
  }

  if (cached) {
    return res.json(JSON.parse(cached));
  }

  let pending = 0;
  let processing = 0;
  let completed = 0;
  let failed = 0;

  try {
    [pending, processing, completed, failed] = await Promise.all([
      prisma.job.count({ where: { status: 'pending' } }),
      prisma.job.count({ where: { status: 'processing' } }),
      prisma.job.count({ where: { status: 'completed' } }),
      prisma.job.count({ where: { status: 'failed' } }),
    ]);
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ error: 'metrics_failed' });
  }

  const metrics = {
    jobs: { pending, processing, completed, failed },
    system: {
      uptimeSeconds: process.uptime(),
    },
  };

  try {
    await setCache('metrics', JSON.stringify(metrics), 30);
  } catch (err) {
    logger.error({ err });
  }

  return res.json(metrics);
});

logger.info({
  event: 'server_starting',
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});