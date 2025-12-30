# PROJECT_RULES.md

이 문서는 이 레포에서 작업할 때(특히 AI 도구 사용 시) **반드시 지켜야 할 기본 규칙**을 정의합니다.  
특히 Cursor, Claude, ChatGPT 등에게 “이 레포는 이렇게 다뤄라”라고 설명할 때 이 문서를 기준으로 합니다.

---

## 1. 프로젝트 개요

- **프론트엔드 스택**
  - React + TypeScript + Vite
  - 스타일: 개별 `.css` 파일 + `App.css`, `index.css`
- **백엔드/스토리지**
  - Supabase (PostgreSQL + Auth + JS Client)
- **도메인**
  - 한국 고등학교 학사일정 + 교사별 시간표
  - 엑셀(나이스) 기반 시간표 파싱
  - 학사일정(지필고사/공휴일/방학식 등)과 시간표를 매칭하여  
    **“1차 지필 전/후, 2차 지필 전/후” 구간별 수업 회차(ClassSession) 생성

---

## 2. 아키텍처 원칙 (3 레이어 구조)

이 레포는 **Domain / Infra / UI** 세 계층을 사용합니다.

### 2.1 Domain Layer (core, 순수 로직)

- 위치(권장): `src/core/domain/**`
- 책임:
  - 비즈니스 로직
    - 학기 기간 계산 (1학기: 2/1~8/31, 2학기: 8/1~다음해 1/31)
    - 학사일정 이벤트(개학식, 방학식, 공휴일, 1·2차 지필 등) 처리
    - 시간표(ClassSchedule) + 학사일정(CalendarEvent) → 수업 회차(ClassSession) 생성
    - 1차/2차 지필 전·후 구간별 회차 번호(sessionNumber) 카운팅
  - 도메인 규칙 유지 및 캡슐화
- **금지사항:**
  - `react`, `react-dom`, `supabase-js`, `xlsx`, `window`, `document` 등  
    **프레임워크/라이브러리/브라우저 API 의존 금지**
  - API 호출, DB 쿼리, 파일 I/O 금지
- **목표:**
  - **순수 함수(pure function)** 중심
  - Node 환경에서 unit test만으로도 검증 가능해야 함

#### 예시 (의도된 모습)

```ts
// src/core/domain/sessions.ts
import { CalendarEvent, ClassSchedule, ClassSession } from "../../types";

export type GenerateSessionsParams = {
  schedules: ClassSchedule[];
  calendarEvents: CalendarEvent[];
  year: number;
  semester: number;
  schoolId: string;
  teacherId: string;
  teacherName: string;
  grade: number;
  classNumber: number;
  subject: string;
};

export function generateClassSessions(params: GenerateSessionsParams): ClassSession[] {
  // TODO: 학기 기간 계산
  // TODO: 1차/2차 지필, 개학식/방학식 찾기
  // TODO: 공휴일/주말/시험일 제외
  // TODO: 구간별 sessionNumber 카운팅

  return [];
}
