import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Job } from '../models/job.js';
import multer from 'multer';
import fs from 'fs';
import csv from 'csv-parser';
import { prisma } from '../db';

import { deduplicateRecords } from '../services/deduplicate.js';
import type {  RecordData,
} from '../services/deduplicate.js';
import { normalizeValue } from '../utils/normalize';

const upload = multer({ dest: 'uploads/' });

const router = Router();



router.post(
  '/',
  upload.single('file'),
  async (req, res) => {
    const records: RecordData[] = [];

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
      });
    }

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        records.push({
          name: data.name,
        });
      })
      .on('end', async () => {
        try {
          const results = deduplicateRecords(records);
      
          const jobId = uuidv4();
      
          await prisma.job.create({
            data: {
              id: jobId,
              status: 'completed',
              uniqueCount: results.uniqueRecords.length,
              duplicateCount: results.duplicates.length,
      
              results: {
                create: [
                  ...results.uniqueRecords.map((r) => ({
                    name: r.name,
                    normalizedName: normalizeValue(r.name),
                    isDuplicate: false,
                  })),
      
                  ...results.duplicates.map((r) => ({
                    name: r.name,
                    normalizedName: normalizeValue(r.name),
                    isDuplicate: true,
                  })),
                ],
              },
            },
          });
      
          fs.unlinkSync(req.file.path);
      
          res.json({
            jobId,
            uniqueRecords: results.uniqueRecords.length,
            duplicates: results.duplicates.length,
          });
        } catch (error) {
          console.error(error);
      
          res.status(500).json({
            error: 'Failed to process file',
          });
        }
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
