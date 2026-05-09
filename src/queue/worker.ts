import { Worker } from 'bullmq';
import prisma from '../db.js';

new Worker(
  'deduplication',
  async (job) => {
    console.log(`Processing job ${job.data.jobId}`);

    await prisma.job.update({
      where: {
        id: job.data.jobId,
      },
      data: {
        status: 'completed',
      },
    });

    console.log(`Completed job ${job.data.jobId}`);
  },
  {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  }
);
