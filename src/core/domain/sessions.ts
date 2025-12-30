// src/core/domain/sessions.ts
import {
  ClassSchedule,
  ClassSession,
  CalendarEvent,
  ExamSegment,
  LessonPlanTemplate,
} from '../../types';

export type GenerateSessionsParams = {
  schedules: ClassSchedule[];      // 특정 교사/학년/반만 필터된 것
  calendarEvents: CalendarEvent[]; // 해당 학교/연도/학기 학사일정
  schoolId: string;
  year: number;
  semester: 1 | 2;
  teacherId: string;
  teacherName: string;
  grade: number;
  classNumber: number;
  subject: string;
};

/**
 * 도메인 레이어용 수업 회차 생성 함수.
 *
 * 현재 실제 구현은 src/utils/scheduleMatcher.ts의 generateClassSessions에 있고,
 * 이 함수는 아직 플로우에 연결되지 않은 상태입니다.
 *
 * 새 플로우(전체 자동 처리)는 기존 scheduleMatcher를 그대로 사용하고,
 * 추후 안정화 후 이 함수에 순수 로직을 이관하는 방향으로 리팩터링하는 것을 권장합니다.
 */
export function generateClassSessions(_params: GenerateSessionsParams): ClassSession[] {
  // TODO: 순수 비즈니스 로직을 이곳으로 옮겨올 예정.
  // 지금은 기존 동작을 건드리지 않기 위해 빈 구현을 유지합니다.
  return [];
}

/**
 * 공통 수업 계획(최소 회차) 분석 결과
 * - 같은 교사 / 같은 학년 / 같은 과목에 대해
 *   여러 반의 ClassSession[]을 넣고 분석한 값
 */
export interface CommonPlanAnalysis {
  canUseCommonPlan: boolean; // 공통 계획을 쓸 의미가 있는지 (반이 2개 이상인지 등)
  minCount: number | null;   // 해당 구간의 최소 회차 수 (공통 계획을 쓸 때만 의미 있음)
  classNumbers: number[];    // 포함된 반 번호 목록 (예: [6, 7, 8, 9, 10])
}

/**
 * 주어진 세그먼트(예: 1차 지필 전)에 대해
 * 공통 계획을 적용할 수 있는지, 최소 회차가 몇 회인지 분석합니다.
 *
 * 전제:
 * - sessions에는 이미 같은 schoolId/year/semester/teacherId/grade/subject 조합만 들어 있다고 가정
 * - classNumber가 반을 구분하는 기준
 */
export function analyzeCommonPlanForSegment(
  sessions: ClassSession[],
  segment: ExamSegment,
): CommonPlanAnalysis {
  // 반 목록 추출 (grade는 모두 동일하다고 가정, classNumber만 다름)
  const classSet = new Set<number>();

  for (const s of sessions) {
    if (s.classNumber == null) continue;
    classSet.add(s.classNumber);
  }

  const classNumbers = Array.from(classSet).sort((a, b) => a - b);

// 반이 0개면 분석 불가
if (classNumbers.length === 0) {
  return {
    canUseCommonPlan: false,
    minCount: null,
    classNumbers,
  };
}
// ✅ 반이 1개여도 계속 진행


  /**
   * 세그먼트에 해당하면서, 실제 수업 회차(sessionNumber)가 있는 세션만 사용한다.
   * - isSessionInSegment: 해당 시험 구간 필터링
   * - sessionNumber == null 인 행(개학식/시험일/방학식 등 특별 행)은 제외
   */
  const filtered = sessions.filter(
    (s) =>
      isSessionInSegment(s, segment) &&
      s.classNumber != null &&
      s.sessionNumber != null,
  );

  // 해당 구간에 유효한 수업 회차가 아예 없으면 공통 계획 의미 없음
  if (filtered.length === 0) {
    return {
      canUseCommonPlan: false,
      minCount: null,
      classNumbers,
    };
  }

  /**
   * 반별로 sessionNumber의 '최대값' 계산
   * - 예: before_first 구간에서
   *   6반: sessionNumber 1~15 → max = 15
   *   7반: sessionNumber 1~15 → max = 15
   */
  const maxByClass = new Map<number, number>();

  for (const s of filtered) {
    const classNum = s.classNumber as number;
    const n = s.sessionNumber as number;

    const prevMax = maxByClass.get(classNum) ?? 0;
    if (n > prevMax) {
      maxByClass.set(classNum, n);
    }
  }

  // 실제 회차가 잡힌 반이 2개 미만이면 공통 계획 의미 없음
// ✅ 실제 회차가 잡힌 반이 0개면(=해당 구간 수업 없음)만 실패
if (maxByClass.size < 1) {
  return {
    canUseCommonPlan: false,
    minCount: null,
    classNumbers,
  };
}

  /**
   * 각 반의 '최대 회차' 중 최소값이 공통 계획의 최소 회차
   * - 예:
   *   6반: max = 15, 7반: max = 16 → minCount = 15
   */
  let minCount = Infinity;
  for (const maxCount of maxByClass.values()) {
    if (maxCount < minCount) {
      minCount = maxCount;
    }
  }

  return {
    canUseCommonPlan: true,
    minCount: Number.isFinite(minCount) ? minCount : null,
    classNumbers,
  };
}

