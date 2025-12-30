// src/components/StudentTimetableViewer.tsx
import { useState } from 'react';
import type { School, StudentBaseTimetableRow } from '../types';
import { storage } from '../infra/supabase/storage';

interface StudentTimetableViewerProps {
  school: School;
  year: number;
  semester: 1 | 2;
}

const dayColumns = [
  { label: '월', value: 1 },
  { label: '화', value: 2 },
  { label: '수', value: 3 },
  { label: '목', value: 4 },
  { label: '금', value: 5 },
];

const periods = [1, 2, 3, 4, 5, 6, 7];

export const StudentTimetableViewer: React.FC<StudentTimetableViewerProps> = ({
  school,
  year,
  semester,
}) => {
  const [code, setCode] = useState('');
  const [rows, setRows] = useState<StudentBaseTimetableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleSearch = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      alert('학번을 입력해주세요. (예: 30601)');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const result = await storage.getStudentTimetableByStudentCode(
        school.id,
        year,
        semester,
        trimmed,
      );
      if (result.length === 0) {
        setRows([]);
        setErrorMsg('해당 학번의 시간표를 찾을 수 없습니다.');
      } else {
        setRows(result);
      }
    } catch (e) {
      console.error(e);
      const msg =
        e instanceof Error ? e.message : '시간표 조회 중 오류가 발생했습니다.';
      setErrorMsg(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
    
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getCell = (day: number, period: number) => {
    return rows.find((r) => r.dayOfWeek === day && r.period === period);
  };

  const firstRow = rows[0];

  return (
    <div style={{ marginTop: 24 }}>
      <h3>학생 시간표 조회 (학번으로)</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="예: 30601"
          style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', width: 140 }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: '8px 16px',
            borderRadius: 4,
            border: 'none',
            background: loading ? '#aaa' : '#007bff',
            color: '#fff',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? '조회 중...' : '조회'}
        </button>
      </div>

      {errorMsg && (
        <div
          style={{
            marginBottom: 12,
            padding: 8,
            borderRadius: 4,
            background: '#fdecea',
            color: '#b3261e',
            fontSize: 13,
          }}
        >
          {errorMsg}
        </div>
      )}

      {rows.length > 0 && firstRow && (
        <div style={{ marginTop: 8 }}>
          <p style={{ marginBottom: 8, fontSize: 14 }}>
            {school.name} / {year}년 {semester}학기 /{' '}
            {firstRow.grade}학년 {firstRow.classNumber}반 {firstRow.studentNumber}번{' '}
            {firstRow.studentName}
          </p>

          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              maxWidth: 600,
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: '1px solid #ccc',
                    padding: 4,
                    background: '#f5f5f5',
                    width: 50,
                  }}
                >
                  교시
                </th>
                {dayColumns.map((d) => (
                  <th
                    key={d.value}
                    style={{
                      border: '1px solid #ccc',
                      padding: 4,
                      background: '#f5f5f5',
                    }}
                  >
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p}>
                  <td
                    style={{
                      border: '1px solid #ccc',
                      padding: 4,
                      textAlign: 'center',
                      background: '#fafafa',
                    }}
                  >
                    {p}
                  </td>
                  {dayColumns.map((d) => {
                    const cell = getCell(d.value, p);
                    return (
                      <td
                        key={d.value}
                        style={{
                          border: '1px solid #ccc',
                          padding: 4,
                          verticalAlign: 'top',
                          minHeight: 32,
                        }}
                      >
                        {cell ? (
                          <>
                            <div>{cell.subject}</div>
                            {cell.teacherName && (
                              <div style={{ fontSize: 11, color: '#555' }}>
                                ({cell.teacherName})
                              </div>
                            )}
                          </>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
