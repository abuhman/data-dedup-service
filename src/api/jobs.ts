import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Job } from '../models/job.js';
import multer from 'multer';
import fs from 'fs';
import csv from 'csv-parser';
import prisma from '../db.js';

import { deduplicateRecords } from '../services/deduplicate.js';
import type {  RecordData,
} from '../services/deduplicate.js';
import { normalizeValue } from '../utils/normalize.js';
import { jobQueue } from '../queue/queue.js';

const upload = multer({ dest: 'uploads/' });

const router = Router();



router.post(
  '/',
  upload.single('file'),
  async (req, res) => {
    const jobId = uuidv4();

    await prisma.job.create({
      data: {
        id: jobId,
        status: 'pending',
        uniqueCount: 0,
        duplicateCount: 0,
      },
    });

    await jobQueue.add('process-job', {
      jobId,
    });

    res.json({
      jobId,
      status: 'pending',
    });
  }
);

router.get('/:id', async (req, res) => {
  const job = await prisma.job.findUnique({
    where: {
      id: req.params.id,
    },
    include: {
      results: true,
    },
  });

  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
    });
  }

  res.json(job);
});

export default router;