/**
 * 주어진 세그먼트에 속하는 세션인지 판단하는 헬퍼
 *
 * 우선순위:
 * 1) ClassSession.segment 필드가 지정되어 있으면 그 값을 신뢰한다.
 * 2) segment가 없을 때만, 기존 플래그 기반 로직(isBeforeFirstTest 등)을 사용한다.
 *
 * - 'before_first'          : 1차 지필 전
 * - 'between_first_second'  : 1차~2차 지필 사이
 * - 'after_second'          : 2차 지필 이후
 */
function isSessionInSegment(session: ClassSession, segment: ExamSegment): boolean {
  // 1) 새로 도입된 segment 필드가 있으면 이 값을 우선 사용
  if (session.segment != null) {
    return session.segment === segment;
  }

  // 2) segment가 아직 설정되지 않은 기존 데이터/로직에 대한 fallback
  switch (segment) {
    case 'before_first':
      // 기존 로직: 1차 지필 이전 여부 플래그
      return session.isBeforeFirstTest === true;

      case 'between_first_second':
        /**
         * [구데이터 fallback]
         * - segment 필드가 없는 경우(1학기 과거 데이터)는
         *   1차 지필 이전 여부만 isBeforeFirstTest로 가지고 있다.
         * - 따라서 "1차 지필 이후(isBeforeFirstTest === false)"를
         *   1차~2차 사이 구간으로 간주한다.
         *   (정확한 2차 이후 구분은 불가능하므로, after_second는 fallback에서 포기)
         */
        return session.isBeforeFirstTest === false;
  

    case 'after_second':
      // TODO: 2차 이후 구간을 나타내는 플래그가 생기면 여기에서 사용
      return false;

    default:
      return false;
  }
}

/**
 * 템플릿 한 줄을 나타내는 도메인 타입
 * - LessonPlanTemplate에서 필요한 필드만 사용
 */
export type LessonPlanTemplateRow = Pick<
  LessonPlanTemplate,
  'segment' | 'sessionIndex' | 'content'
>;

/**
 * 공통 수업 계획 템플릿을 실제 ClassSession들에 적용하는 함수
 *
 * 입력:
 * - sessions: 특정 (schoolId, year, semester, teacherId, grade, subject)에 대한
 *             여러 반의 ClassSession[]
 * - segment:  적용할 시험 구간 (예: 'before_first')
 * - templates: 템플릿 행들 (segment, sessionIndex, content)
 * - minCount:  해당 구간의 최소 회차 수 (예: 12회)
 * - extraSessionsContent:
 *     - 최소 회차를 초과하는 회차(예: 13, 14회차)에 대해 content를 어떻게 할지
 *     - '자습'처럼 공통 텍스트를 넣고 싶으면 값 지정
 *     - undefined이면 기존 content를 그대로 둠
 *
 * 출력:
 * - 템플릿이 적용된 새로운 ClassSession[] (원본은 변경하지 않음)
 */
export function applyTemplateToSessions(
  sessions: ClassSession[],
  segment: ExamSegment,
  templates: LessonPlanTemplateRow[],
  minCount: number,
  extraSessionsContent?: string,
): ClassSession[] {
  if (minCount <= 0) {
    // 최소 회차가 0 이하이면 아무 것도 적용하지 않고 원본 그대로 반환
    return sessions.slice();
  }

  // 원본 배열 복제 (불변성 유지)
  const updated: ClassSession[] = sessions.map((s) => ({ ...s }));

  // 템플릿을 sessionIndex 기준으로 빠르게 찾을 수 있도록 맵 구성
  const templateByIndex = new Map<number, LessonPlanTemplateRow>();
  for (const t of templates) {
    if (t.segment !== segment) continue;
    if (t.sessionIndex < 1) continue;
    templateByIndex.set(t.sessionIndex, t);
  }

  // 각 세션을 순회하면서,
  // - segment가 일치하고
  // - sessionNumber가 있는 경우에만
  // 회차 번호(sessionNumber) 기준으로 템플릿/extra 내용을 매칭해서 적용
  sessions.forEach((session, idx) => {
    // 반 정보가 없으면 스킵
    if (session.classNumber == null) return;

    // 현재 segment(예: before_first / between_first_second)가 아니면 스킵
    // - 신규 데이터: session.segment 기반
    // - 구데이터: isBeforeFirstTest 기반 fallback 사용
    if (!isSessionInSegment(session, segment)) return;


    // 회차 번호가 없는 행(개학식, 시험 시작일, 방학식 등)은 건드리지 않음
    if (session.sessionNumber == null || session.sessionNumber <= 0) return;

    const n = session.sessionNumber;

    // 1) 최소 회차 이하인 경우: 해당 회차 템플릿을 적용
    if (n <= minCount) {
      const template = templateByIndex.get(n);
      if (!template) return;

      updated[idx] = {
        ...updated[idx],
        content: template.content,
      };
      return;
    }

    // 2) 최소 회차를 초과하는 회차(예: 13, 14회차 등)
    //    extraSessionsContent가 지정된 경우에만 덮어씀
    if (extraSessionsContent) {
      updated[idx] = {
        ...updated[idx],
        content: extraSessionsContent,
      };
    }
  });

  return updated;
}

/**
 * 편의용: 세그먼트별 최소 회차만 필요할 때
 */
export function computeMinSessionsBySegment(
  sessions: ClassSession[],
  segment: ExamSegment,
): number | null {
  const analysis = analyzeCommonPlanForSegment(sessions, segment);
  return analysis.minCount;
}
