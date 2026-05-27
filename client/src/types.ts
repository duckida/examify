export interface PDFInfo {
  id: string;
  filename: string;
  url: string;
}

export interface DrawingPath {
  id: string;
  points: { x: number; y: number }[];
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
}

export interface MarkRecord {
  pageNumber: number;
  result: MarkResult;
  timestamp: number;
}
