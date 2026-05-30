import type { MarkRecord } from '../types';

interface Props {
  marks: MarkRecord[];
}

export default function ScoreSection({ marks }: Props) {
  if (marks.length === 0) return null;

  const totalScore = marks.reduce((sum, m) => sum + m.result.score, 0);
  const totalMarks = marks.reduce((sum, m) => sum + m.result.totalMarks, 0);
  const percentage = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0;
  const pagesMarked = marks.length;

  return (
    <div className="score-section">
      <div className="score-section-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span>Paper Score</span>
      </div>
      <div className="score-section-body">
        <div className="score-section-main">
          <span className="score-section-value">{totalScore}</span>
          <span className="score-section-divider">/</span>
          <span className="score-section-total">{totalMarks}</span>
        </div>
        <div className="score-section-meta">
          <span className="score-section-percentage">{percentage}%</span>
          <span className="score-section-pages">{pagesMarked} page{pagesMarked !== 1 ? 's' : ''} marked</span>
        </div>
      </div>
    </div>
  );
}
