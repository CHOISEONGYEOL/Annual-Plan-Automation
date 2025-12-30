import React, { useMemo } from 'react';
import { ClassSchedule } from '../types';

interface TeacherTimetableProps {
  schedules: ClassSchedule[];
  teacherId: string;
  teacherName?: string;
}

export const TeacherTimetable: React.FC<TeacherTimetableProps> = ({
  schedules,
  teacherId,
  teacherName,
}) => {
  // 선택된 교사의 시간표만 필터링
  const selectedTeacherSchedules = useMemo(
    () => schedules.filter((s) => s.teacherId === teacherId),
    [schedules, teacherId],
  );

  if (!teacherId || selectedTeacherSchedules.length === 0) {
    return null;
  }

  const dayColumns = [
    { label: '월', value: 1 },
    { label: '화', value: 2 },
    { label: '수', value: 3 },
    { label: '목', value: 4 },
    { label: '금', value: 5 },
  ];
  const periods = [1, 2, 3, 4, 5, 6, 7];

  const getCellText = (dayOfWeek: number, period: number) => {
    const cell = selectedTeacherSchedules.filter(
      (s) => s.dayOfWeek === dayOfWeek && s.period === period,
    );
    if (cell.length === 0) return '';
    return cell
      .map(
        (s) => `${s.grade}${String(s.classNumber).padStart(2, '0')} ${s.subject}`,
      )
      .join('\n');
  };

  const displayName =
    teacherName ||
    selectedTeacherSchedules[0]?.teacherName ||
    teacherId;

  return (
    <div className="teacher-timetable-section">
      <h4>{displayName} 교사 시간표</h4>
      <table className="teacher-timetable-table">
        <thead>
          <tr>
            <th>교시</th>
            {dayColumns.map((d) => (
              <th key={d.value}>{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p}>
              <td>{p}</td>
              {dayColumns.map((d) => (
                <td key={d.value}>
                  {getCellText(d.value, p)
                    .split('\n')
                    .map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
