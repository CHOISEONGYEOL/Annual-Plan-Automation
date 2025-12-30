@echo off
echo ========================================
echo GitHub 업로드 스크립트
echo ========================================
echo.

REM Git 설치 확인
git --version >nul 2>&1
if errorlevel 1 (
    echo [오류] Git이 설치되어 있지 않습니다.
    echo.
    echo Git을 설치하거나 GitHub Desktop을 사용하세요.
    echo 자세한 내용은 GITHUB_SETUP.md 파일을 참고하세요.
    pause
    exit /b 1
)

echo [1/5] Git 저장소 초기화 중...
git init
if errorlevel 1 (
    echo [오류] Git 초기화 실패
    pause
    exit /b 1
)

echo [2/5] 파일 추가 중...
git add .
if errorlevel 1 (
    echo [오류] 파일 추가 실패
    pause
    exit /b 1
)

echo [3/5] 커밋 생성 중...
git commit -m "Initial commit: Annual Plan Automation project"
if errorlevel 1 (
    echo [경고] 커밋 실패 (이미 커밋된 파일이 있을 수 있습니다)
)

echo [4/5] 원격 저장소 추가 중...
git remote remove origin 2>nul
git remote add origin https://github.com/CHOISEONGYEOL/Annual-Plan-Automation.git
if errorlevel 1 (
    echo [오류] 원격 저장소 추가 실패
    pause
    exit /b 1
)

echo [5/5] 브랜치 설정 및 푸시 중...
git branch -M main
git push -u origin main
if errorlevel 1 (
    echo.
    echo [오류] 푸시 실패
    echo.
    echo 가능한 원인:
    echo 1. GitHub 저장소가 아직 생성되지 않았습니다.
    echo    https://github.com/CHOISEONGYEOL/Annual-Plan-Automation 에서 저장소를 먼저 생성하세요.
    echo.
    echo 2. 인증이 필요합니다.
    echo    GitHub Personal Access Token을 사용하거나 GitHub Desktop을 사용하세요.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo 업로드 완료!
echo ========================================
echo.
echo 저장소 주소: https://github.com/CHOISEONGYEOL/Annual-Plan-Automation
echo.
pause

