import * as XLSX from 'xlsx';
import type { StudentBaseTimetableRow } from '../../types';

export interface StudentTimetableParseOptions {
  schoolId: string;
  year: number;
  semester: 1 | 2;
}

/**
 * 나이스 "학생별 수업시간표" 엑셀을 파싱해서 StudentBaseTimetableRow[] 형태로 반환합니다.
 */
export async function parseStudentTimetable(
  file: File,
  options: StudentTimetableParseOptions,
): Promise<StudentBaseTimetableRow[]> {
  const { schoolId, year, semester } = options;

  // ✅ 보수적 헬퍼: 값이 string이 아니어도 안전하게 처리
  const toText = (v: any) => (v === undefined || v === null ? '' : String(v)).trim();
  const norm = (v: any) => toText(v).replace(/\s+/g, '');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) return resolve([]);

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        if (!worksheet) {
          console.warn('[parseStudentTimetable] No worksheet found');
          return resolve([]);
        }

        const sheet = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: '', // ✅ 교사 파서처럼 열 안정화
        }) as any[][];
        

        if (!sheet || sheet.length === 0) {
          console.warn('[parseStudentTimetable] Empty worksheet');
          return resolve([]);
        }

        const result: StudentBaseTimetableRow[] = [];

        let rowIndex = 0;
        while (rowIndex < sheet.length) {
          const row = sheet[rowIndex] ?? [];
          const cell0 = row[0];

          if (typeof cell0 === 'string') {
            const headerMatch = cell0.match(
              /(\d+)학년도\s+(\d)학기\s+(\d+)학년\s+(\d+)반\s+(\d+)번\s*(.+)/,
            );

            if (headerMatch) {
              const baseGrade = parseInt(headerMatch[3], 10);
              const baseClassNumber = parseInt(headerMatch[4], 10);
              const studentNumber = headerMatch[5]; // 기존 유지 (string)
              const studentName = headerMatch[6].trim();

              // 1) 요일 헤더 행 찾기
              let headerRowIndex = rowIndex + 1;
              while (headerRowIndex < sheet.length) {
                const hdr = sheet[headerRowIndex] ?? [];
                const first = hdr[0];
                const joined = hdr.map((c) => toText(c)).join('');

                const looksLikeHeader =
                  (typeof first === 'string' && /교\s*시/.test(first)) ||
                  joined.includes('월') ||
                  joined.includes('화') ||
                  joined.includes('수') ||
                  joined.includes('목') ||
                  joined.includes('금');

                if (looksLikeHeader) break;
                headerRowIndex++;
              }

              if (headerRowIndex >= sheet.length) {
                rowIndex++;
                continue;
              }

              const headerRow = sheet[headerRowIndex] ?? [];

              // 2) 요일 -> 실제 컬럼 인덱스 매핑
              const dayColIndex: Record<number, number> = {};

              for (let c = 0; c < headerRow.length; c++) {
                const t = norm(headerRow[c]); // ✅ string 아닌 값도 안전하게 정규화

                if (!dayColIndex[1] && (t.startsWith('월') || t.includes('월요일'))) {
                  dayColIndex[1] = c;
                } else if (!dayColIndex[2] && (t.startsWith('화') || t.includes('화요일'))) {
                  dayColIndex[2] = c;
                } else if (!dayColIndex[3] && (t.startsWith('수') || t.includes('수요일'))) {
                  dayColIndex[3] = c;
                } else if (!dayColIndex[4] && (t.startsWith('목') || t.includes('목요일'))) {
                  dayColIndex[4] = c;
                } else if (!dayColIndex[5] && (t.startsWith('금') || t.includes('금요일'))) {
                  dayColIndex[5] = c;
                }
              }

              // ✅ fallback은 제거하되, “전부 못 찾음”은 즉시 에러로 막음 (DB 비움 방지)
              if (Object.keys(dayColIndex).length === 0) {
                throw new Error(
                  `[parseStudentTimetable] 요일 헤더 매핑 실패: headerRow=${JSON.stringify(headerRow)}`,
                );
              }

              for (let d = 1; d <= 5; d++) {
                if (dayColIndex[d] == null) {
                  console.warn(
                    `[parseStudentTimetable] 요일 헤더 컬럼을 찾지 못했습니다. day=${d}, headerRow=`,
                    headerRow,
                  );
                }
              }

              // 3) 교시 블록 파싱
              let r = headerRowIndex + 1;

              while (r < sheet.length) {
                const periodRow = sheet[r] ?? [];
                const labelText = norm(periodRow[0]);

                const periodMatch = labelText.match(/(\d+)교시/);
                if (!periodMatch) break;

                const period = parseInt(periodMatch[1], 10);
                const subjectRow = sheet[r + 1];
                if (!subjectRow) break;

                for (let day = 1; day <= 5; day++) {
                  const col = dayColIndex[day];
                  if (col == null) continue; // ✅ 못 찾은 요일은 스킵

                  const subjectRaw = toText(subjectRow[col]);
                  if (!subjectRaw) continue;

                  let subject = subjectRaw;
                  let teacherName: string | undefined;
                  let teacherId: string | undefined;

                  const subjectMatch = subjectRaw.match(/(.+?)\((.+?)\)$/);
                  if (subjectMatch) {
                    subject = subjectMatch[1].trim();
                    teacherName = subjectMatch[2].trim();
                  }

                  result.push({
                    schoolId,
                    year,
                    semester,
                    grade: baseGrade,
                    classNumber: baseClassNumber,
                    studentNumber,
                    studentName,
                    dayOfWeek: day,
                    period,
                    subject,
                    teacherId,
                    teacherName,
                  });
                }

                r += 2; // 교시 행 + 과목 행
              }

              rowIndex = r;
              continue;
            }
          }

          rowIndex += 1;
        }

        console.log('[parseStudentTimetable] parsed rows:', result.length);
        resolve(result);
      } catch (err) {
        console.error('[parseStudentTimetable] Error:', err);
        reject(err);
      }
    };

    reader.onerror = (err) => {
      console.error('[parseStudentTimetable] FileReader error:', err);
      reject(err as any);
    };

    reader.readAsArrayBuffer(file);
  });
}
