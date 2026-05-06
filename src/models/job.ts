export type JobStatus = 'pending' | 'processing' | 'completed';

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: string;
}
