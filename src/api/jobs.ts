import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Job } from '../models/job.js';

const router = Router();

const jobs: Record<string, Job> = {};

router.post('/', (req, res) => {
  const id = uuidv4();

  const job: Job = {
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  jobs[id] = job;

  res.json(job);
});

export default router;
