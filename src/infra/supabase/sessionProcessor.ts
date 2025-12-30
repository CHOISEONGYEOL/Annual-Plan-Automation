// src/infra/supabase/sessionProcessor.ts

import { storage } from './storage';
import { generateClassSessions as generateClassSessionsForClass } from '../../utils/scheduleMatcher';
import type { ClassSchedule, SavedCalendar, ClassSession, ExamSegment } from '../../types';
import {
  analyzeCommonPlanForSegment,
  applyTemplateToSessions,
  LessonPlanTemplateRow,
} from '../../core/domain/sessions';

/**
 * 한 학교 / 학년도 / 학기의 모든 교사·학급에 대해
 * teacher_schedules + calendar 를 조합하여
 * class_sessions 테이블을 자동 생성하는 처리 함수.
 *
 * @returns 생성된(저장 시도한) ClassSession의 총 개수
 */
export async function processAllClassSessions(
  schoolId: string,
  year: number,
  semester: 1 | 2,
): Promise<number> {
  console.log('[sessionProcessor] start', { schoolId, year, semester });

  // 1) 해당 학기의 전체 교사 시간표 로드
  const schedules: ClassSchedule[] = await storage.getTeacherSchedules(schoolId, year, semester);
  console.log('[sessionProcessor] fetched schedules', { length: schedules.length });

  if (!schedules || schedules.length === 0) {
    console.warn(
      '[sessionProcessor] No teacher_schedules found for',
      { schoolId, year, semester },
    );
    return 0;
  }

  // 2) 해당 학기의 학사일정 로드
  const calendar: SavedCalendar | null = await storage.getCalendarFor(schoolId, year, semester);
  console.log(
    '[sessionProcessor] fetched calendar',
    calendar ? { id: calendar.id, events: calendar.events.length } : null,
  );

  if (!calendar) {
    console.warn(
      '[sessionProcessor] No calendar found for',
      { schoolId, year, semester },
    );
    return 0;
  }

  // 3) (teacherId, grade, classNumber) 기준으로 시간표 그룹핑
  type GroupKey = string;
  const groups = new Map<GroupKey, ClassSchedule[]>();

  const makeKey = (s: ClassSchedule): GroupKey =>
    `${s.teacherId}::${s.grade}::${s.classNumber}`;

  for (const schedule of schedules) {
    const key = makeKey(schedule);
    const existing = groups.get(key);
    if (existing) {
      existing.push(schedule);
    } else {
      groups.set(key, [schedule]);
    }
  }

  console.log('[sessionProcessor] grouped schedules', {
    groupCount: groups.size,
  });

  // 생성된 세션 총 개수
  let totalSessions = 0;

  // 4) 각 그룹(= 특정 교사/학급)에 대해 수업 일정 생성 + 저장
  for (const [key, groupSchedules] of groups.entries()) {
    if (groupSchedules.length === 0) continue;

    const sample = groupSchedules[0];
    const { teacherId, teacherName, grade, classNumber, subject } = sample;

    console.log('[sessionProcessor] processing group', {
      key,
      teacherId,
      teacherName,
      grade,
      classNumber,
      subject,
      scheduleCount: groupSchedules.length,
    });

    try {
      // 도메인 로직: 한 교사/학급에 대한 수업 회차 생성
      const classSessions = generateClassSessionsForClass(
        teacherId,
        grade,
        classNumber,
        schoolId,
        year,
        semester,
        groupSchedules,
        calendar,
      );

      console.log('[sessionProcessor] generated sessions', {
        key,
        count: classSessions.length,
      });

      if (!classSessions || classSessions.length === 0) {
        console.warn(
          '[sessionProcessor] No class sessions generated for group',
          { key, teacherId, grade, classNumber, subject },
        );
        continue;
      }

      totalSessions += classSessions.length;

      // Infra 저장: 기존 per-class 저장 유틸 재사용
      console.log('[sessionProcessor] saving sessions', {
        key,
        teacherId,
        grade,
        classNumber,
        subject,
        count: classSessions.length,
      });

      await storage.saveClassSessions(
        schoolId,
        year,
        semester,
        teacherId,
        teacherName,
        grade,
        classNumber,
        subject,
        classSessions,
      );

      console.log(
        '[sessionProcessor] Saved class sessions for',
        { teacherId, teacherName, grade, classNumber, subject },
      );
    } catch (error) {
      console.error(
        '[sessionProcessor] Error processing group',
        { key, teacherId, grade, classNumber, subject, error },
      );
      // 에러가 나도 다른 그룹은 계속 진행
    }
  }

  console.log('[sessionProcessor] done', {
    schoolId,
    year,
    semester,
    totalSessions,
  });

  return totalSessions;
}

