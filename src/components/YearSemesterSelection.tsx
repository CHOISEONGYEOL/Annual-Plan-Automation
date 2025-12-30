import React, { useState } from 'react';
import './YearSemesterSelection.css';

interface YearSemesterSelectionProps {
  onConfirm: (year: number, semester: 1 | 2) => void;
  onBack: () => void;
}

export const YearSemesterSelection: React.FC<YearSemesterSelectionProps> = ({ onConfirm, onBack }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [semester, setSemester] = useState<1 | 2>(1);

  // 현재 년도 기준 전후 5년 (총 11년)
  const years = [];
  for (let i = currentYear - 5; i <= currentYear + 5; i++) {
    years.push(i);
  }

  const handleConfirm = () => {
    onConfirm(year, semester);
  };

  return (
    <div className="year-semester-selection">
      <button className="btn-back" onClick={onBack}>← 뒤로</button>
      <h2>학년도 및 학기 선택</h2>
      
      <div className="form-group">
        <label>학년도</label>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="year-select"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>학기</label>
        <div className="semester-buttons">
          <button
            className={semester === 1 ? 'active' : ''}
            onClick={() => setSemester(1)}
          >
            1학기
          </button>
          <button
            className={semester === 2 ? 'active' : ''}
            onClick={() => setSemester(2)}
          >
            2학기
          </button>
        </div>
      </div>

      <button className="btn-confirm" onClick={handleConfirm}>
        다음 단계로
      </button>
    </div>
  );
};

