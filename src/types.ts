export interface School {
  id: string;
  name: string;
}

export interface AcademicCalendar {
  id: string;
  schoolId: string;
  schoolName: string;
  year: number;
  semester: 1 | 2;
  events: CalendarEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string; // 고유 ID 추가
  date: string; // YYYY-MM-DD 형식
  type:
    | 'holiday'
    | 'midterm'
    | 'final'
    | 'recess'
    | 'custom'
    | 'direct'
    | 'substitute'
    | 'opening'
    | 'closing'
    | 'mocktest';
  name: string;
  grades: number[]; // 적용 학년 (1, 2, 3) - 기본값 [1, 2, 3] (모든 학년)
}

export interface SavedCalendar extends AcademicCalendar {
  savedAt: string; // 저장 시간
}

// 교사 시간표 관련 타입
export interface ClassSchedule {
  id: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  grade: number;
  classNumber: number;
  dayOfWeek: number; // 0=일요일, 1=월요일, ...
  period: number; // 1-7교시

  // Supabase 저장/조회용 메타데이터 (옵션)
  // teacher_schedules 테이블의 school_id, year, semester와 매핑
  schoolId?: string;
  year?: number;
  semester?: 1 | 2;
}

export interface ClassSession {
  sessionNumber: number | null; // 회차 (null이면 회차 없음 - 공휴일 등)
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // 요일
  period: number; // 교시
  classInfo: string; // "206 지Ⅰ" 형식 (학년반 과목)
  academicEvent: string; // 학사일정 (없으면 빈 문자열)
  content: string; // 수업 내용 (교사 입력)
  isBeforeFirstTest: boolean; // 1차 지필 이전 여부

  /**
   * 이 수업이 속한 시험 구간
   * - 없으면(미설정) 기존 플래그 기반 로직(isBeforeFirstTest 등)을 fallback으로 사용
   * - 'before_first'          : 1차 지필 전
   * - 'between_first_second'  : 1차~2차 지필 사이
   * - 'after_second'          : 2차 지필 이후
   */
  segment?: ExamSegment;

  // Supabase 저장/조회용 메타데이터 (옵션)
  id?: string; // class_sessions.id (uuid)
  schoolId?: string;
  year?: number;
  semester?: 1 | 2;
  teacherId?: string;
  teacherName?: string;
  grade?: number;
  classNumber?: number;
  subject?: string;
}

export interface ParsedSchedule {
  schoolId: string;
  year: number;
  semester: 1 | 2;
  teachers: ClassSchedule[];
}

/**
 * 시험 구간 구분 타입
 * - 'before_first'          : 1차 지필 전
 * - 'between_first_second'  : 1차~2차 지필 사이 (추후 확장용)
 * - 'after_second'          : 2차 지필 이후 (추후 확장용)
 */
export type ExamSegment = 'before_first' | 'between_first_second' | 'after_second';

/**
 * lesson_plan_templates 테이블 한 줄을 표현하는 타입
 * - Supabase lesson_plan_templates와 1:1 매핑
 */
export interface LessonPlanTemplate {
  id?: string;          // Supabase에서 생성된 uuid (신규 작성 시에는 없어도 됨)
  schoolId: string;
  year: number;
  semester: 1 | 2;

  teacherId: string;
  grade: number;
  subject: string;

  segment: ExamSegment; // 'before_first' 등
  sessionIndex: number; // 1, 2, 3, ...

  content: string;      // 해당 회차의 공통 수업 계획 내용
}


/**
 * 학생 기본 시간표 한 줄을 표현하는 타입
 * - Supabase student_timetables 테이블과 1:1 매핑용
 * - 엑셀 파서(studentTimetableParser) → Supabase 저장(storage.saveStudentTimetables)까지 공통으로 사용
 */
export interface StudentBaseTimetableRow {
  schoolId: string;
  year: number;
  semester: 1 | 2;

  grade: number;          // 학년
  classNumber: number;    // 반 (DB의 class_no)
  studentNumber: string;  // 번호 (엑셀 그대로 문자열로 두고, 저장 시 number로 변환)
  studentName: string;    // 학생 이름
  studentCode?: string;   // ✅ (옵션) 5자리 학생코드 예: "30601" (저장/디버깅용)

  dayOfWeek: number;      // 1=월, 2=화, ... 5=금
  period: number;         // 교시 (1~7 등)

  subject: string;        // 과목명
  teacherId?: string;     // 담당 교사 아이디 (옵션)
  teacherName?: string;   // 담당 교사 이름 (옵션)
  room?: string;          // 교실/특별실 (옵션)
}
