import fs from 'fs';
import csv from 'csv-parser';

import { deduplicateRecords } from './deduplicate.js';
import type { RecordData } from './deduplicate.js';

export async function processFile(
  filePath: string
) {
  return new Promise((resolve, reject) => {
    const records: RecordData[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        records.push({
          name: data.name,
        });
      })
      .on('end', () => {
        const results = deduplicateRecords(records);

        resolve(results);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}
