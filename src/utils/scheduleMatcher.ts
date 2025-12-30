// src/utils/scheduleMatcher.ts
import {
  ClassSchedule,
  CalendarEvent,
  ClassSession,
  SavedCalendar,
  ExamSegment,
} from '../types';
import { formatDate } from './holidays';

// 요일 이름 변환
const getDayOfWeekName = (dayOfWeek: number): string => {
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return days[dayOfWeek];
};

// 이 이벤트가 특정 학년(grade)에 해당하는지 여부
// - grades가 없거나 빈 배열이면 "전체 학년 공통"으로 간주
// - grades가 있으면 해당 학년이 포함된 경우에만 true
const isEventForGrade = (event: CalendarEvent, grade: number): boolean => {
  if (!event.grades || event.grades.length === 0) {
    return true;
  }
  return event.grades.includes(grade);
};

// 특정 날짜가 공휴일, 시험일, 재량휴업일, 모의고사, 직접입력인지 확인 (학년 기준)
const isNonClassDay = (
  date: Date,
  events: CalendarEvent[],
  grade: number,
): { isNonClass: boolean; eventName: string } => {
  const dateStr = formatDate(date);

  // 날짜 + 학년이 모두 맞는 이벤트만 대상으로 삼는다
  const dayEvents = events.filter(
    (e) => e.date === dateStr && isEventForGrade(e, grade),
  );

  // 공휴일, 시험일, 재량휴업일, 모의고사, 직접입력 확인
  for (const event of dayEvents) {
    if (
      event.type === 'holiday' || // 공휴일
      event.type === 'midterm' || // 1차 지필
      event.type === 'final' || // 2차 지필
      event.type === 'recess' || // 재량휴업일
      event.type === 'substitute' || // 대체공휴일
      event.type === 'mocktest' || // 모의고사
      event.type === 'direct' // 직접 입력 이벤트(수업 없는 날로 처리)
    ) {
      return { isNonClass: true, eventName: event.name };
    }
  }

  return { isNonClass: false, eventName: '' };
};

// 1차/2차 지필평가 날짜 찾기 (학년 구분 없이 전체 이벤트 기준)
// 다른 곳에서 쓸 수 있으니 시그니처/동작은 그대로 둔다.
export const findTestDates = (
  events: CalendarEvent[],
): { firstTest: string | null; secondTest: string | null } => {
  let firstTest: string | null = null;
  let secondTest: string | null = null;

  // 날짜순으로 정렬
  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));

  for (const event of sortedEvents) {
    if (event.type === 'midterm' && !firstTest) {
      firstTest = event.date;
    }
    if (event.type === 'final' && !secondTest) {
      secondTest = event.date;
    }
  }

  return { firstTest, secondTest };
};

// 1차 지필 시작 날짜 찾기 (가장 빠른 날짜, "해당 학년" 기준)
const findFirstTestStartDate = (
  events: CalendarEvent[],
  grade: number,
): string | null => {
  const midtermEvents = events
    .filter((e) => e.type === 'midterm' && isEventForGrade(e, grade))
    .sort((a, b) => a.date.localeCompare(b.date));

  return midtermEvents.length > 0 ? midtermEvents[0].date : null;
};

// 2차 지필 시작 날짜 찾기 (가장 빠른 날짜, "해당 학년" 기준)
const findSecondTestStartDate = (
  events: CalendarEvent[],
  grade: number,
): string | null => {
  const finalEvents = events
    .filter((e) => e.type === 'final' && isEventForGrade(e, grade))
    .sort((a, b) => a.date.localeCompare(b.date));

  return finalEvents.length > 0 ? finalEvents[0].date : null;
};

// 개학식 날짜 찾기 (학년 구분 없음: 일반적으로 전 학년 공통 이벤트)
const findOpeningDate = (events: CalendarEvent[]): string | null => {
  const openingEvents = events
    .filter((e) => e.type === 'opening')
    .sort((a, b) => a.date.localeCompare(b.date)); // 오름차순 정렬 (가장 빠른 날짜)

  return openingEvents.length > 0 ? openingEvents[0].date : null;
};

