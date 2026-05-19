import { Queue } from 'bullmq';

export const jobQueue = new Queue('deduplication', {
  connection: {
    host: 'redis',
    port: 6379,
  },
});
