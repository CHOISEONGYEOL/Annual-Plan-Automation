// src/components/StudentTimetableUpload.tsx
import { useState } from 'react';
import type { School, StudentBaseTimetableRow } from '../types';
import './StudentTimetableUpload.css';


// 🔹 실제 파서 & Supabase 저장 로직 import
import { parseStudentTimetable } from '../infra/excel/studentTimetableParser';
import { storage } from '../infra/supabase/storage';
import { StudentTimetableViewer } from './StudentTimetableViewer';


interface StudentTimetableUploadProps {
  school: School;
  year: number;
  semester: 1 | 2;
  onBack: () => void;
}

type UploadStatus = 'idle' | 'parsing' | 'saving' | 'done' | 'error';

export const StudentTimetableUpload: React.FC<StudentTimetableUploadProps> = ({
  school,
  year,
  semester,
  onBack,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState<string>('');
  

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
  
    setFiles(selectedFiles);
    setStatus('idle');
  
    if (selectedFiles.length === 0) {
      setMessage('');
    } else if (selectedFiles.length === 1) {
      setMessage(`선택된 파일: ${selectedFiles[0].name}`);
    } else {
      setMessage(`선택된 파일 ${selectedFiles.length}개`);
    }
  };
  
  const handleUpload = async () => {
    if (!files.length) {
      alert('학생별 수업시간표 엑셀 파일을 먼저 선택해주세요.');
      return;
    }
  
    const ok = window.confirm(
      `${school.name} / ${year}년 ${semester}학기 학생 시간표를 업로드합니다.\n` +
        `기존에 저장된 동일 학기 학생 시간표 데이터는 모두 삭제 후 새로 저장됩니다.\n\n계속하시겠습니까?`,
    );
    if (!ok) return;
  
    try {
      setStatus('parsing');
      setMessage(`엑셀 파일 ${files.length}개를 분석하는 중입니다...`);
  
      const allRows: StudentBaseTimetableRow[] = [];
      const failedFiles: string[] = [];
  
      for (const f of files) {
        try {
          const rows = await parseStudentTimetable(f, {
            schoolId: school.id,
            year,
            semester,
          });
          if (rows && rows.length > 0) allRows.push(...rows);
        } catch (e: any) {
          failedFiles.push(`${f.name}: ${e?.message ?? '알 수 없는 오류'}`);
        }
      }
  
      if (allRows.length === 0) {
        setStatus('error');
        setMessage(
          failedFiles.length > 0
            ? `모든 파일 파싱에 실패했습니다.\n${failedFiles.slice(0, 5).join('\n')}`
            : '엑셀에서 유효한 학생 시간표 데이터를 찾지 못했습니다.',
        );
        return;
      }
  
      // ✅ 중복 방어(저장 전에 한번 더)
      const dedup = new Map<string, StudentBaseTimetableRow>();
      for (const r of allRows) {
        const key = [
          r.schoolId,
          r.year,
          r.semester,
          r.grade,
          r.classNumber,
          r.studentNumber,
          r.dayOfWeek,
          r.period,
        ].join('|');
        if (!dedup.has(key)) dedup.set(key, r);
      }
      const cleaned = Array.from(dedup.values());
  
      setStatus('saving');
      setMessage(`DB에 ${cleaned.length}개의 학생 시간표 행을 저장하는 중입니다...`);
  
      await storage.saveStudentTimetables(cleaned);
  
      setStatus('done');
      setMessage(
        `학생 시간표 업로드 및 저장 완료: 총 ${cleaned.length}행 저장됨 (원본 ${allRows.length}행, 중복 제거 ${allRows.length - cleaned.length}행).\n` +
          (failedFiles.length > 0
            ? `\n단, 일부 파일은 파싱 실패했습니다:\n${failedFiles.slice(0, 5).join('\n')}`
            : ''),
      );
    } catch (err: any) {
      console.error(err);
      const msg =
        err?.message
          ? `업로드 중 오류가 발생했습니다: ${err.message}${err.code ? ` (code: ${err.code})` : ''}`
          : '업로드 중 알 수 없는 오류가 발생했습니다.';
      setStatus('error');
      setMessage(msg);
    }
  };
  
  
  const isUploading = status === 'parsing' || status === 'saving';

  return (
    <div className="student-timetable-upload" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>학생 시간표 입력</h2>
      <p style={{ marginBottom: 4 }}>
        <strong>{school.name}</strong> / {year}년 {semester}학기
      </p>
      <p style={{ marginBottom: 16, fontSize: 13, color: '#555' }}>
        나이스에서 내려받은
        <br />
        <strong>
          “{year}학년도 {semester}학기 {school.name} 학생별 수업시간표”
        </strong>{' '}
        엑셀 파일을 업로드해주세요.
      </p>

      <div
        style={{
          padding: 16,
          border: '1px solid #ddd',
          borderRadius: 8,
          background: '#fafafa',
          marginBottom: 16,
        }}
      >
        <div style={{ marginBottom: 8 }}>
        <input
  type="file"
  accept=".xlsx,.xls"
  multiple
  onChange={handleFileChange}
/>

        </div>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 0 }}>
          · 파일 형식: 엑셀(.xlsx / .xls)
          <br />
          · 경로: <code> 나이스 - 학급담임 - 교육과정 - 시간표 관리 - 학생별 시간표 조회 - 학기 선택 - 학년 선택 - 반 선택 - 수업 시간표 체크 - 조회 - 전체 학생 선택 - 선택 출력 - XLS data 파일로 저장</code>
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            border: '1px solid #ccc',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          ← 달력으로 돌아가기
        </button>
        <button
  type="button"
  onClick={handleUpload}
  disabled={!files.length || isUploading}
  style={{
    padding: '8px 16px',
    borderRadius: 4,
    border: 'none',
    background: !files.length || isUploading ? '#aaa' : '#007bff',
    color: 'white',
    cursor: !files.length || isUploading ? 'default' : 'pointer',
  }}
>
  {isUploading ? '처리 중...' : '학생 시간표 업로드'}
</button>

      </div>

      {status !== 'idle' && (
        <div
          style={{
            padding: 12,
            borderRadius: 6,
            fontSize: 13,
            background:
              status === 'done'
                ? '#e6f4ea'
                : status === 'error'
                ? '#fdecea'
                : '#eef3ff',
            color:
              status === 'done'
                ? '#137333'
                : status === 'error'
                ? '#b3261e'
                : '#1a3b7c',
          }}
        >
          <strong>[{status}]</strong> {message}
        </div>
      )}

<StudentTimetableViewer school={school} year={year} semester={semester} />
    </div>
  );
};
