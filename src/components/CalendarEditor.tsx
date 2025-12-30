import React, { useState, useEffect } from 'react';
import { School, AcademicCalendar, CalendarEvent } from '../types';
import { isPublicHoliday, formatDate, getHolidayName } from '../utils/holidays';
import { storage } from '../infra/supabase/storage';
import './CalendarEditor.css';

interface CalendarEditorProps {
  school: School;
  year: number;
  semester: 1 | 2;
  onBack: () => void;
  onNext?: () => void;
  // ⭐ 추가: 학생 시간표 입력 단계로 이동하는 콜백 (선택적)
  onNextStudentTimetable?: () => void;
}

export const CalendarEditor: React.FC<CalendarEditorProps> = ({
  school,
  year,
  semester,
  onBack,
  onNext,
  // ⭐ 추가: props 구조분해
  onNextStudentTimetable,
}) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<CalendarEvent['type']>('direct');
  const [eventName, setEventName] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<number[]>([1, 2, 3]); // 기본값: 모든 학년
  const [startDate, setStartDate] = useState<string>(''); // 시험 시작 날짜
  const [endDate, setEndDate] = useState<string>(''); // 시험 종료 날짜
  const [showEventModal, setShowEventModal] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all'); // 달력 필터

  // 학기 시작/종료 날짜 계산
  const getSemesterDates = () => {
    if (semester === 1) {
      return {
        start: new Date(year, 1, 1), // 2월 1일
        end: new Date(year, 7, 31), // 8월 31일
      };
    } else {
      return {
        start: new Date(year, 7, 1), // 8월 1일
        end: new Date(year + 1, 0, 31), // 다음해 1월 31일
      };
    }
  };

  useEffect(() => {
    const loadCalendar = async () => {
      // 기존 일정 불러오기
      const calendarId = `${school.id}_${year}_${semester}`;
      console.log('Loading calendar:', calendarId);
      const existing = await storage.getCalendarById(calendarId);
      console.log('Existing calendar:', existing);
      
      if (existing) {
        // 기존 이벤트에 id와 grades가 없으면 기본값 설정
        const eventsWithDefaults = existing.events.map((e, index) => ({
          ...e,
          id: e.id || `event-${Date.now()}-${index}-${e.date}`, // id가 없으면 생성
          grades: e.grades || [1, 2, 3],
        }));
        console.log('Loaded events:', eventsWithDefaults.length);
        setEvents(eventsWithDefaults);
        setSavedAt(existing.savedAt);
      } else {
        // 2학기이고 8월이 포함된 경우, 1학기에서 8월 데이터 불러오기
        let initialEvents: CalendarEvent[] = [];
        
        if (semester === 2) {
          const firstSemesterId = `${school.id}_${year}_1`;
          const firstSemester = await storage.getCalendarById(firstSemesterId);
          
          if (firstSemester) {
            // 8월 데이터만 필터링하고 grades 기본값 설정
            initialEvents = firstSemester.events
              .filter(event => {
                const eventDate = new Date(event.date);
                return eventDate.getMonth() === 7; // 8월 (0-based index)
              })
              .map((event, index) => ({
                ...event,
                id: event.id || `event-${Date.now()}-${index}-${event.date}`, // id가 없으면 생성
                grades: event.grades || [1, 2, 3],
              }));
          }
        }
        
        // 공휴일 자동 추가
        const { start, end } = getSemesterDates();
        const holidays: CalendarEvent[] = [];
        const currentDate = new Date(start);
        
        while (currentDate <= end) {
          if (isPublicHoliday(currentDate)) {
            const dateStr = formatDate(currentDate);
            // 이미 1학기에서 불러온 이벤트가 있으면 건너뛰기
            if (!initialEvents.find(e => e.date === dateStr)) {
              holidays.push({
                id: `holiday-${dateStr}`,
                date: dateStr,
                type: 'holiday',
                name: getHolidayName(currentDate),
                grades: [1, 2, 3], // 공휴일은 모든 학년에 적용
              });
            }
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        setEvents([...initialEvents, ...holidays]);
      }
    };

    loadCalendar();
  }, [school.id, year, semester]);

  const handleDateClick = (date: Date, eventId?: string) => {
    const dateStr = formatDate(date);
    setSelectedDate(dateStr);
    setSelectedEventId(eventId || null);
    
    // 특정 이벤트를 클릭한 경우
    if (eventId) {
      const existingEvent = events.find(e => e.id === eventId);
      if (existingEvent) {
        setEventType(existingEvent.type);
        setEventName(existingEvent.name);
        setSelectedGrades(existingEvent.grades || [1, 2, 3]);
        
        // 시험 타입 또는 직접 입력 기간인 경우 같은 타입과 이름의 모든 날짜 찾기
        if (existingEvent.type === 'midterm' || existingEvent.type === 'final' || existingEvent.type === 'mocktest' ||
            (existingEvent.type === 'direct' && existingEvent.name)) {
          const samePeriodEvents = events
            .filter(e => e.type === existingEvent.type && e.name === existingEvent.name)
            .map(e => e.date)
            .sort();
          
          if (samePeriodEvents.length > 0) {
            setStartDate(samePeriodEvents[0]);
            setEndDate(samePeriodEvents[samePeriodEvents.length - 1]);
          } else {
            setStartDate(existingEvent.date);
            setEndDate(existingEvent.date);
          }
        } else {
          setStartDate(existingEvent.date);
          setEndDate(existingEvent.date);
        }
      }
    } else {
      // 날짜를 클릭한 경우 (새 일정 추가)
      const dateEvents = events.filter(e => e.date === dateStr);
      if (dateEvents.length >= 5) {
        alert('하루에 최대 5개의 일정만 추가할 수 있습니다.');
        return;
      }
      setEventType('direct');
      setEventName('');
      setSelectedGrades([1, 2, 3]); // 기본값: 모든 학년
      setStartDate(dateStr); // 시작날짜 기본값
      setEndDate(dateStr); // 끝날짜 기본값
    }
    
    setShowEventModal(true);
  };

  const handleSaveEvent = () => {
    if (!selectedDate) return;
    
    // 직접 입력 타입이 아니면 기본 이름 사용
    let finalName = eventName.trim();
    if (!finalName && eventType !== 'direct') {
      switch (eventType) {
        case 'midterm':
          finalName = '1차 지필';
          break;
        case 'final':
          finalName = '2차 지필';
          break;
        case 'mocktest':
          finalName = '모의고사';
          break;
        case 'recess':
          finalName = '재량휴업일';
          break;
        case 'substitute':
          finalName = '대체공휴일';
          break;
        case 'opening':
          finalName = '개학식';
          break;
        case 'closing':
          finalName = '방학식';
          break;
        case 'custom':
          finalName = '일반 일정';
          break;
        default:
          finalName = '일정';
      }
    }
    
    if (eventType === 'direct' && !finalName) {
      alert('일정 이름을 입력해주세요.');
      return;
    }

    // 시험 타입 또는 직접 입력 기간 설정인 경우 시작날짜와 끝날짜 확인
    const isPeriodEvent = (eventType === 'midterm' || eventType === 'final' || eventType === 'mocktest' ||
                          (eventType === 'direct' && startDate !== endDate));
    
    if (isPeriodEvent && (!startDate || !endDate)) {
      alert('시작 날짜와 종료 날짜를 모두 선택해주세요.');
      return;
    }

    let newEvents: CalendarEvent[];
    
    if (selectedEventId) {
      // 기존 이벤트 수정
      // 시험 타입 또는 직접 입력 기간인 경우 기간 전체 수정
      if (eventType === 'midterm' || eventType === 'final' || eventType === 'mocktest' ||
          (eventType === 'direct' && startDate !== endDate)) {
        // 기존 기간 일정 모두 제거
        const existingEvent = events.find(e => e.id === selectedEventId);
        if (existingEvent) {
          const existingPeriodEvents = events.filter(e => 
            e.type === existingEvent.type && 
            e.name === existingEvent.name
          );
          newEvents = events.filter(e => !existingPeriodEvents.includes(e));
          
          // 새로운 기간으로 일정 추가
          const start = new Date(startDate);
          const end = new Date(endDate);
          
          if (start > end) {
            alert('시작 날짜가 종료 날짜보다 늦을 수 없습니다.');
            return;
          }

          const periodDates: CalendarEvent[] = [];
          const currentDate = new Date(start);
          
          while (currentDate <= end) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              const dateStr = formatDate(currentDate);
              const dateEvents = newEvents.filter(e => e.date === dateStr);
              if (dateEvents.length < 5) {
                periodDates.push({
                  id: `event-${Date.now()}-${Math.random()}-${dateStr}`,
                  date: dateStr,
                  type: eventType,
                  name: finalName,
                  grades: selectedGrades.length > 0 ? selectedGrades : [1, 2, 3],
                });
              }
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }

          newEvents = [...newEvents, ...periodDates];
        } else {
          return;
        }
      } else {
        // 단일 날짜 수정
        newEvents = events.map(e => 
          e.id === selectedEventId 
            ? { ...e, type: eventType, name: finalName, grades: selectedGrades.length > 0 ? selectedGrades : [1, 2, 3] }
            : e
        );
      }
    } else {
      // 새 이벤트 추가
      if (eventType === 'midterm' || eventType === 'final' || eventType === 'mocktest' ||
          (eventType === 'direct' && startDate !== endDate)) {
        // 기간 설정: 시작날짜부터 끝날짜까지, 주말 제외
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start > end) {
          alert('시작 날짜가 종료 날짜보다 늦을 수 없습니다.');
          return;
        }

        // 기존 일정 제거 (같은 타입과 이름의 일정이 있으면)
        const existingPeriodEvents = events.filter(e => 
          e.type === eventType && 
          e.name === finalName &&
          e.date >= startDate && 
          e.date <= endDate
        );
        newEvents = events.filter(e => !existingPeriodEvents.includes(e));

        // 주말 제외하고 날짜 생성
        const periodDates: CalendarEvent[] = [];
        const currentDate = new Date(start);
        
        while (currentDate <= end) {
          const dayOfWeek = currentDate.getDay();
          // 주말(토요일 6, 일요일 0) 제외
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const dateStr = formatDate(currentDate);
            // 해당 날짜에 이미 5개 이상의 일정이 있는지 확인
            const dateEvents = newEvents.filter(e => e.date === dateStr);
            if (dateEvents.length < 5) {
              periodDates.push({
                id: `event-${Date.now()}-${Math.random()}-${dateStr}`,
                date: dateStr,
                type: eventType,
                name: finalName,
                grades: selectedGrades.length > 0 ? selectedGrades : [1, 2, 3],
              });
            }
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }

        if (periodDates.length === 0) {
          alert('선택한 기간에 추가할 수 있는 날짜가 없습니다.');
          return;
        }

        newEvents = [...newEvents, ...periodDates];
      } else {
        // 일반 일정 추가
        const dateEvents = events.filter(e => e.date === selectedDate);
        if (dateEvents.length >= 5) {
          alert('하루에 최대 5개의 일정만 추가할 수 있습니다.');
          return;
        }
        
        newEvents = [...events, {
          id: `event-${Date.now()}-${Math.random()}`,
          date: selectedDate,
          type: eventType,
          name: finalName,
          grades: selectedGrades.length > 0 ? selectedGrades : [1, 2, 3],
        }];
      }
    }

    setEvents(newEvents);
    setIsModified(true);
    setShowEventModal(false);
    setSelectedDate(null);
    setSelectedEventId(null);
    setEventName('');
    setStartDate('');
    setEndDate('');
  };

  const handleDeleteEvent = () => {
    if (!selectedDate || !selectedEventId) return;

    const existingEvent = events.find(e => e.id === selectedEventId);
    if (!existingEvent) return;

    // 기간 이벤트인지 확인 (midterm, final, mocktest 또는 같은 이름의 direct 기간 이벤트)
    const isPeriodEvent = existingEvent.type === 'midterm' || 
                         existingEvent.type === 'final' || 
                         existingEvent.type === 'mocktest' ||
                         (existingEvent.type === 'direct' && existingEvent.name);
    
    if (isPeriodEvent) {
      // 같은 타입과 이름의 모든 이벤트 찾기
      const periodEvents = events.filter(e => 
        e.type === existingEvent.type && 
        e.name === existingEvent.name
      );
      
      if (periodEvents.length > 1) {
        // 기간 이벤트가 여러 날짜에 걸쳐 있는 경우
        const confirmMessage = `이 일정은 ${periodEvents.length}일 동안 설정되어 있습니다.\n\n전체 기간을 삭제하시겠습니까? (취소하면 현재 날짜만 삭제됩니다)`;
        
        if (window.confirm(confirmMessage)) {
          // 전체 기간 삭제
          const newEvents = events.filter(e => 
            !(e.type === existingEvent.type && e.name === existingEvent.name)
          );
          setEvents(newEvents);
        } else {
          // 현재 날짜만 삭제
          const newEvents = events.filter(e => e.id !== selectedEventId);
          setEvents(newEvents);
        }
      } else {
        // 단일 날짜인 경우 그냥 삭제
        const newEvents = events.filter(e => e.id !== selectedEventId);
        setEvents(newEvents);
      }
    } else {
      // 단일 날짜 이벤트인 경우
      const newEvents = events.filter(e => e.id !== selectedEventId);
      setEvents(newEvents);
    }
    
    setIsModified(true);
    setShowEventModal(false);
    setSelectedDate(null);
    setSelectedEventId(null);
  };

  const handleSave = async () => {
    // 저장 전에 모든 이벤트에 id가 있는지 확인하고 없으면 생성
    const eventsWithIds = events.map((e, index) => ({
      ...e,
      id: e.id || `event-${Date.now()}-${index}-${e.date}`, // id가 없으면 생성
    }));

    const calendar: AcademicCalendar = {
      id: `${school.id}_${year}_${semester}`,
      schoolId: school.id,
      schoolName: school.name,
      year,
      semester,
      events: eventsWithIds, // id가 보장된 이벤트 배열 사용
      createdAt: savedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('Saving calendar:', calendar);
    const saved = await storage.saveCalendar(calendar);
    console.log('Saved calendar:', saved);
    
    // Supabase에 실제로 저장되었는지 확인
    const verify = await storage.getCalendarById(calendar.id);
    console.log('Verification - calendar in storage:', verify);
    
    setSavedAt(saved.savedAt);
    setIsModified(false);
    
    // 저장된 이벤트로 상태 업데이트 (id가 보장된 버전)
    setEvents(eventsWithIds);
    
    alert(`저장되었습니다! (이벤트 ${eventsWithIds.length}개)`);

    // 기존 onNext 로직은 그대로 둠 (교사 시간표 여부만 물어봄)
    if (onNext) {
      setTimeout(() => {
        if (window.confirm('교사 시간표를 입력하시겠습니까?')) {
          onNext();
        }
      }, 100);
    }
  };

  const renderCalendar = () => {
    const { start, end } = getSemesterDates();
    const months: Date[][] = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const monthDays: Date[] = [];

      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        if (d >= start && d <= end) {
          monthDays.push(new Date(d));
        }
      }

      if (monthDays.length > 0) {
        months.push(monthDays);
      }

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return months.map((monthDays, idx) => {
      const firstDay = monthDays[0];
      const monthName = `${firstDay.getFullYear()}년 ${firstDay.getMonth() + 1}월`;
      
      // 해당 월의 1일이 어떤 요일인지 계산 (0=일요일, 1=월요일, ...)
      const firstDayOfMonth = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1);
      const startDayOfWeek = firstDayOfMonth.getDay();

      return (
        <div key={idx} className="month-section">
          <h3 className="month-title">{monthName}</h3>
          <div className="calendar-grid">
            {['일', '월', '화', '수', '목', '금', '토'].map(day => (
              <div key={day} className="day-header">{day}</div>
            ))}
            {/* 월의 첫 날 전까지 빈 칸 추가 */}
            {Array.from({ length: startDayOfWeek }).map((_, emptyIdx) => (
              <div key={`empty-${emptyIdx}`} className="calendar-day empty"></div>
            ))}
            {monthDays.map((date, dayIdx) => {
              const dateStr = formatDate(date);
              // 학년 필터 적용
              let dateEvents = events.filter(e => {
                if (e.date !== dateStr) return false;
                if (gradeFilter === 'all') return true;
                return e.grades?.includes(gradeFilter) || false;
              });
              const hasHoliday = dateEvents.some(e => e.type === 'holiday');
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const displayEvents = dateEvents.slice(0, 5); // 최대 5개만 표시

              return (
                <div
                  key={dayIdx}
                  className={`calendar-day ${isWeekend ? 'weekend' : ''} ${hasHoliday ? 'holiday' : ''} ${dateEvents.length > 0 ? 'has-event' : ''}`}
                  onClick={() => handleDateClick(date)}
                  title={dateEvents.map(e => e.name).join(', ')}
                >
                  <div className="day-number">{date.getDate()}</div>
                  <div className="event-badges">
                    {displayEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`event-badge ${event.type}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDateClick(date, event.id);
                        }}
                      >
                        {event.type === 'midterm' && '1차 지필'}
                        {event.type === 'final' && '2차 지필'}
                        {event.type === 'mocktest' && '모의고사'}
                        {event.type === 'opening' && '개학식'}
                        {event.type === 'closing' && '방학식'}
                        {event.type === 'recess' && '재량'}
                        {event.type === 'holiday' && '공휴'}
                        {event.type === 'custom' && '일정'}
                        {event.type === 'direct' && (event.name.length > 6 ? event.name.substring(0, 6) : event.name)}
                        {event.type === 'substitute' && '대체'}
                      </div>
                    ))}
                    {dateEvents.length > 5 && (
                      <div className="event-badge more">+{dateEvents.length - 5}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="calendar-editor">
      {/* 상단 헤더 */}
      <div className="editor-header">
        <button className="btn-back" onClick={onBack}>← 뒤로</button>
        <div className="header-info">
          <h2>{school.name} - {year}년 {semester}학기</h2>
          {savedAt && (
            <div className="saved-info">
              마지막 저장: {new Date(savedAt).toLocaleString('ko-KR')}
            </div>
          )}
        </div>
        <div className="header-actions">
          <button
            className={`btn-save ${isModified ? 'modified' : ''}`}
            onClick={handleSave}
          >
            {isModified ? '💾 저장 (변경됨)' : '💾 저장'}
          </button>
          <button
            onClick={async () => {
              // Supabase 상태 확인
              const calendarId = `${school.id}_${year}_${semester}`;
              const allCalendars = await storage.getCalendars();
              const thisCalendar = await storage.getCalendarById(calendarId);
              
              console.log('=== Supabase 상태 확인 ===');
              console.log('Calendar ID:', calendarId);
              console.log('전체 캘린더 수:', allCalendars.length);
              console.log('현재 캘린더:', thisCalendar);
              console.log('현재 이벤트 수:', events.length);
              
              alert(`Supabase 상태:\n- 전체 캘린더: ${allCalendars.length}개\n- 현재 캘린더: ${thisCalendar ? '있음' : '없음'}\n- 현재 이벤트: ${events.length}개\n\n콘솔에서 자세한 정보를 확인하세요.`);
            }}
            style={{ 
              marginLeft: '10px', 
              padding: '8px 12px', 
              fontSize: '12px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="localStorage 상태 확인"
          >
            🔍 저장 확인
          </button>
          {/* 기존: 교사 시간표 버튼 */}
          {!isModified && savedAt && onNext && (
            <button
              className="btn-next"
              onClick={onNext}
            >
              다음: 교사 시간표 입력 →
            </button>
          )}
          {/* ⭐ 추가: 학생 시간표 버튼 */}
          {!isModified && savedAt && onNextStudentTimetable && (
            <button
              className="btn-next"
              onClick={onNextStudentTimetable}
            >
              다음: 학생 시간표 입력 →
            </button>
          )}
        </div>
      </div>

      <div className="calendar-container">
        <div className="grade-filter-section">
          <label>학년 필터: </label>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value) as number)}
            className="grade-filter-select"
          >
            <option value="all">전체 학년</option>
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>
        </div>
        {renderCalendar()}
      </div>

      {/* 하단 헤더 (위와 동일 구조) */}
      <div className="editor-header">
        <button className="btn-back" onClick={onBack}>← 뒤로</button>
        <div className="header-info">
          <h2>{school.name} - {year}년 {semester}학기</h2>
          {savedAt && (
            <div className="saved-info">
              마지막 저장: {new Date(savedAt).toLocaleString('ko-KR')}
            </div>
          )}
        </div>
        <div className="header-actions">
          <button
            className={`btn-save ${isModified ? 'modified' : ''}`}
            onClick={handleSave}
          >
            {isModified ? '💾 저장 (변경됨)' : '💾 저장'}
          </button>
          <button
            onClick={async () => {
              // Supabase 상태 확인
              const calendarId = `${school.id}_${year}_${semester}`;
              const allCalendars = await storage.getCalendars();
              const thisCalendar = await storage.getCalendarById(calendarId);
              
              console.log('=== Supabase 상태 확인 ===');
              console.log('Calendar ID:', calendarId);
              console.log('전체 캘린더 수:', allCalendars.length);
              console.log('현재 캘린더:', thisCalendar);
              console.log('현재 이벤트 수:', events.length);
              
              alert(`Supabase 상태:\n- 전체 캘린더: ${allCalendars.length}개\n- 현재 캘린더: ${thisCalendar ? '있음' : '없음'}\n- 현재 이벤트: ${events.length}개\n\n콘솔에서 자세한 정보를 확인하세요.`);
            }}
            style={{ 
              marginLeft: '10px', 
              padding: '8px 12px', 
              fontSize: '12px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="localStorage 상태 확인"
          >
            🔍 저장 확인
          </button>
          {/* 기존: 교사 시간표 버튼 */}
          {!isModified && savedAt && onNext && (
            <button
              className="btn-next"
              onClick={onNext}
            >
              다음: 교사 시간표 입력 →
            </button>
          )}
          {/* ⭐ 추가: 학생 시간표 버튼 */}
          {!isModified && savedAt && onNextStudentTimetable && (
            <button
              className="btn-next"
              onClick={onNextStudentTimetable}
            >
              다음: 학생 시간표 입력 →
            </button>
          )}
        </div>
      </div>

      {showEventModal && selectedDate && (
        <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>일정 편집</h3>
            <div className="modal-form">
              <div className="form-group">
                <label>일정 유형</label>
                <select
                  value={eventType}
                  onChange={(e) => {
                    const newType = e.target.value as CalendarEvent['type'];
                    setEventType(newType);
                    // 직접 입력이 아니면 이름 초기화
                    if (newType !== 'direct') {
                      setEventName('');
                    }
                  }}
                >
                  <option value="direct">직접 입력</option>
                  <option value="midterm">1차 지필</option>
                  <option value="final">2차 지필</option>
                  <option value="mocktest">모의고사</option>
                  <option value="opening">개학식</option>
                  <option value="closing">방학식</option>
                  <option value="recess">재량휴업일</option>
                  <option value="substitute">대체공휴일</option>
                  <option value="custom">일반 일정</option>
                  <option value="holiday">공휴일</option>
                </select>
              </div>
              {(eventType === 'midterm' || eventType === 'final' || eventType === 'mocktest') && (
                <>
                  <div className="form-group">
                    <label>시작 날짜</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>종료 날짜</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                  <p className="date-hint">시작 날짜부터 종료 날짜까지 주말을 제외하고 일정이 추가됩니다.</p>
                </>
              )}
              {eventType === 'direct' && (
                <>
                  <div className="form-group">
                    <label>일정 이름</label>
                    <input
                      type="text"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="일정 이름을 입력하세요"
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>기간 설정</label>
                    <div className="period-option">
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="periodType"
                          checked={startDate === endDate}
                          onChange={() => {
                            if (selectedDate) {
                              setStartDate(selectedDate);
                              setEndDate(selectedDate);
                            }
                          }}
                        />
                        <span>단일 날짜</span>
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="periodType"
                          checked={startDate !== endDate}
                          onChange={() => {
                            if (selectedDate) {
                              setStartDate(selectedDate);
                              // 기본적으로 3일 후까지
                              const end = new Date(selectedDate);
                              end.setDate(end.getDate() + 3);
                              setEndDate(formatDate(end));
                            }
                          }}
                        />
                        <span>기간 설정</span>
                      </label>
                    </div>
                  </div>
                  {startDate !== endDate && (
                    <>
                      <div className="form-group">
                        <label>시작 날짜</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>종료 날짜</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          required
                        />
                      </div>
                      <p className="date-hint">시작 날짜부터 종료 날짜까지 주말을 제외하고 일정이 추가됩니다.</p>
                    </>
                  )}
                </>
              )}
              {eventType !== 'midterm' && eventType !== 'final' && eventType !== 'direct' && (
                <div className="form-group">
                  <label>날짜</label>
                  <input type="text" value={selectedDate} disabled />
                </div>
              )}
              <div className="form-group">
                <label>적용 학년</label>
                <div className="grade-checkboxes">
                  <label className="grade-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedGrades.includes(1)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGrades([...selectedGrades, 1].sort());
                        } else {
                          setSelectedGrades(selectedGrades.filter(g => g !== 1));
                        }
                      }}
                    />
                    <span>1학년</span>
                  </label>
                  <label className="grade-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedGrades.includes(2)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGrades([...selectedGrades, 2].sort());
                        } else {
                          setSelectedGrades(selectedGrades.filter(g => g !== 2));
                        }
                      }}
                    />
                    <span>2학년</span>
                  </label>
                  <label className="grade-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedGrades.includes(3)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGrades([...selectedGrades, 3].sort());
                        } else {
                          setSelectedGrades(selectedGrades.filter(g => g !== 3));
                        }
                      }}
                    />
                    <span>3학년</span>
                  </label>
                </div>
                <p className="grade-hint">체크된 학년에만 일정이 적용됩니다. 모두 체크하면 모든 학년(1, 2, 3학년)에 적용됩니다.</p>
              </div>
              <div className="modal-actions">
                <button onClick={handleSaveEvent}>
                  {selectedEventId ? '수정' : '추가'}
                </button>
                {selectedEventId && (
                  <button className="btn-delete" onClick={handleDeleteEvent}>삭제</button>
                )}
                <button onClick={() => {
                  setShowEventModal(false);
                  setSelectedDate(null);
                  setSelectedEventId(null);
                  setSelectedGrades([1, 2, 3]);
                  setStartDate('');
                  setEndDate('');
                }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
