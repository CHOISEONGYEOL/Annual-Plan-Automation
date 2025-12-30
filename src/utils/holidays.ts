// 대체 휴일 계산 함수 (공휴일이 주말과 겹치면 다음 평일로 대체)
const getSubstituteHoliday = (holiday: Date): Date | null => {
  const dayOfWeek = holiday.getDay();
  // 일요일(0) 또는 토요일(6)이면 다음 평일로 대체
  if (dayOfWeek === 0) {
    // 일요일이면 월요일로
    const substitute = new Date(holiday);
    substitute.setDate(substitute.getDate() + 1);
    // 대체 휴일이 또 다른 공휴일과 겹치지 않는지 확인
    return substitute;
  } else if (dayOfWeek === 6) {
    // 토요일이면 월요일로
    const substitute = new Date(holiday);
    substitute.setDate(substitute.getDate() + 2);
    return substitute;
  }
  return null;
};

// 음력 공휴일 날짜 (2020-2030년)
const getLunarHolidays = (year: number): Array<{ month: number; day: number; name: string }> => {
  const holidays: Array<{ month: number; day: number; name: string }> = [];
  
  // 설날 (음력 1월 1일 전날, 당일, 다음날) - 3일 연휴
  const seollal: { [key: number]: Array<{ month: number; day: number }> } = {
    2020: [{ month: 0, day: 24 }, { month: 0, day: 25 }, { month: 0, day: 26 }], // 1월 24-26일
    2021: [{ month: 1, day: 11 }, { month: 1, day: 12 }, { month: 1, day: 13 }], // 2월 11-13일
    2022: [{ month: 0, day: 31 }, { month: 1, day: 1 }, { month: 1, day: 2 }], // 1월 31일, 2월 1-2일
    2023: [{ month: 1, day: 20 }, { month: 1, day: 21 }, { month: 1, day: 22 }], // 1월 20-22일
    2024: [{ month: 1, day: 9 }, { month: 1, day: 10 }, { month: 1, day: 11 }], // 2월 9-11일
    2025: [{ month: 0, day: 28 }, { month: 0, day: 29 }, { month: 0, day: 30 }], // 1월 28-30일
    2026: [{ month: 1, day: 16 }, { month: 1, day: 17 }, { month: 1, day: 18 }], // 2월 16-18일
    2027: [{ month: 1, day: 5 }, { month: 1, day: 6 }, { month: 1, day: 7 }], // 2월 5-7일
    2028: [{ month: 1, day: 25 }, { month: 1, day: 26 }, { month: 1, day: 27 }], // 2월 25-27일
    2029: [{ month: 1, day: 12 }, { month: 1, day: 13 }, { month: 1, day: 14 }], // 2월 12-14일
    2030: [{ month: 1, day: 2 }, { month: 1, day: 3 }, { month: 1, day: 4 }], // 2월 2-4일
  };
  
  // 추석 (음력 8월 15일 전날, 당일, 다음날) - 3일 연휴
  // month는 0-based (0=1월, 8=9월, 9=10월)
  const chuseok: { [key: number]: Array<{ month: number; day: number }> } = {
    2020: [{ month: 8, day: 30 }, { month: 9, day: 1 }, { month: 9, day: 2 }], // 9월 30일, 10월 1-2일
    2021: [{ month: 8, day: 20 }, { month: 8, day: 21 }, { month: 8, day: 22 }], // 9월 20-22일
    2022: [{ month: 8, day: 9 }, { month: 8, day: 10 }, { month: 8, day: 11 }], // 9월 9-11일
    2023: [{ month: 8, day: 28 }, { month: 8, day: 29 }, { month: 8, day: 30 }], // 9월 28-30일
    2024: [{ month: 8, day: 16 }, { month: 8, day: 17 }, { month: 8, day: 18 }], // 9월 16-18일
    2025: [{ month: 9, day: 5 }, { month: 9, day: 6 }, { month: 9, day: 7 }], // 10월 5-7일
    2026: [{ month: 8, day: 24 }, { month: 8, day: 25 }, { month: 8, day: 26 }], // 9월 24-26일
    2027: [{ month: 8, day: 14 }, { month: 8, day: 15 }, { month: 8, day: 16 }], // 9월 14-16일
    2028: [{ month: 9, day: 2 }, { month: 9, day: 3 }, { month: 9, day: 4 }], // 10월 2-4일
    2029: [{ month: 8, day: 21 }, { month: 8, day: 22 }, { month: 8, day: 23 }], // 9월 21-23일
    2030: [{ month: 8, day: 11 }, { month: 8, day: 12 }, { month: 8, day: 13 }], // 9월 11-13일
  };
  
  // 부처님 오신 날 (음력 4월 8일)
  const buddhaBirthday: { [key: number]: { month: number; day: number } } = {
    2020: { month: 4, day: 30 },
    2021: { month: 5, day: 19 },
    2022: { month: 5, day: 8 },
    2023: { month: 5, day: 27 },
    2024: { month: 5, day: 15 },
    2025: { month: 4, day: 5 },
    2026: { month: 5, day: 24 },
    2027: { month: 5, day: 13 },
    2028: { month: 5, day: 2 },
    2029: { month: 5, day: 20 },
    2030: { month: 5, day: 9 },
  };
  
  // 설날 추가
  if (seollal[year]) {
    seollal[year].forEach((date, index) => {
      holidays.push({
        ...date,
        name: index === 1 ? '설날' : (index === 0 ? '설날 전날' : '설날 다음날'),
      });
    });
  }
  
  // 추석 추가
  if (chuseok[year]) {
    chuseok[year].forEach((date, index) => {
      holidays.push({
        ...date,
        name: index === 1 ? '추석' : (index === 0 ? '추석 전날' : '추석 다음날'),
      });
    });
  }
  
  // 부처님 오신 날 추가
  if (buddhaBirthday[year]) {
    holidays.push({
      ...buddhaBirthday[year],
      name: '부처님 오신 날',
    });
  }
  
  return holidays;
};

