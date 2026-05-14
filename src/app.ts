import express from 'express';
import jobsRouter from './api/jobs.js';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
  });
});

app.use('/jobs', jobsRouter);

export default app;