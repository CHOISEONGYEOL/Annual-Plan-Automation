import * as XLSX from 'xlsx';
import { ClassSchedule } from '../../types';

// Excel 셀 내용 파싱: "3학년 미술 창작(3)" -> { grade: 3, subject: "미술 창작", classNumber: 3 }
export const parseCellContent = (cellValue: string | null | undefined): {
  grade: number | null;
  subject: string | null;
  classNumber: number | null;
} | null => {
  if (!cellValue || typeof cellValue !== 'string' || cellValue.trim() === '') {
    return null;
  }

  const text = cellValue.trim();

  // 패턴: "{학년}학년 {과목명}({반번호})"
  const match = text.match(/^(\d)학년\s+(.+?)\s*\((\d+)\)$/);

  if (match) {
    return {
      grade: parseInt(match[1]),
      subject: match[2].trim(),
      classNumber: parseInt(match[3]),
    };
  }

  return null;
};

// 교사 이름 파싱: "yeayeah03(고예진)" -> { id: "yeayeah03", name: "고예진" }
export const parseTeacherName = (teacherCell: string | null | undefined): {
  id: string;
  name: string;
} | null => {
  if (!teacherCell || typeof teacherCell !== 'string') {
    return null;
  }

  const match = teacherCell.match(/^(.+?)\((.+?)\)$/);
  if (match) {
    return {
      id: match[1].trim(),
      name: match[2].trim(),
    };
  }

  // 괄호가 없는 경우
  return {
    id: teacherCell.trim(),
    name: teacherCell.trim(),
  };
};

// 두 데이터 행 병합 (이름/과목이 2줄로 쪼개진 경우 처리)
function mergeTwoRows(row: any[], nextRow: any[]): any[] {
  const maxLen = Math.max(row.length, nextRow.length);
  const merged: any[] = new Array(maxLen);

  for (let col = 0; col < maxLen; col++) {
    const v1 = col < row.length ? row[col] ?? '' : '';
    const v2 = col < nextRow.length ? nextRow[col] ?? '' : '';

    const s1 = String(v1).trim();
    const s2 = String(v2).trim();

    if (col === 0) {
      // 순번은 첫 줄 기준
      merged[col] = s1 || s2 || '';
      continue;
    }

    if (col === 1) {
      // 교사명: "leesy104(" + "이석영)" 같은 경우 합치기
      if (s1 && s2) {
        merged[col] = s1 + s2;
      } else {
        merged[col] = s1 || s2 || '';
      }
      continue;
    }

    // 요일/교시 영역 (과목명/반)
    if (!s1 && !s2) {
      merged[col] = '';
      continue;
    }

    if (s1 && !s2) {
      merged[col] = s1;
      continue;
    }

    if (!s1 && s2) {
      merged[col] = s2;
      continue;
    }

    // s1, s2 둘 다 있는 경우
    const hasGradePrefix1 = /^\d학년\s+/.test(s1);
    const hasClassNumber1 = /\(\d+\)$/.test(s1);
    const hasClassNumber2 = /\(\d+\)$/.test(s2);

    // 예: "3학년 동아시아" + "사(1)" -> "3학년 동아시아사(1)"
    //     "2학년 물리" + "학Ⅰ(8)"   -> "2학년 물리학Ⅰ(8)"
    if (hasGradePrefix1 && !hasClassNumber1 && hasClassNumber2) {
      merged[col] = s1 + s2;
    } else if (hasGradePrefix1 && hasClassNumber1) {
      // 이미 완성된 형태: "1학년 한국사1(1)" + "(1)" 등 -> 기존 값 유지
      merged[col] = s1;
    } else {
      // 그 외 이상한 조합은 보수적으로 첫 줄 값 우선
      merged[col] = s1;
    }
  }

  return merged;
}