/**
 * 공통 수업 계획 템플릿을 실제 class_sessions에 적용하는 배치 함수.
 *
 * - 대상: 특정 학교 / 학년도 / 학기 / 교사 / 학년 / 과목 / 구간(segment)
 * - 동작:
 *   1) 해당 조건의 class_sessions를 모두 조회
 *   2) 최소 회차 계산 (반이 2개 이상인 경우에만)
 *   3) lesson_plan_templates 조회
 *   4) 도메인 함수로 ClassSession[]에 content 적용
 *   5) 반(class_number)별로 저장 (기존 saveClassSessions를 활용)
 */
export async function applyLessonTemplateToClassSessions(params: {
  schoolId: string;
  year: number;
  semester: 1 | 2;
  teacherId: string;
  grade: number;
  subject: string;
  segment: ExamSegment;           // 예: 'before_first'
  extraSessionsContent?: string;  // 최소 회차 이후 회차 내용 (예: '자습')
}): Promise<void> {
  const {
    schoolId,
    year,
    semester,
    teacherId,
    grade,
    subject,
    segment,
    extraSessionsContent,
  } = params;

  console.log('[applyLessonTemplateToClassSessions] start', params);

  // 1) 여러 반의 세션 모두 조회
  const sessions = await storage.getClassSessionsByTeacherGradeSubject(
    schoolId,
    year,
    semester,
    teacherId,
    grade,
    subject,
  );

  if (sessions.length === 0) {
    console.log('[applyLessonTemplateToClassSessions] no sessions found');
    return;
  }

  // 2) 공통 계획 분석 (최소 회차, 반 개수 등)
  const analysis = analyzeCommonPlanForSegment(sessions, segment);

  if (!analysis.canUseCommonPlan || !analysis.minCount) {
    console.log(
      '[applyLessonTemplateToClassSessions] cannot use common plan',
      analysis,
    );
    return;
  }

  const minCount = analysis.minCount;

  // 3) 템플릿 조회
  const templates = await storage.getLessonPlanTemplates(
    schoolId,
    year,
    semester,
    teacherId,
    grade,
    subject,
    segment,
  );

  if (templates.length === 0) {
    console.log('[applyLessonTemplateToClassSessions] no templates found');
    return;
  }

  // LessonPlanTemplateRow 형태로 변환 (segment, sessionIndex, content만 사용)
  const templateRows: LessonPlanTemplateRow[] = templates.map((t) => ({
    segment: t.segment,
    sessionIndex: t.sessionIndex,
    content: t.content,
  }));

  // 4) 도메인 함수로 세션에 템플릿 적용
  const updatedSessions = applyTemplateToSessions(
    sessions,
    segment,
    templateRows,
    minCount,
    extraSessionsContent,
  );

  // 5) 반(class_number)별로 묶어서 저장
  const sessionsByClass = new Map<number, ClassSession[]>();

  for (const s of updatedSessions) {
    if (s.classNumber == null) continue;
    const list = sessionsByClass.get(s.classNumber) ?? [];
    list.push(s);
    sessionsByClass.set(s.classNumber, list);
  }

  for (const [classNumber, classSessions] of sessionsByClass.entries()) {
    const teacherName = classSessions[0]?.teacherName ?? '';
    const subj = classSessions[0]?.subject ?? subject;

    console.log(
      '[applyLessonTemplateToClassSessions] saving class',
      classNumber,
      'sessions:',
      classSessions.length,
    );

    await storage.saveClassSessions(
      schoolId,
      year,
      semester,
      teacherId,
      teacherName,
      grade,
      classNumber,
      subj,
      classSessions,
    );
  }

  console.log('[applyLessonTemplateToClassSessions] done');
}