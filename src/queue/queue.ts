import { Queue } from 'bullmq';

export const jobQueue = new Queue('deduplication', {
  connection: {
    host: 'localhost',
    port: 6379,
  },
});
