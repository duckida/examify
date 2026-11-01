export interface PDFInfo {
  id: string;
  filename: string;
  url: string;
  data?: string; // base64 of the raw file content (for mark scheme PDFs)
}

export interface DrawingPoint {
  x: number;
  y: number;
  /** Pressure-scaled stroke width at this point. Falls back to the path width. */
  w?: number;
}

export interface DrawingPath {
  id: string;
  points: DrawingPoint[];
  color: string;
  width: number;
}

export interface TextBoxData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  color: string;
}

export interface PageAnnotations {
  drawings: DrawingPath[];
  textBoxes: TextBoxData[];
}

export interface MarkResult {
  score: number;
  totalMarks: number;
  feedback: string;
  breakdown: { criterion: string; awarded: boolean; marks: number }[];
  howToGainMarks?: string;
}

export interface MarkRecord {
  pageNumber: number;
  result: MarkResult;
  timestamp: number;
}
