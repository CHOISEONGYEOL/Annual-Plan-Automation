# GitHub 업로드 가이드

이 프로젝트를 GitHub에 업로드하기 위한 단계별 가이드입니다.

## 1. Git 설치

Git이 설치되어 있지 않다면 다음 중 하나를 설치하세요:

### 옵션 1: Git 직접 설치
- [Git 공식 사이트](https://git-scm.com/download/win)에서 Windows용 Git 다운로드 및 설치

### 옵션 2: GitHub Desktop 사용 (권장)
- [GitHub Desktop](https://desktop.github.com/) 다운로드 및 설치
- GitHub Desktop을 사용하면 GUI로 쉽게 업로드할 수 있습니다.

## 2. GitHub 저장소 생성

1. [GitHub](https://github.com)에 로그인
2. 새 저장소 생성:
   - 저장소 이름: `Annual-Plan-Automation`
   - 설명: "한국 고등학교 학사일정표 관리 및 수업 계획 자동화 프로그램"
   - Public 또는 Private 선택
   - **README, .gitignore, license는 추가하지 마세요** (이미 프로젝트에 있음)

## 3. Git 명령어로 업로드 (Git 설치 후)

프로젝트 루트 디렉토리에서 다음 명령어를 실행하세요:

```bash
# Git 저장소 초기화
git init

# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit: Annual Plan Automation project"

# 원격 저장소 추가 (본인의 GitHub 사용자명으로 변경)
git remote add origin https://github.com/CHOISEONGYEOL/Annual-Plan-Automation.git

# 메인 브랜치로 푸시
git branch -M main
git push -u origin main
```

## 4. GitHub Desktop 사용 시

1. GitHub Desktop 실행
2. "File" > "Add Local Repository" 선택
3. 프로젝트 폴더 선택: `C:\Users\etern\OneDrive\Desktop\Annual Plan Automation`
4. "Publish repository" 클릭
5. 저장소 이름: `Annual-Plan-Automation`
6. 설명 입력 후 "Publish repository" 클릭

## 5. 환경 변수 파일 주의사항

`.env` 파일은 `.gitignore`에 포함되어 있어 자동으로 제외됩니다.
GitHub에 업로드할 때는 민감한 정보(API 키 등)가 포함되지 않습니다.

## 6. 업로드 후 확인

업로드가 완료되면 다음 URL에서 확인할 수 있습니다:
https://github.com/CHOISEONGYEOL/Annual-Plan-Automation

