import { useState } from 'react';
import { School } from './types';
import { SchoolSelection } from './components/SchoolSelection';
import { YearSemesterSelection } from './components/YearSemesterSelection';
import { CalendarEditor } from './components/CalendarEditor';
import { TeacherScheduleUpload } from './components/TeacherScheduleUpload';
// ⭐ 추가: 학생 시간표 업로드 화면 import
import { StudentTimetableUpload } from './components/StudentTimetableUpload';

import './App.css';

// 기존: 'school' | 'year-semester' | 'calendar' | 'teacher-schedule'
// ⭐ 추가: 'student-timetable' 값만 하나 더 붙임
type AppStep =
  | 'school'
  | 'year-semester'
  | 'calendar'
  | 'teacher-schedule'
  | 'student-timetable';

function App() {
  const [step, setStep] = useState<AppStep>('school');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [semester, setSemester] = useState<1 | 2 | null>(null);

  const handleSchoolSelect = (school: School) => {
    setSelectedSchool(school);
    setStep('year-semester');
  };

  const handleYearSemesterConfirm = (selectedYear: number, selectedSemester: 1 | 2) => {
    setYear(selectedYear);
    setSemester(selectedSemester);
    setStep('calendar');
  };

  const handleBackToSchool = () => {
    setStep('school');
    setSelectedSchool(null);
    setYear(null);
    setSemester(null);
  };

  const handleBackToYearSemester = () => {
    setStep('year-semester');
    setYear(null);
    setSemester(null);
  };

  const handleCalendarToTeacherSchedule = () => {
    setStep('teacher-schedule');
  };

  // ⭐ 추가: 달력 → 학생 시간표 입력 화면으로 이동
  const handleCalendarToStudentTimetable = () => {
    setStep('student-timetable');
  };

  const handleBackToCalendar = () => {
    setStep('calendar');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📅 학사일정표 관리 시스템</h1>
      </header>

      <main className="app-main">
        {step === 'school' && (
          <SchoolSelection onSelect={handleSchoolSelect} />
        )}

        {step === 'year-semester' && (
          <YearSemesterSelection 
            onConfirm={handleYearSemesterConfirm}
            onBack={handleBackToSchool}
          />
        )}

        {step === 'calendar' && selectedSchool && year !== null && semester !== null && (
          <CalendarEditor
            school={selectedSchool}
            year={year}
            semester={semester}
            onBack={handleBackToYearSemester}
            onNext={handleCalendarToTeacherSchedule}
            // ⭐ 추가: "다음: 학생 시간표 입력 →" 버튼용 콜백
            onNextStudentTimetable={handleCalendarToStudentTimetable}
          />
        )}

        {step === 'teacher-schedule' && selectedSchool && year !== null && semester !== null && (
          <TeacherScheduleUpload
            school={selectedSchool}
            year={year}
            semester={semester}
            onBack={handleBackToCalendar}
          />
        )}

        {/* ⭐ 추가: 학생 시간표 업로드 화면 분기 */}
        {step === 'student-timetable' && selectedSchool && year !== null && semester !== null && (
          <StudentTimetableUpload
            school={selectedSchool}
            year={year}
            semester={semester}
            onBack={handleBackToCalendar} // 뒤로가기 → 달력 화면으로
          />
        )}
      </main>
    </div>
  );
}

export default App;
