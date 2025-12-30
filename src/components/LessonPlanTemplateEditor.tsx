// src/components/LessonPlanTemplateEditor.tsx
import React, { useEffect, useState } from 'react';
import { School, ClassSession, ExamSegment } from '../types';
import { storage } from '../infra/supabase/storage';
import { analyzeCommonPlanForSegment } from '../core/domain/sessions';
import { applyLessonTemplateToClassSessions } from '../infra/supabase/sessionProcessor';
import './LessonPlanTemplateEditor.css';

interface LessonPlanTemplateEditorProps {
  school: School;
  year: number;
  semester: 1 | 2;
  teacherId: string;
  teacherName: string;
  grade: number;
  subject: string;
  segment: ExamSegment; // 초기 활성 구간
  onClose: () => void;
}

type TemplateRow = {
  sessionIndex: number;
  content: string;
};

const getSegmentLabel = (segment: ExamSegment): string => {
  switch (segment) {
    case 'before_first':
      return '1차 지필 이전';
    case 'between_first_second':
      return '2차 지필 이전 (1~2차 사이)';
    case 'after_second':
      return '2차 지필 이후';
    default:
      return segment;
  }
};

export const LessonPlanTemplateEditor: React.FC<LessonPlanTemplateEditorProps> = ({
  school,
  year,
  semester,
  teacherId,
  teacherName,
  grade,
  subject,
  segment,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [minCount, setMinCount] = useState<number>(0);
  const [classNumbers, setClassNumbers] = useState<number[]>([]);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [extraContent, setExtraContent] = useState<string>('자습');

  // 탭으로 관리할 활성 세그먼트
  const [activeSegment, setActiveSegment] = useState<ExamSegment>(segment);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) 해당 교사/학년/과목의 모든 반 세션 조회
        const sessions: ClassSession[] =
          await storage.getClassSessionsByTeacherGradeSubject(
            school.id,
            year,
            semester,
            teacherId,
            grade,
            subject,
          );

        if (cancelled) return;

        if (sessions.length === 0) {
          alert('해당 조건의 수업 세션이 없습니다.\n먼저 수업 일정을 생성/처리해 주세요.');
          onClose();
          return;
        }

        // 2) 공통 계획 분석 (반 1개여도 허용: "반 존재" + "해당 구간 수업 존재"만 체크)
        const analysis = analyzeCommonPlanForSegment(sessions, activeSegment);

        const minCountValue =
          typeof analysis.minCount === 'number' ? analysis.minCount : 0;

        const classNumsValue = Array.isArray(analysis.classNumbers)
          ? analysis.classNumbers
          : [];

        if (classNumsValue.length === 0 || minCountValue <= 0) {
          alert(
            '이 교사/학년/과목 조합은 선택한 시험 구간에서 공통 수업 계획을 적용할 수 없습니다.\n' +
              (classNumsValue.length === 0
                ? '해당 조건의 반(수업)이 없습니다.'
                : '해당 구간에 수업이 없습니다.'),
          );
          onClose();
          return;
        }

        if (cancelled) return;

        setMinCount(minCountValue);
        setClassNumbers(classNumsValue);

        // 3) 기존 템플릿 로드 (활성 세그먼트 기준)
        const templates = await storage.getLessonPlanTemplates(
          school.id,
          year,
          semester,
          teacherId,
          grade,
          subject,
          activeSegment,
        );

        if (cancelled) return;

        // 4) 템플릿이 있든 없든, minCount 길이로 rows를 항상 정규화해서 만든다 (에러/불일치 방지)
        const templateMap = new Map<number, string>();
        for (const t of templates) {
          templateMap.set(t.sessionIndex, t.content);
        }

        const normalizedRows: TemplateRow[] = Array.from(
          { length: minCountValue },
          (_, idx) => {
            const sessionIndex = idx + 1;
            return {
              sessionIndex,
              content: templateMap.get(sessionIndex) ?? '',
            };
          },
        );

        setRows(normalizedRows);
      } catch (e) {
        console.error('[LessonPlanTemplateEditor] init error', e);
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : '초기화 중 알 수 없는 오류가 발생했습니다.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [school.id, year, semester, teacherId, grade, subject, activeSegment, onClose]);

  const handleChangeRow = (sessionIndex: number, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.sessionIndex === sessionIndex ? { ...row, content: value } : row,
      ),
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      await storage.saveLessonPlanTemplates(
        school.id,
        year,
        semester,
        teacherId,
        grade,
        subject,
        activeSegment,
        rows,
      );

      alert('공통 수업 계획 템플릿이 저장되었습니다.');
    } catch (e) {
      console.error('[LessonPlanTemplateEditor] save error', e);
      setError(e instanceof Error ? e.message : '템플릿 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (minCount <= 0) return;

    const ok = window.confirm(
      `지금 작성된 공통 수업 계획을\n` +
        `동일 교사/학년/과목의 모든 반에 적용합니다.\n\n` +
        `- 시험 구간: ${getSegmentLabel(activeSegment)}\n` +
        `- 해당 구간 최소 회차: ${minCount}회\n` +
        `- 반 목록: ${classNumbers.join(', ')}반\n\n` +
        `최소 회차 이후 회차(예: 13, 14회차)는 "${extraContent || '자습'}" 으로 채워집니다.\n\n` +
        `계속하시겠습니까?`,
    );

    if (!ok) return;

    try {
      setApplying(true);
      setError(null);

      // 1) 템플릿 저장 (활성 세그먼트 기준)
      await storage.saveLessonPlanTemplates(
        school.id,
        year,
        semester,
        teacherId,
        grade,
        subject,
        activeSegment,
        rows,
      );

      // 2) 세션에 적용 (활성 세그먼트 기준)
      await applyLessonTemplateToClassSessions({
        schoolId: school.id,
        year,
        semester,
        teacherId,
        grade,
        subject,
        segment: activeSegment,
        extraSessionsContent: extraContent || undefined,
      });

      alert('공통 수업 계획이 모든 반의 수업 세션에 적용되었습니다.');
    } catch (e) {
      console.error('[LessonPlanTemplateEditor] apply error', e);
      setError(
        e instanceof Error ? e.message : '공통 수업 계획 적용 중 오류가 발생했습니다.',
      );
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="lesson-plan-editor-backdrop">
        <div className="lesson-plan-editor">
          <h3>공통 수업 계획 템플릿</h3>
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-plan-editor-backdrop">
      <div className="lesson-plan-editor">
        <div className="lesson-plan-editor-header">
          <h3>
            공통 수업 계획 템플릿
            <small>
              {' '}
              - {school.name} / {year}년 {semester}학기 / {grade}학년 {subject} (
              {teacherName})
            </small>
          </h3>
          <button className="btn-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="lesson-plan-editor-tabs">
          <button
            className={
              'lesson-plan-editor-tab-button' +
              (activeSegment === 'before_first' ? ' active' : '')
            }
            onClick={() => setActiveSegment('before_first')}
            type="button"
          >
            1차 지필 이전
          </button>
          <button
            className={
              'lesson-plan-editor-tab-button' +
              (activeSegment === 'between_first_second' ? ' active' : '')
            }
            onClick={() => setActiveSegment('between_first_second')}
            type="button"
          >
            2차 지필 이전
          </button>
          {/* 필요하면 after_second 탭도 확장 */}
        </div>

        <div className="lesson-plan-editor-meta">
          <p>
            시험 구간:{' '}
            <strong>
              {getSegmentLabel(activeSegment)} ({activeSegment})
            </strong>{' '}
            / 최소 회차: <strong>{minCount}회</strong> / 대상 반:{' '}
            <strong>{classNumbers.join(', ')}반</strong>
          </p>
        </div>

        {error && <p className="lesson-plan-editor-error">에러: {error}</p>}

        <div className="lesson-plan-editor-body">
          <table className="lesson-plan-editor-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>회차</th>
                <th>수업 내용 (공통 계획)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sessionIndex}>
                  <td>{row.sessionIndex}</td>
                  <td>
                    <textarea
                      value={row.content}
                      onChange={(e) => handleChangeRow(row.sessionIndex, e.target.value)}
                      rows={2}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="lesson-plan-editor-extra">
            <label>
              최소 회차 이후 회차 내용(선택):
              <input
                type="text"
                value={extraContent}
                onChange={(e) => setExtraContent(e.target.value)}
                placeholder='예: "자습"'
              />
            </label>
          </div>
        </div>

        <div className="lesson-plan-editor-footer">
          <button
            className="btn-secondary"
            onClick={handleSave}
            disabled={saving || applying}
            type="button"
          >
            {saving ? '저장 중...' : '계획 저장'}
          </button>
          <button
            className="btn-primary"
            onClick={handleApply}
            disabled={saving || applying}
            type="button"
          >
            {applying ? '적용 중...' : '모든 반에 적용'}
          </button>
        </div>
      </div>
    </div>
  );
};
