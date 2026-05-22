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
import { logger } from '../utils/logger';

const upload = multer({
  dest: 'uploads/',

  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const router = Router();



router.post(
  '/',
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
      });
    }

    const waitingCount =
    await jobQueue.getWaitingCount();

    if (waitingCount > 100) {
      logger.warn({
        event: 'queue_overloaded',
        waitingCount,
      });
      return res.status(503).json({
        error:
          'System overloaded. Try again later.',
      });
    }

    const jobId = uuidv4();
    await redis.del('metrics');
    await prisma.job.create({
      data: {
        id: jobId,
        status: 'pending',
        filePath: req.file.path,

        uniqueCount: 0,
        duplicateCount: 0,
      },
    });

    await jobQueue.add(
      'process-job',
      {
        jobId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

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
