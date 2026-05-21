import { Worker } from 'bullmq';

import prisma from '../db.js';
import { processFile } from '../services/processFile.js';
import { normalizeValue } from '../utils/normalize.js';

import { deduplicateRecords } from '../services/deduplicate.js';
import type { RecordData } from '../services/deduplicate.js';
import fs from 'fs';
import { logger } from '../utils/logger';

let shuttingDown = false;
const worker = new Worker(
  'deduplication',
  async (job) => {
    try {
    const dbJob = await prisma.job.findUnique({
      where: {
        id: job.data.jobId,
      },
    });

    if (!dbJob || !dbJob.filePath) {
      throw new Error('Job file not found');
    }

    const claimedJob =
  await prisma.job.updateMany({
    where: {
      id: job.data.jobId,
      status: 'pending',
    },

    data: {
      status: 'processing',
      startedAt: new Date(),
      processingToken: crypto.randomUUID(),
    },
  });

  if (claimedJob.count === 0) {
    logger.info({
      jobId: job.data.jobId,
      route: '/worker',
      event: 'job_already_claimed',
    });
  
    return;
  }

    await prisma.result.deleteMany({
      where: {
        jobId: dbJob.id,
      },
    });

    const results = await Promise.race([
        processFile(dbJob.filePath),
      
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Processing timeout')),
            30000
          )
        ),
      ]);

    await prisma.$transaction(async (tx) => {
      await tx.result.deleteMany({
        where: {
          jobId: dbJob.id,
        },
      });
    
      await tx.result.createMany({
        data: [
          ...results.uniqueRecords.map((r) => ({
            name: r.name,
            normalizedName:
              normalizeValue(r.name),
            isDuplicate: false,
            jobId: dbJob.id,
          })),
    
          ...results.duplicates.map((r) => ({
            name: r.name,
            normalizedName:
              normalizeValue(r.name),
            isDuplicate: true,
            jobId: dbJob.id,
          })),
        ],
      });
    
      await tx.job.update({
        where: {
          id: dbJob.id,
        },
        data: {
          status: 'completed',
          completedAt: new Date(),
    
          uniqueCount:
            results.uniqueRecords.length,
    
          duplicateCount:
            results.duplicates.length,
        },
      });
    });

    logger.info({
      jobId: dbJob.id,
      status: 'processing_completed',
    });
    fs.unlinkSync(dbJob.filePath);

    } catch (error) {
      logger.error({
        jobId: job.data.jobId,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      });

      await prisma.job.updateMany({
        where: {
          id: job.data.jobId,
          status: 'processing',
        },
      
        data: {
          status: 'failed',
          failedReason:
            error instanceof Error
              ? error.message
              : 'Unknown error',
        },
      });
    
      throw error;
    }
  },
  {
    connection: {
      host: 'redis',
      port: 6379,
    },
    concurrency: 5,
  }
);
const shutdown = async () => {
    if (shuttingDown) {
      return;
    }
  
    shuttingDown = true;
  
    logger.info({
      event: 'worker_shutdown_started',
    });
  
    await worker.close();
  
    logger.info({
      event: 'worker_shutdown_completed',
    });
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);