export interface Citation {
  id: string; // e.g., "nurse-note-20251010-19.43.txt:FINAL REPORT"
  number: number; // Citation number [1], [2], etc.
  filename: string;
  section: string;
  timestamp?: string;
  content: string; // Full text of the relevant section
  context?: string;
}

export interface WardRoundData {
  markdown: string;
  citations: Record<string, Citation>;
  citation_count: number;
}