// Excel 파일 파싱
export async function parseExcelFile(file: File): Promise<ClassSchedule[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // 첫 번째 시트 사용
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 시트를 JSON으로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        }) as any[][];

        const schedules: ClassSchedule[] = [];

        // 헤더 행 찾기 (순번, 교사성명이 있는 행)
        let headerRowIndex = -1;
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (row && row.length > 0) {
            const firstCell = String(row[0] || '').trim();
            const secondCell = String(row[1] || '').trim();
            if (
              firstCell === '순번' ||
              firstCell === '순서' ||
              secondCell.includes('교사') ||
              secondCell.includes('성명')
            ) {
              headerRowIndex = i;
              break;
            }
          }
        }

        if (headerRowIndex === -1) {
          reject(new Error('헤더 행을 찾을 수 없습니다.'));
          return;
        }

        // 요일 헤더 찾기 (월, 화, 수, 목, 금, 토, 일)
        const headerRow = jsonData[headerRowIndex] as any[];
        const dayHeaders: { [key: string]: number } = {
          '월': 1,
          '화': 2,
          '수': 3,
          '목': 4,
          '금': 5,
          '토': 6,
          '일': 0,
        };

        // 각 요일의 시작 열 인덱스 찾기
        const dayColumnMap: { [dayOfWeek: number]: number } = {};

        // 헤더 행에서 요일 찾기
        for (let col = 0; col < headerRow.length; col++) {
          const cellValue = String(headerRow[col] || '').trim();
          if (dayHeaders[cellValue] !== undefined) {
            dayColumnMap[dayHeaders[cellValue]] = col;
          }
        }

        // 헤더 행에서 요일을 찾지 못한 경우, 다음 행도 확인
        if (
          Object.keys(dayColumnMap).length === 0 &&
          headerRowIndex + 1 < jsonData.length
        ) {
          const nextRow = jsonData[headerRowIndex + 1] as any[];
          for (let col = 0; col < nextRow.length; col++) {
            const cellValue = String(nextRow[col] || '').trim();
            if (dayHeaders[cellValue] !== undefined) {
              dayColumnMap[dayHeaders[cellValue]] = col;
            }
          }
        }

        console.log('Day column map:', dayColumnMap);

        // 요일을 찾지 못한 경우 에러
        if (Object.keys(dayColumnMap).length === 0) {
          reject(
            new Error(
              '요일 헤더를 찾을 수 없습니다. Excel 파일 형식을 확인해주세요.',
            ),
          );
          return;
        }

        // ============================
        // 데이터 행 전처리: 두 줄로 나뉜 행 병합
        // ============================
        const dataRows: any[][] = [];
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) {
            continue;
          }

          const orderCell = String(row[0] ?? '').trim();
          const teacherCell = String(row[1] ?? '').trim();

          const nextRow = i + 1 < jsonData.length ? (jsonData[i + 1] as any[]) : null;
          const nextOrderCell = nextRow ? String(nextRow[0] ?? '').trim() : '';
          const nextTeacherCell = nextRow ? String(nextRow[1] ?? '').trim() : '';

          const isOrderNumeric =
            !!orderCell && !isNaN(parseInt(orderCell, 10));
          const isNextOrderEmptyOrNonNumeric =
            !!nextRow && (!nextOrderCell || isNaN(parseInt(nextOrderCell, 10)));

          // 순번이 있고, 다음 줄 순번은 없고(또는 숫자 아님) → 같은 교사 시간표일 가능성이 큼
          if (isOrderNumeric && isNextOrderEmptyOrNonNumeric && nextRow) {
            // 이름이 실제로 두 줄로 쪼개진 경우이든,
            // 과목만 쪼개진 경우이든 일단 두 행을 병합해서 하나의 논리 행으로 사용
            const merged = mergeTwoRows(row, nextRow);
            dataRows.push(merged);
            i++; // 다음 줄은 이미 합쳤으므로 스킵
          } else {
            // 일반적인 한 줄짜리 행
            dataRows.push(row);
          }
        }

        // ============================
        // 병합된 데이터 행 기준으로 파싱
        // ============================
        for (const row of dataRows) {
          if (!row || row.length < 2) continue;

          // 순번이 숫자가 아니면 스킵 (빈 행 등)
          const orderNum = String(row[0] || '').trim();
          if (!orderNum || isNaN(parseInt(orderNum, 10))) continue;

          // 교사 정보 파싱
          const teacherInfo = parseTeacherName(row[1]);
          if (!teacherInfo) continue;

          // 각 요일별로 파싱
          for (const [dayOfWeekStr, dayOfWeek] of Object.entries(dayHeaders)) {
            const firstPeriodCol = dayColumnMap[dayOfWeek];
            if (firstPeriodCol === undefined) {
              console.warn(`요일 ${dayOfWeekStr}의 열을 찾을 수 없습니다.`);
              continue;
            }

            // 각 교시 파싱 (1-7교시)
            for (let period = 1; period <= 7; period++) {
              const periodCol = firstPeriodCol + (period - 1);

              if (periodCol < row.length) {
                const cellValue = row[periodCol];

                // 빈 셀은 스킵
                if (!cellValue || String(cellValue).trim() === '') continue;

                const parsed = parseCellContent(cellValue);

                if (parsed && parsed.grade && parsed.subject && parsed.classNumber) {
                  schedules.push({
                    id: `schedule-${teacherInfo.id}-${dayOfWeek}-${period}-${Date.now()}-${Math.random()}`,
                    teacherId: teacherInfo.id,
                    teacherName: teacherInfo.name,
                    subject: parsed.subject,
                    grade: parsed.grade,
                    classNumber: parsed.classNumber,
                    dayOfWeek: dayOfWeek,
                    period: period,
                  });
                }
              }
            }
          }
        }

        // 디버깅: 특정 교사 파싱 결과 확인용
        const eternalcsgSchedules = schedules.filter(
          (s) => s.teacherId === 'eternalcsg' && s.grade === 2 && s.classNumber === 7,
        );
        console.log('eternalcsg 2학년 7반 파싱 결과:', eternalcsgSchedules);

        resolve(schedules);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };

    reader.readAsArrayBuffer(file);
  });
}
