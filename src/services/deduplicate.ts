import { normalizeValue } from '../utils/normalize';

export interface RecordData {
  name: string;
}

export interface DeduplicationResult {
  uniqueRecords: RecordData[];
  duplicates: RecordData[];
}

export function deduplicateRecords(
  records: RecordData[]
): DeduplicationResult {
  const seen = new Set<string>();

  const uniqueRecords: RecordData[] = [];
  const duplicates: RecordData[] = [];

  for (const record of records) {
    const normalized = normalizeValue(record.name);

    if (seen.has(normalized)) {
      duplicates.push(record);
    } else {
      seen.add(normalized);
      uniqueRecords.push(record);
    }
  }

  return {
    uniqueRecords,
    duplicates,
  };
}