// 한국 공휴일 목록 (고정 공휴일 + 음력 공휴일 + 대체 휴일)
export const getHolidays = (year: number): Date[] => {
  const holidays: Date[] = [];
  
  // 고정 공휴일 정의
  const fixedHolidays = [
    { month: 0, day: 1, name: '신정' }, // 신정
    { month: 2, day: 1, name: '삼일절' }, // 삼일절
    { month: 4, day: 5, name: '어린이날' }, // 어린이날
    { month: 5, day: 6, name: '현충일' }, // 현충일
    { month: 7, day: 15, name: '광복절' }, // 광복절
    { month: 9, day: 3, name: '개천절' }, // 개천절
    { month: 9, day: 9, name: '한글날' }, // 한글날
    { month: 11, day: 25, name: '크리스마스' }, // 크리스마스
  ];
  
  // 음력 공휴일 추가
  const lunarHolidays = getLunarHolidays(year);
  const allHolidays = [...fixedHolidays, ...lunarHolidays];
  
  // 먼저 모든 공휴일 추가
  allHolidays.forEach(({ month, day }) => {
    const holiday = new Date(year, month, day);
    holidays.push(holiday);
  });
  
  // 각 공휴일의 대체 휴일 계산
  allHolidays.forEach(({ month, day }) => {
    const holiday = new Date(year, month, day);
    const substitute = getSubstituteHoliday(holiday);
    
    if (substitute) {
      // 대체 휴일 추가 (이미 다른 공휴일과 겹치더라도 대체 휴일은 별도로 표시)
      // 중복 제거는 나중에 처리
      holidays.push(substitute);
    }
  });
  
  // 중복 제거 (같은 날짜가 여러 번 들어간 경우)
  const uniqueHolidays: Date[] = [];
  const seen = new Set<string>();
  holidays.forEach(holiday => {
    const key = `${holiday.getFullYear()}-${holiday.getMonth()}-${holiday.getDate()}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueHolidays.push(holiday);
    }
  });
  
  return uniqueHolidays;
  
  // 음력 공휴일은 매년 달라지므로 여기서는 기본값만 제공
  // 실제 사용 시 한국천문연구원 API 등을 활용하여 정확한 날짜를 가져올 수 있습니다
};

export const isPublicHoliday = (date: Date): boolean => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const holidays = getHolidays(year);
  
  return holidays.some(h => 
    h.getFullYear() === year &&
    h.getMonth() === month &&
    h.getDate() === day
  );
};

export const getHolidayName = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // 고정 공휴일 확인
  if (month === 0 && day === 1) return '신정';
  if (month === 2 && day === 1) return '삼일절';
  if (month === 4 && day === 5) return '어린이날';
  if (month === 5 && day === 6) return '현충일';
  if (month === 7 && day === 15) return '광복절';
  if (month === 9 && day === 3) return '개천절';
  if (month === 9 && day === 9) return '한글날';
  if (month === 11 && day === 25) return '크리스마스';
  
  // 음력 공휴일 확인
  const lunarHolidays = getLunarHolidays(year);
  for (const lunar of lunarHolidays) {
    if (lunar.month === month && lunar.day === day) {
      return lunar.name;
    }
  }
  
  // 대체 휴일 확인 (원래 공휴일의 다음 평일)
  const fixedHolidays = [
    { date: new Date(year, 0, 1), name: '신정' },
    { date: new Date(year, 2, 1), name: '삼일절' },
    { date: new Date(year, 4, 5), name: '어린이날' },
    { date: new Date(year, 5, 6), name: '현충일' },
    { date: new Date(year, 7, 15), name: '광복절' },
    { date: new Date(year, 9, 3), name: '개천절' },
    { date: new Date(year, 9, 9), name: '한글날' },
    { date: new Date(year, 11, 25), name: '크리스마스' },
  ];
  
  // 음력 공휴일도 대체 휴일 계산에 포함
  for (const lunar of lunarHolidays) {
    fixedHolidays.push({ date: new Date(year, lunar.month, lunar.day), name: lunar.name });
  }
  
  for (const holiday of fixedHolidays) {
    const substitute = getSubstituteHoliday(holiday.date);
    if (substitute && 
        substitute.getFullYear() === year &&
        substitute.getMonth() === month &&
        substitute.getDate() === day) {
      return `${holiday.name} 대체휴일`;
    }
  }
  
  return '공휴일';
};

export const formatDate = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

