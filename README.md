# Annual Plan Automation

한국 고등학교 학사일정표 관리 및 수업 계획 자동화 프로그램

## 📋 프로젝트 개요

이 프로젝트는 한국 고등학교의 학사일정과 교사별 시간표를 관리하고, 학사일정과 시간표를 매칭하여 수업 회차를 자동으로 생성하는 웹 애플리케이션입니다.

### 주요 기능

- 🏫 **학교 관리**: 학교 선택 및 등록
- 📅 **학사일정 관리**: 학기별 학사일정 편집 (공휴일, 지필평가, 모의고사 등)
- 👨‍🏫 **교사 시간표 관리**: 나이스 시스템 Excel 파일 업로드 및 파싱
- 📚 **수업 회차 자동 생성**: 학사일정과 시간표를 매칭하여 수업 회차 자동 생성
- 📝 **수업 계획 템플릿**: 공통 수업 계획 템플릿 작성 및 적용
- 👨‍🎓 **학생 시간표 관리**: 학생별 수업시간표 업로드 및 조회

## 🛠️ 기술 스택

- **프론트엔드**: React + TypeScript + Vite
- **백엔드/스토리지**: Supabase (PostgreSQL + Auth + JS Client)
- **Excel 파싱**: xlsx
- **날짜 처리**: date-fns

## 📁 프로젝트 구조

```
src/
├── components/          # UI 컴포넌트
├── core/
│   └── domain/         # 도메인 레이어 (순수 비즈니스 로직)
├── infra/
│   ├── excel/          # Excel 파싱
│   └── supabase/       # Supabase 연동
├── utils/              # 유틸리티 함수
└── types.ts            # TypeScript 타입 정의
```

## 🚀 시작하기

### 필수 요구사항

- Node.js 18 이상
- npm 또는 yarn
- Supabase 계정 및 프로젝트

### 설치

```bash
npm install
```

### 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 개발 서버 실행

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

## 📖 사용 방법

1. **학교 선택**: 학교를 선택하거나 새로 등록합니다.
2. **학년도/학기 선택**: 작업할 학년도와 학기를 선택합니다.
3. **학사일정 편집**: 달력에서 학사일정을 편집합니다 (공휴일, 지필평가, 모의고사 등).
4. **교사 시간표 업로드**: 나이스 시스템에서 내려받은 교사 시간표 Excel 파일을 업로드합니다.
5. **수업 회차 생성**: 교사/학년/과목/반을 선택하여 수업 회차를 자동 생성합니다.
6. **수업 계획 작성**: 공통 수업 계획 템플릿을 작성하고 모든 반에 적용합니다.
7. **학생 시간표 관리**: 학생별 수업시간표를 업로드하고 학번으로 조회합니다.

## 🗄️ 데이터베이스 구조

Supabase에 다음 테이블들이 필요합니다:

- `schools`: 학교 정보
- `calendars`: 학사일정
- `teacher_schedules`: 교사 시간표
- `class_sessions`: 수업 회차
- `lesson_plan_templates`: 수업 계획 템플릿
- `student_timetables`: 학생 시간표

자세한 스키마는 `PROJECT_RULES.md`를 참고하세요.

## 📚 문서

- [프로젝트 규칙 및 아키텍처](PROJECT_RULES.md)
- [파일별 기능 정리](Anuual%20Plan%20Automation%20파일별%20기능정리.txt)

## 🏗️ 아키텍처

이 프로젝트는 **Domain / Infra / UI** 3계층 구조를 따릅니다:

- **Domain Layer**: 순수 비즈니스 로직 (프레임워크/라이브러리 의존 없음)
- **Infrastructure Layer**: 외부 시스템 연동 (Supabase, Excel 파싱)
- **UI Layer**: React 컴포넌트

자세한 내용은 `PROJECT_RULES.md`를 참고하세요.

## 📝 라이선스

이 프로젝트는 개인 사용 목적으로 개발되었습니다.

