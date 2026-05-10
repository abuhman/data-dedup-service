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
      },
    });

    const results = await processFile(
      dbJob.filePath
    );

    await prisma.result.createMany({
      data: [
        ...results.uniqueRecords.map((r) => ({
          name: r.name,
          normalizedName: normalizeValue(r.name),
          isDuplicate: false,
          jobId: dbJob.id,
        })),

        ...results.duplicates.map((r) => ({
          name: r.name,
          normalizedName: normalizeValue(r.name),
          isDuplicate: true,
          jobId: dbJob.id,
        })),
      ],
    });

    await prisma.job.update({
      where: {
        id: dbJob.id,
      },
      data: {
        status: 'completed',
        uniqueCount:
          results.uniqueRecords.length,
        duplicateCount:
          results.duplicates.length,
      },
    });

    console.log(
      `Completed processing ${dbJob.id}`
    );
    fs.unlinkSync(dbJob.filePath);
  },
  {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  }
);