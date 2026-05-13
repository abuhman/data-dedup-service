import { Worker } from 'bullmq';

import prisma from '../db.js';
import { processFile } from '../services/processFile.js';
import { normalizeValue } from '../utils/normalize.js';

import { deduplicateRecords } from '../services/deduplicate.js';
import type { RecordData } from '../services/deduplicate.js';
import fs from 'fs';

new Worker(
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

    await prisma.job.update({
      where: {
        id: dbJob.id,
      },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    });

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
    console.log(
      `Job already claimed: ${job.data.jobId}`
    );
  
    return;
  }

    await prisma.result.deleteMany({
      where: {
        jobId: dbJob.id,
      },
    });

    const results = await processFile(
      dbJob.filePath
    );

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

    console.log(
      `Completed processing ${dbJob.id}`
    );
    fs.unlinkSync(dbJob.filePath);

    } catch (error) {
      console.error(error);

      await prisma.job.update({
        where: {
          id: job.data.jobId,
          status: 'processing',
        }
      
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
      host: 'localhost',
      port: 6379,
    },
  }
);