// 방학식 날짜 찾기 (학년 구분 없음: 일반적으로 전 학년 공통 이벤트)
const findClosingDate = (events: CalendarEvent[]): string | null => {
  const closingEvents = events
    .filter((e) => e.type === 'closing')
    .sort((a, b) => b.date.localeCompare(a.date)); // 내림차순 정렬 (가장 늦은 날짜)

  return closingEvents.length > 0 ? closingEvents[0].date : null;
};

// 특정 교사/반의 모든 교시 수업 일정 생성
export const generateClassSessions = (
  teacherId: string,
  grade: number,
  classNumber: number,
  _schoolId: string,
  year: number,
  semester: 1 | 2,
  schedules: ClassSchedule[],
  calendar: SavedCalendar | null,
): ClassSession[] => {
  const sessions: ClassSession[] = [];

  // 해당 교사/반의 모든 시간표 찾기 (모든 교시 포함)
  const classSchedules = schedules.filter(
    (s) => s.teacherId === teacherId && s.grade === grade && s.classNumber === classNumber,
  );

  if (classSchedules.length === 0) {
    return sessions; // 해당 시간표가 없으면 빈 배열
  }

  // 과목명은 첫 번째 스케줄에서 가져오기 (같은 반이면 같은 과목이라고 가정)
  const subject = classSchedules[0].subject;

  // 학기 시작/종료 날짜 계산
  const getSemesterDates = () => {
    if (semester === 1) {
      return {
        start: new Date(year, 1, 1), // 2월 1일 (month index: 0=1월, 1=2월)
        end: new Date(year, 7, 31), // 8월 31일
      };
    } else {
      return {
        start: new Date(year, 7, 1), // 8월 1일
        end: new Date(year + 1, 0, 31), // 다음해 1월 31일
      };
    }
  };

  const { start, end } = getSemesterDates();
  const events = calendar?.events || [];

  // 1차/2차 지필 시작 날짜 찾기 (해당 학년 기준)
  const firstTestStart = findFirstTestStartDate(events, grade);
  const secondTestStart = findSecondTestStartDate(events, grade);

  // 개학식/방학식 날짜 찾기 (전 학년 공통 이벤트로 가정)
  const openingDate = findOpeningDate(events);
  const closingDate = findClosingDate(events);

  // 시작 날짜 결정: 개학식이 있으면 개학식부터, 없으면 학기 시작일부터
  const actualStart = openingDate ? new Date(openingDate) : start;

  // 종료 날짜 결정: 방학식이 있으면 방학식 전날까지만, 없으면 학기 종료일까지
  let actualEnd = end;
  if (closingDate) {
    const closing = new Date(closingDate);
    closing.setDate(closing.getDate() - 1); // 방학식 전날
    actualEnd = closing;
  }

  // 학기 시작일부터 종료일까지 반복
  const currentDate = new Date(actualStart);
  let sessionNumberBeforeFirst = 0; // 1차 지필 이전
  let sessionNumberAfterFirst = 0; // 1차 지필 이후, 2차 지필 이전
  let sessionNumberAfterSecond = 0; // 2차 지필 이후

  while (currentDate <= actualEnd) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = formatDate(currentDate);

    // 학년 기준으로 수업 없는 날인지 판별
    const { isNonClass, eventName } = isNonClassDay(currentDate, events, grade);

    // 날짜 구간 확인
    const hasFirstTest = firstTestStart !== null;
    const hasSecondTest = secondTestStart !== null;

    const isBeforeFirst: boolean =
      hasFirstTest && firstTestStart !== null ? dateStr < firstTestStart : false;

    const isAfterFirstBeforeSecond: boolean =
      hasFirstTest &&
      hasSecondTest &&
      firstTestStart !== null &&
      secondTestStart !== null &&
      dateStr >= firstTestStart &&
      dateStr < secondTestStart;

    const isAfterSecond: boolean =
      hasSecondTest && secondTestStart !== null ? dateStr >= secondTestStart : false;

    // 1차 지필 시작 날짜 표시 (해당 학년이 대상인 midterm 기준으로 계산된 날짜)
    if (firstTestStart && dateStr === firstTestStart) {
      sessions.push({
        sessionNumber: null,
        date: dateStr,
        dayOfWeek: getDayOfWeekName(dayOfWeek),
        period: 0,
        classInfo: `${grade}${String(classNumber).padStart(2, '0')} ${subject}`,
        academicEvent: '1차 지필 시작',
        content: '',
        isBeforeFirstTest: false,
        segment: hasSecondTest ? 'between_first_second' : undefined, // 이벤트용, 분석에서는 sessionNumber=null이라 무시됨
      });
    }

    // 2차 지필 시작 날짜 표시 (해당 학년이 대상인 final 기준으로 계산된 날짜)
    if (secondTestStart && dateStr === secondTestStart) {
      sessions.push({
        sessionNumber: null,
        date: dateStr,
        dayOfWeek: getDayOfWeekName(dayOfWeek),
        period: 0,
        classInfo: `${grade}${String(classNumber).padStart(2, '0')} ${subject}`,
        academicEvent: '2차 지필 시작',
        content: '',
        isBeforeFirstTest: false,
        segment: 'after_second', // 이벤트용
      });
    }

    // 해당 요일에 수업이 있는 모든 교시 찾기
    const daySchedules = classSchedules.filter((s) => s.dayOfWeek === dayOfWeek);

    if (daySchedules.length > 0) {
      // 수업 없는 날(공휴일/시험일/재량휴업/대체공휴일/모의고사/직접입력)이 아닌 경우에만 회차 증가
      if (!isNonClass) {
        if (isBeforeFirst) {
          sessionNumberBeforeFirst++;
        } else if (isAfterFirstBeforeSecond) {
          sessionNumberAfterFirst++;
        } else if (isAfterSecond && (!closingDate || dateStr < closingDate)) {
          sessionNumberAfterSecond++;
        }
      }

      // 각 교시마다 세션 생성
      for (const classSchedule of daySchedules) {
        if (!isNonClass) {
          // 수업 있는 날
          let currentSessionNumber: number | null = null;
          let currentSegment: ExamSegment | undefined;

          if (isBeforeFirst) {
            currentSessionNumber = sessionNumberBeforeFirst;
            currentSegment = 'before_first';
          } else if (isAfterFirstBeforeSecond) {
            currentSessionNumber = sessionNumberAfterFirst;
            currentSegment = 'between_first_second';
          } else if (isAfterSecond && (!closingDate || dateStr < closingDate)) {
            currentSessionNumber = sessionNumberAfterSecond;
            currentSegment = 'after_second';
          }

          sessions.push({
            sessionNumber: currentSessionNumber,
            date: dateStr,
            dayOfWeek: getDayOfWeekName(dayOfWeek),
            period: classSchedule.period,
            classInfo: `${grade}${String(classNumber).padStart(2, '0')} ${subject}`,
            academicEvent: '',
            content: '',
            isBeforeFirstTest: isBeforeFirst,
            segment: currentSegment,
          });
        } else {
          // 수업 없는 날(공휴일/시험/재량휴업/대체공휴일/모의고사/직접입력)
          sessions.push({
            sessionNumber: null,
            date: dateStr,
            dayOfWeek: getDayOfWeekName(dayOfWeek),
            period: classSchedule.period,
            classInfo: `${grade}${String(classNumber).padStart(2, '0')} ${subject}`,
            academicEvent: eventName,
            content: '',
            isBeforeFirstTest: isBeforeFirst,
            segment: undefined,
          });
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 방학식 날짜 표시 (마지막에)
  if (closingDate) {
    const closing = new Date(closingDate);
    const closingDayOfWeek = closing.getDay();

    sessions.push({
      sessionNumber: null,
      date: closingDate,
      dayOfWeek: getDayOfWeekName(closingDayOfWeek),
      period: 0,
      classInfo: `${grade}${String(classNumber).padStart(2, '0')} ${subject}`,
      academicEvent: '방학식',
      content: '',
      isBeforeFirstTest: false,
      segment: 'after_second',
    });
  }

  // 날짜와 교시 순으로 정렬
  sessions.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.period - b.period;
  });

  return sessions;
};
