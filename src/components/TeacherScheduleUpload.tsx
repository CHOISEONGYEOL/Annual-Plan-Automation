import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { School, ClassSchedule, ClassSession } from '../types';
import { parseExcelFile } from '../infra/excel/excelParser';
import { generateClassSessions } from '../utils/scheduleMatcher';
import { storage } from '../infra/supabase/storage';
import { ClassSessionTable } from './ClassSessionTable';
import './TeacherScheduleUpload.css';
import { processAllClassSessions } from '../infra/supabase/sessionProcessor';
import { LessonPlanTemplateEditor } from './LessonPlanTemplateEditor';


interface TeacherScheduleUploadProps {
  school: School;
  year: number;
  semester: 1 | 2;
  onBack: () => void;
}

type ViewMode = 'plan' | 'timetable' | null;

export const TeacherScheduleUpload: React.FC<TeacherScheduleUploadProps> = ({
  school,
  year,
  semester,
  onBack,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 선택 상태
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<number | ''>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<number | ''>('');

  // 🔍 교사 검색 관련 상태
  const [teacherSearchTerm, setTeacherSearchTerm] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // 🔀 기능 분기: 학급별 진도 계획표 / 교사 시간표
  const [viewMode, setViewMode] = useState<ViewMode>(null);
  const [isPlanEditorOpen, setIsPlanEditorOpen] = useState(false);

  // =========================
  // 초기 로드: 기존 시간표 불러오기
  // =========================
  useEffect(() => {
    const loadExistingSchedules = async () => {
      try {
        const existing = await storage.getTeacherSchedules(school.id, year, semester);
        if (existing.length > 0) {
          setSchedules(existing);
          console.log(`Loaded ${existing.length} teacher schedules from DB`);
        }
      } catch (error) {
        console.error('Error loading existing teacher schedules:', error);
      }
    };

    loadExistingSchedules();
  }, [school.id, year, semester]);

  // =========================
  // 공통 리셋 함수
  // =========================
  const resetSelections = () => {
    setSelectedTeacher('');
    setSelectedGrade('');
    setSelectedSubject('');
    setSelectedClass('');
    setHighlightedIndex(-1);
    setSessions([]);
    setViewMode(null);
  };

  // =========================
  // 파일 업로드 처리
  // =========================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      setSchedules([]);
      resetSelections();
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('파일을 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    try {
      // 엑셀 파일 파싱
      const parsedSchedules = await parseExcelFile(selectedFile);
      setSchedules(parsedSchedules);

      // Supabase에 저장
      await storage.saveTeacherSchedules(school.id, year, semester, parsedSchedules);

      alert(
        `파일 파싱 완료!\n총 ${parsedSchedules.length}개의 시간표 항목을 찾았습니다.\nSupabase에 저장되었습니다.`,
      );
    } catch (error) {
      console.error('Error in handleUpload:', error);
      alert(
        `파일 파싱 또는 저장 실패: ${
          error instanceof Error ? error.message : '알 수 없는 오류'
        }`,
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // 해당 학교 / 학년도 / 학기의 모든 교사·학급 수업 일정을 한 번에 생성/저장
  const handleProcessAll = async () => {
    console.log('[handleProcessAll] click', {
      schoolId: school.id,
      year,
      semester,
      isProcessing,
    });

    if (isProcessing) {
      console.log('[handleProcessAll] ignored because isProcessing is true');
      return; // 중복 클릭 방지
    }

    const ok = window.confirm(
      '이 학교 / 학년도 / 학기의 모든 교사 수업 일정을 다시 생성하여 저장합니다.\n' +
        '기존 class_sessions 데이터는 교사·학급 단위로 덮어씁니다.\n\n계속하시겠습니까?',
    );
    if (!ok) {
      console.log('[handleProcessAll] user cancelled by confirm dialog');
      return;
    }

    console.log('[handleProcessAll] start processing', {
      schoolId: school.id,
      year,
      semester,
    });

    setIsProcessing(true);
    try {
      console.log('[handleProcessAll] calling processAllClassSessions');
      await processAllClassSessions(school.id, year, semester);
      console.log('[handleProcessAll] processAllClassSessions resolved without error');

      alert(
        '전체 수업 일정 처리가 완료되었습니다.\n' +
          '각 교사/학급의 class_sessions가 Supabase에 저장되었습니다.',
      );
    } catch (error) {
      console.error('[handleProcessAll] ERROR from processAllClassSessions', error);
      alert(
        `수업 일정 처리 중 오류가 발생했습니다.\n\n${
          error instanceof Error ? error.message : '알 수 없는 오류'
        }`,
      );
    } finally {
      setIsProcessing(false);
      console.log('[handleProcessAll] done (finally)', {
        schoolId: school.id,
        year,
        semester,
      });
    }
  };

  // =========================
  // 교사 검색 및 선택
  // =========================
  const teacherOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const s of schedules) {
      if (!map.has(s.teacherId)) {
        map.set(s.teacherId, { id: s.teacherId, name: s.teacherName });
      }
    }
    return Array.from(map.values());
  }, [schedules]);

  const filteredTeacherOptions = useMemo(() => {
    const term = teacherSearchTerm.trim().toLowerCase();
    if (!term) return teacherOptions;
    return teacherOptions.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        t.id.toLowerCase().includes(term),
    );
  }, [teacherOptions, teacherSearchTerm]);

  useEffect(() => {
    if (teacherSearchTerm.trim() && !selectedTeacher && filteredTeacherOptions.length > 0) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [teacherSearchTerm, selectedTeacher, filteredTeacherOptions.length]);

  const handleSelectTeacher = (teacher: { id: string; name: string }) => {
    setSelectedTeacher(teacher.id);
    setTeacherSearchTerm(`${teacher.name} (${teacher.id})`);
    setSelectedGrade('');
    setSelectedSubject('');
    setSelectedClass('');
    setSessions([]);
    setHighlightedIndex(-1);
    setViewMode(null);
  };

  const handleTeacherInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const term = teacherSearchTerm.trim();
    if (!term || selectedTeacher || filteredTeacherOptions.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        if (prev === -1) return 0;
        return (prev + 1) % filteredTeacherOptions.length;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        if (prev === -1) return filteredTeacherOptions.length - 1;
        return (prev - 1 + filteredTeacherOptions.length) % filteredTeacherOptions.length;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredTeacherOptions.length) {
        const teacher = filteredTeacherOptions[highlightedIndex];
        handleSelectTeacher(teacher);
      }
    }
  };

  // =========================
  // 선택된 교사의 시간표 (시간표 보기용)
  // =========================
  const selectedTeacherSchedules = useMemo(
    () => schedules.filter((s) => s.teacherId === selectedTeacher),
    [schedules, selectedTeacher],
  );

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

  const selectedTeacherName =
    schedules.find((s) => s.teacherId === selectedTeacher)?.teacherName || '';

  // =========================
  // Supabase에서 수업 일정 로딩 (DB 기반 조회)
  // =========================
  const loadSessionsFromDB = useCallback(
    async (silent = false): Promise<boolean> => {
      if (!selectedTeacher || !selectedGrade || !selectedClass) {
        if (!silent) {
          alert('교사, 학년, 반을 모두 선택해주세요.');
        }
        return false;
      }
  
      // 여기서부터 추가
      // subject 계산: 선택한 과목이 있으면 그걸 우선 사용,
      // 없으면 schedules에서 해당 교사/학년/반의 과목을 하나 찾아서 사용
      const subject =
        selectedSubject ||
        schedules.find(
          (s) =>
            s.teacherId === selectedTeacher &&
            s.grade === selectedGrade &&
            s.classNumber === selectedClass,
        )?.subject ||
        '';
      // 여기까지 추가
  
      try {
        const dbSessions = await storage.getClassSessions(
          school.id,
          year,
          semester,
          selectedTeacher,
          selectedGrade as number,
          selectedClass as number,
          // 여기서부터 추가
          subject,
          // 여기까지 추가
        );
  
        if (dbSessions.length === 0) {
          if (!silent) {
            alert(
              '해당 교사/학년/반에 대한 수업 일정 데이터가 없습니다.\n' +
                '"처리" 버튼으로 전체 수업 일정을 먼저 생성해주세요.',
            );
          }
          setSessions([]);
          return false;
        }
  
        setSessions(dbSessions);
        return true;
      } catch (error) {
        console.error('Error loading class sessions from DB:', error);
        if (!silent) {
          alert(
            `수업 일정 조회 중 오류가 발생했습니다.\n\n${
              error instanceof Error ? error.message : '알 수 없는 오류'
            }`,
          );
        }
        return false;
      }
    },
    [
      school.id,
      year,
      semester,
      selectedTeacher,
      selectedGrade,
      selectedClass,
      // 여기서부터 추가
      selectedSubject,
      schedules,
      // 여기까지 추가
    ],
  );
  
  // =========================
  // 학급별 진도 계획표 선택이 완료되면 자동으로 DB에서 로드
  // =========================
  useEffect(() => {
    if (viewMode !== 'plan') return;
    if (!selectedTeacher || !selectedGrade || !selectedSubject || !selectedClass) return;
    if (isProcessing) return;

    // 자동 로딩 시에는 silent 모드로 (경고창 방지)
    loadSessionsFromDB(true);
  }, [
    viewMode,
    selectedTeacher,
    selectedGrade,
    selectedSubject,
    selectedClass,
    isProcessing,
    loadSessionsFromDB,
  ]);

  // =========================
  // 수업 일정 생성 (DB 우선, 없으면 기존 generateClassSessions fallback)
  // =========================
  const handleGenerateSessions = async () => {
    if (!selectedTeacher || !selectedGrade || !selectedSubject || !selectedClass) {
      alert('교사, 학년, 과목, 반을 모두 선택해주세요.');
      return;
    }

    // 1) 먼저 DB에서 조회 시도 (processAllClassSessions가 완료된 경우)
    const loadedFromDB = await loadSessionsFromDB(false);
    if (loadedFromDB) {
      // 이미 DB에 생성된 일정이 있으면 그대로 사용
      return;
    }

    // 2) DB에 없으면 기존 방식대로 프론트에서 직접 생성 (기존 기능 유지용 fallback)
    const calendarId = `${school.id}_${year}_${semester}`;
    const calendar = await storage.getCalendarById(calendarId);

    if (!calendar) {
      alert('먼저 학사일정을 저장해주세요.');
      return;
    }

    // 선택된 교사/학년/과목/반에 해당하는 시간표만 사용
    const targetSchedules = schedules.filter(
      (s) =>
        s.teacherId === selectedTeacher &&
        s.grade === selectedGrade &&
        s.subject === selectedSubject &&
        s.classNumber === selectedClass,
    );

    if (targetSchedules.length === 0) {
      alert('선택한 조건에 해당하는 시간표 항목이 없습니다.');
      return;
    }

    const generatedSessions = generateClassSessions(
      selectedTeacher,
      selectedGrade as number,
      selectedClass as number,
      school.id,
      year,
      semester,
      targetSchedules,
      calendar,
    );

    setSessions(generatedSessions);

    alert(
      `수업 일정 생성 완료!\n총 ${generatedSessions.length}개의 세션이 생성되었습니다.\n`,
    );
  };

  // =========================
  // 수업 일정 전체 저장
  // =========================
  const handleSaveAllSessions = async () => {
    if (sessions.length === 0) {
      alert('저장할 수업 일정이 없습니다. 먼저 수업 일정을 생성해주세요.');
      return;
    }

    if (!selectedTeacher || !selectedGrade || !selectedClass) {
      alert('교사, 학년, 반 정보가 없습니다. 다시 선택 후 수업 일정을 생성해주세요.');
      return;
    }

    const teacherName =
      schedules.find((s) => s.teacherId === selectedTeacher)?.teacherName || '';

    const subject =
      selectedSubject ||
      schedules.find(
        (s) =>
          s.teacherId === selectedTeacher &&
          s.grade === selectedGrade &&
          s.classNumber === selectedClass,
      )?.subject ||
      '';

    try {
      await storage.saveClassSessions(
        school.id,
        year,
        semester,
        selectedTeacher,
        teacherName,
        selectedGrade as number,
        selectedClass as number,
        subject,
        sessions,
      );

      alert(
        `수업 일정 전체 저장 완료!\n총 ${sessions.length}개의 세션을 Supabase에 저장했습니다.`,
      );
    } catch (error) {
      console.error('Error saving class sessions:', error);
      alert(
        `수업 일정 저장 중 오류가 발생했습니다.\n\n${
          error instanceof Error ? error.message : '알 수 없는 오류'
        }`,
      );
    }
  };

  const handleContentChange = (index: number, content: string) => {
    const newSessions = [...sessions];
    newSessions[index].content = content;
    setSessions(newSessions);
  };

  // =========================
  // 렌더링
  // =========================
  return (
    <div className="teacher-schedule-upload">
      <div className="upload-header">
        <button className="btn-back" onClick={onBack}>
          ← 뒤로
        </button>
        <div className="header-info">
          <h2>
            {school.name} - {year}년 {semester}학기
          </h2>
          <p className="subtitle">교사 시간표 입력</p>
        </div>
      </div>

      <div className="upload-container">
        {/* 왼쪽: 파일 업로드 */}
        <div className="upload-section">
          <h3>Excel 파일 업로드</h3>
          <p className="description">
            교사 시간표가 포함된 Excel 파일(.xls, .xlsx)을 업로드해주세요.
          </p>

          {schedules.length > 0 && !selectedFile && (
            <p className="info-text">
              이미 이 학교 / 학년도 / 학기의 시간표가 저장되어 있습니다.
              <br />
              아래의 <strong>수업 일정 생성</strong> 영역에서 바로 사용하거나,
              새 파일을 업로드하면 기존 시간표를 덮어씁니다.
            </p>
          )}

          <div className="file-guide">
            <p className="guide-title">📋 파일 다운로드 안내</p>
            <p className="guide-text">
              나이스 시스템에서 다음 경로로 파일을 다운로드하세요:
            </p>
            <div className="guide-path">
              <p>
                <strong>나이스</strong> &gt; <strong>교과담임</strong> &gt;{' '}
                <strong>교육과정</strong> &gt; <strong>시간표 관리</strong> &gt;{' '}
                <strong>학기 선택</strong> &gt; <strong>전체 출력</strong> &gt;{' '}
                <strong>조회</strong> &gt; <strong>XLS data 파일로 저장</strong>
              </p>
            </div>
          </div>

          <div className="file-upload-area">
            <input
              type="file"
              id="file-upload"
              accept=".xls,.xlsx"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-upload" className="file-upload-label">
              <div className="upload-icon">📄</div>
              <div className="upload-text">
                {fileName || '파일을 선택하거나 여기에 드래그하세요'}
              </div>
              <div className="upload-button">파일 선택</div>
            </label>
          </div>

          {fileName && (
            <div className="file-info">
              <p>
                선택된 파일: <strong>{fileName}</strong>
              </p>
            </div>
          )}

          <div className="upload-actions">
            {/* 업로드 버튼: 엑셀 파싱 + teacher_schedules 저장 */}
            <button
              className="btn-upload"
              onClick={handleUpload}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? '진행 중...' : '업로드'}
            </button>

            {/* 처리 버튼: DB에 저장된 teacher_schedules + calendars로 전체 수업 일정 생성 */}
            <button
              className="btn-process"
              onClick={handleProcessAll}
              disabled={isProcessing}
            >
              {isProcessing ? '진행 중...' : '처리'}
            </button>
          </div>
        </div>

        {/* 오른쪽: 수업 일정 / 시간표 영역 */}
        {schedules.length > 0 && (
          <div className="selection-section">
            <h3>수업 일정 / 교사 시간표</h3>
            <div className="selection-form">
              <div className="form-row">
                {/* 교사 선택 */}
                <div className="form-group">
                  <label>교사 선택</label>

                  <input
                    type="text"
                    className="teacher-search-input"
                    placeholder="교사 이름 또는 아이디를 입력하세요"
                    value={teacherSearchTerm}
                    onChange={(e) => {
                      setTeacherSearchTerm(e.target.value);
                      resetSelections();
                    }}
                    onKeyDown={handleTeacherInputKeyDown}
                  />

                  {teacherSearchTerm.trim() &&
                    !selectedTeacher &&
                    filteredTeacherOptions.length > 0 && (
                      <ul className="teacher-suggestions">
                        {filteredTeacherOptions.map((t, index) => (
                          <li key={t.id}>
                            <button
                              type="button"
                              className={
                                'teacher-suggestion-item' +
                                (index === highlightedIndex ? ' highlighted' : '')
                              }
                              onClick={() => handleSelectTeacher(t)}
                            >
                              {t.name} ({t.id})
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>

                {/* 기능 선택 및 학년/과목/반 선택 (plan 모드) */}
                {selectedTeacher && (
                  <>
                    <div className="form-group">
                      <label>기능 선택</label>
                      <div className="mode-toggle-buttons">
                        <button
                          type="button"
                          className={
                            'mode-toggle-button' + (viewMode === 'plan' ? ' active' : '')
                          }
                          onClick={() => {
                            setViewMode('plan');
                            setSessions([]);
                          }}
                        >
                          학급별 진도 계획표
                        </button>
                        <button
                          type="button"
                          className={
                            'mode-toggle-button' +
                            (viewMode === 'timetable' ? ' active' : '')
                          }
                          onClick={() => {
                            setViewMode('timetable');
                            setSessions([]);
                          }}
                        >
                          교사 시간표 생성
                        </button>
                      </div>
                    </div>

                    {viewMode === 'plan' && (
                      <>
                        {/* 학년 선택 */}
                        <div className="form-group">
                          <label>학년</label>
                          <select
                            value={selectedGrade}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSelectedGrade(value ? parseInt(value, 10) : '');
                              setSelectedSubject('');
                              setSelectedClass('');
                              setSessions([]);
                            }}
                          >
                            <option value="">학년 선택</option>
                            {Array.from(
                              new Set(
                                schedules
                                  .filter((s) => s.teacherId === selectedTeacher)
                                  .map((s) => s.grade),
                              ),
                            ).map((grade) => (
                              <option key={grade} value={grade}>
                                {grade}학년
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 과목 선택 (학년 선택 후) */}
                        {selectedGrade && (
                          <div className="form-group">
                            <label>과목</label>
                            <select
                              value={selectedSubject}
                              onChange={(e) => {
                                setSelectedSubject(e.target.value);
                                setSelectedClass('');
                                setSessions([]);
                              }}
                            >
                              <option value="">과목 선택</option>
                              {Array.from(
                                new Set(
                                  schedules
                                    .filter(
                                      (s) =>
                                        s.teacherId === selectedTeacher &&
                                        s.grade === selectedGrade,
                                    )
                                    .map((s) => s.subject),
                                ),
                              ).map((subject) => (
                                <option key={subject} value={subject}>
                                  {subject}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* 반 선택 (학년 + 과목 선택 후) */}
                        {selectedGrade && selectedSubject && (
                          <div className="form-group">
                            <label>반</label>
                            <select
                              value={selectedClass}
                              onChange={(e) => {
                                const value = e.target.value;
                                setSelectedClass(value ? parseInt(value, 10) : '');
                                setSessions([]);
                              }}
                            >
                              <option value="">반 선택</option>
                              {Array.from(
                                new Set(
                                  schedules
                                    .filter(
                                      (s) =>
                                        s.teacherId === selectedTeacher &&
                                        s.grade === selectedGrade &&
                                        s.subject === selectedSubject,
                                    )
                                    .map((s) => s.classNumber),
                                ),
                              )
                                .sort((a, b) => a - b)
                                .map((classNum) => (
                                  <option key={classNum} value={classNum}>
                                    {classNum}반
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}

                        {/* 수업 일정 생성 버튼 (교사+학년+과목+반 선택 완료 후) */}
                        {selectedGrade && selectedSubject && selectedClass && (
                          <div className="form-group">
                            <button
                              className="btn-generate"
                              onClick={handleGenerateSessions}
                            >
                              수업 일정 생성
                            </button>
                          </div>
                        )}

                                                {/* 여기서부터 추가: 공통 수업 계획 템플릿 편집 버튼 */}
                                                {selectedTeacher &&
                          viewMode === 'plan' &&
                          selectedGrade &&
                          selectedSubject && (
                            <div className="form-group">
                              <button
                                type="button"
                                className="btn-plan-template"
                                onClick={() => setIsPlanEditorOpen(true)}
                              >
                                공통 수업 계획 템플릿 편집
                              </button>
                            </div>
                          )}
                        {/* 여기까지 추가 */}

                      </>
                    )}
                  </>
                )}
              </div>

              {/* 교사 시간표 보기 (timetable 모드) */}
              {selectedTeacher && viewMode === 'timetable' && (
                <div className="teacher-timetable-section">
                  <h4>{selectedTeacherName} 교사 시간표</h4>
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
              )}
            </div>
          </div>
        )}
      </div>

      {/* 생성된 세션 테이블 + 전체 저장 버튼 */}
      {sessions.length > 0 && (
        <div className="sessions-section">
          <ClassSessionTable
            sessions={sessions}
            teacherName={
              schedules.find((s) => s.teacherId === selectedTeacher)?.teacherName ||
              ''
            }
            classInfo={`${selectedGrade}${String(selectedClass).padStart(
              2,
              '0',
            )} ${
              selectedSubject ||
              schedules.find(
                (s) =>
                  s.teacherId === selectedTeacher &&
                  s.grade === selectedGrade &&
                  s.classNumber === selectedClass,
              )?.subject ||
              ''
            }`}
            onContentChange={handleContentChange}
          />

          <div className="sessions-actions">
            <button className="btn-save-all" onClick={handleSaveAllSessions}>
              전체 저장
            </button>
          </div>
        </div>
      )}
      {/* 여기서부터 추가: 공통 수업 계획 템플릿 에디터 */}
      {isPlanEditorOpen &&
        selectedTeacher &&
        selectedGrade &&
        selectedSubject && (
          <LessonPlanTemplateEditor
            school={school}
            year={year}
            semester={semester}
            teacherId={selectedTeacher}
            teacherName={
              schedules.find((s) => s.teacherId === selectedTeacher)?.teacherName ||
              ''
            }
            grade={selectedGrade as number}
            subject={selectedSubject}
            segment="before_first"
            onClose={() => setIsPlanEditorOpen(false)}
          />
        )}
      {/* 여기까지 추가 */}


    </div>
  );
};
