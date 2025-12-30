// src/infra/supabase/storage.ts
import type {
  School,
  AcademicCalendar,
  SavedCalendar,
  ClassSchedule,
  ClassSession,
  ExamSegment,
  LessonPlanTemplate,
  StudentBaseTimetableRow,
} from '../../types';
import { supabase } from './client';

const isNotFound = (err: any) => err?.code === 'PGRST116';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** ✅ 5자리 학생코드: grade(1) + class_no(2) + student_no(2) => 예: 3학년 6반 1번 => "30601" */
const buildStudentCode = (grade: number, classNo: number, studentNo: number) =>
  `${Number(grade)}${pad2(Number(classNo))}${pad2(Number(studentNo))}`;

const toDigits = (v: string) => v.replace(/\D/g, '');

export const storage = {
  // ================================
  // 학교 관련
  // ================================
  async getSchools(): Promise<School[]> {
    try {
      const { data, error } = await supabase.from('schools').select('*').order('name');
      if (error) {
        console.error('Error fetching schools:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error in getSchools:', error);
      return [];
    }
  },

  async searchSchoolsByName(keyword: string): Promise<School[]> {
    const trimmed = keyword.trim();
    if (!trimmed) return [];

    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .ilike('name', `%${trimmed}%`)
        .order('name')
        .limit(10);

      if (error) {
        console.error('Error searching schools by name:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in searchSchoolsByName:', error);
      return [];
    }
  },

  async saveSchool(school: School): Promise<void> {
    try {
      const { error } = await supabase.from('schools').upsert(
        {
          id: school.id,
          name: school.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

      if (error) {
        console.error('Error saving school:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in saveSchool:', error);
      throw error;
    }
  },

  // ================================
  // 학사일정 관련
  // ================================
  async getCalendars(): Promise<SavedCalendar[]> {
    try {
      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .order('year', { ascending: false })
        .order('semester', { ascending: false });

      if (error) {
        console.error('Error fetching calendars:', error);
        return [];
      }
      if (!data) return [];

      return (data as any[]).map((cal) => ({
        id: cal.id,
        schoolId: cal.school_id,
        schoolName: cal.school_name,
        year: cal.year,
        semester: cal.semester,
        events: cal.events || [],
        createdAt: cal.created_at,
        updatedAt: cal.updated_at,
        savedAt: cal.saved_at,
      }));
    } catch (error) {
      console.error('Error in getCalendars:', error);
      return [];
    }
  },

  async saveCalendar(calendar: AcademicCalendar): Promise<SavedCalendar> {
    try {
      const savedAt = new Date().toISOString();

      const { data, error } = await supabase
        .from('calendars')
        .upsert(
          {
            id: calendar.id,
            school_id: calendar.schoolId,
            school_name: calendar.schoolName,
            year: calendar.year,
            semester: calendar.semester,
            events: calendar.events,
            updated_at: new Date().toISOString(),
            saved_at: savedAt,
          },
          { onConflict: 'school_id,year,semester' },
        )
        .select()
        .single();

      if (error) {
        console.error('Error saving calendar:', error);
        throw error;
      }

      return {
        id: data.id,
        schoolId: data.school_id,
        schoolName: data.school_name,
        year: data.year,
        semester: data.semester,
        events: data.events || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        savedAt: data.saved_at,
      };
    } catch (error) {
      console.error('Error in saveCalendar:', error);
      throw error;
    }
  },

  async getCalendarById(id: string): Promise<SavedCalendar | null> {
    try {
      const { data, error } = await supabase.from('calendars').select('*').eq('id', id).single();

      if (error) {
        if (isNotFound(error)) return null;
        console.error('Error fetching calendar:', error);
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        schoolId: data.school_id,
        schoolName: data.school_name,
        year: data.year,
        semester: data.semester,
        events: data.events || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        savedAt: data.saved_at,
      };
    } catch (error) {
      console.error('Error in getCalendarById:', error);
      return null;
    }
  },

  async getCalendarsBySchool(schoolId: string): Promise<SavedCalendar[]> {
    try {
      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .eq('school_id', schoolId)
        .order('year', { ascending: false })
        .order('semester', { ascending: false });

      if (error) {
        console.error('Error fetching calendars by school:', error);
        return [];
      }
      if (!data) return [];

      return (data as any[]).map((cal) => ({
        id: cal.id,
        schoolId: cal.school_id,
        schoolName: cal.school_name,
        year: cal.year,
        semester: cal.semester,
        events: cal.events || [],
        createdAt: cal.created_at,
        updatedAt: cal.updated_at,
        savedAt: cal.saved_at,
      }));
    } catch (error) {
      console.error('Error in getCalendarsBySchool:', error);
      return [];
    }
  },

  async getCalendarFor(schoolId: string, year: number, semester: 1 | 2): Promise<SavedCalendar | null> {
    try {
      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .eq('school_id', schoolId)
        .eq('year', year)
        .eq('semester', semester)
        .single();

      if (error) {
        if (isNotFound(error)) return null;
        console.error('Error fetching calendar for school/year/semester:', error);
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        schoolId: data.school_id,
        schoolName: data.school_name,
        year: data.year,
        semester: data.semester,
        events: data.events || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        savedAt: data.saved_at,
      };
    } catch (error) {
      console.error('Error in getCalendarFor:', error);
      return null;
    }
  },

  // ================================
  // 교사 시간표 관련
  // ================================
  async saveTeacherSchedules(
    schoolId: string,
    year: number,
    semester: 1 | 2,
    schedules: ClassSchedule[],
  ): Promise<void> {
    try {
      if (!schedules || schedules.length === 0) {
        console.warn('No schedules to save');
        return;
      }

      const now = new Date().toISOString();

      const schedulesToSave = schedules.map((schedule) => ({
        school_id: schoolId,
        year,
        semester,
        teacher_id: schedule.teacherId,
        teacher_name: schedule.teacherName,
        subject: schedule.subject,
        grade: schedule.grade,
        class_number: schedule.classNumber,
        day_of_week: schedule.dayOfWeek,
        period: schedule.period,
        updated_at: now,
      }));

      const { error: deleteError } = await supabase
        .from('teacher_schedules')
        .delete()
        .eq('school_id', schoolId)
        .eq('year', year)
        .eq('semester', semester);

      if (deleteError) {
        console.error('Error deleting old teacher schedules:', deleteError);
        throw deleteError;
      }

      const { error } = await supabase.from('teacher_schedules').insert(schedulesToSave);
      if (error) {
        console.error('Error saving teacher schedules:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in saveTeacherSchedules:', error);
      throw error;
    }
  },

  async getTeacherSchedules(schoolId: string, year: number, semester: 1 | 2): Promise<ClassSchedule[]> {
    try {
      const { data, error } = await supabase
        .from('teacher_schedules')
        .select('*')
        .eq('school_id', schoolId)
        .eq('year', year)
        .eq('semester', semester)
        .order('teacher_id')
        .order('grade')
        .order('class_number')
        .order('day_of_week')
        .order('period');

      if (error) {
        console.error('Error fetching teacher schedules:', error);
        return [];
      }
      if (!data) return [];

      return (data as any[]).map((s) => ({
        id: s.id,
        teacherId: s.teacher_id,
        teacherName: s.teacher_name,
        subject: s.subject,
        grade: s.grade,
        classNumber: s.class_number,
        dayOfWeek: s.day_of_week,
        period: s.period,
        schoolId: s.school_id,
        year: s.year,
        semester: s.semester,
      }));
    } catch (error) {
      console.error('Error in getTeacherSchedules:', error);
      return [];
    }
  },

  // ================================
  // 수업 세션 관련
  // ================================
  async getClassSessionsByTeacherGradeSubject(
    schoolId: string,
    year: number,
    semester: 1 | 2,
    teacherId: string,
    grade: number,
    subject: string,
  ): Promise<ClassSession[]> {
    try {
      const { data, error } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('school_id', schoolId)
        .eq('year', year)
        .eq('semester', semester)
        .eq('teacher_id', teacherId)
        .eq('grade', grade)
        .eq('subject', subject)
        .order('date')
        .order('period');

      if (error) {
        console.error('Error fetching class sessions by teacher/grade/subject:', error);
        return [];
      }
      if (!data) return [];

      return (data as any[]).map((s) => ({
        id: s.id,
        sessionNumber: s.session_number,
        date: s.date,
        dayOfWeek: s.day_of_week,
        period: s.period,
        classInfo: s.class_info,
        academicEvent: s.academic_event ?? '',
        content: s.content ?? '',
        isBeforeFirstTest: s.is_before_first_test ?? false,
        segment: (s.segment ?? undefined) as ExamSegment | undefined,

        schoolId: s.school_id,
        year: s.year,
        semester: s.semester,
        teacherId: s.teacher_id,
        teacherName: s.teacher_name,
        grade: s.grade,
        classNumber: s.class_number,
        subject: s.subject,
      }));
    } catch (error) {
      console.error('Error in getClassSessionsByTeacherGradeSubject:', error);
      return [];
    }
  },

  async saveClassSessions(
    schoolId: string,
    year: number,
    semester: 1 | 2,
    teacherId: string,
    teacherName: string,
    grade: number,
    classNumber: number,
    subject: string,
    sessions: ClassSession[],
  ): Promise<void> {
    try {
      if (!sessions || sessions.length === 0) {
        console.warn('No class sessions to save');
        return;
      }

      const now = new Date().toISOString();

      const sessionsToSave = sessions.map((session) => ({
        school_id: schoolId,
        year,
        semester,
        teacher_id: teacherId,
        teacher_name: teacherName,
        grade,
        class_number: classNumber,
        subject,
        session_number: session.sessionNumber,
        date: session.date,
        day_of_week: session.dayOfWeek,
        period: session.period,
        class_info: session.classInfo,
        academic_event: session.academicEvent ?? '',
        content: session.content ?? '',
        is_before_first_test: session.isBeforeFirstTest ?? false,
        segment: session.segment ?? null,
        updated_at: now,
      }));

      const { error: deleteError } = await supabase
        .from('class_sessions')
        .delete()
        .eq('school_id', schoolId)
        .eq('year', year)
        .eq('semester', semester)
        .eq('teacher_id', teacherId)
        .eq('grade', grade)
        .eq('class_number', classNumber);

      if (deleteError) {
        console.error('Error deleting old class sessions:', deleteError);
        throw deleteError;
      }

      const { error } = await supabase.from('class_sessions').insert(sessionsToSave);
      if (error) {
        console.error('Error saving class sessions:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in saveClassSessions:', error);
      throw error;
    }
  },

  async getClassSessions(
    schoolId: string,
    year: number,
    semester: 1 | 2,
    teacherId: string,
    grade: number,
    classNumber: number,
    subject: string,
  ): Promise<ClassSession[]> {
    try {
      const { data, error } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('school_id', schoolId)
        .eq('year', year)
        .eq('semester', semester)
        .eq('teacher_id', teacherId)
        .eq('grade', grade)
        .eq('class_number', classNumber)
        .eq('subject', subject)
        .order('date')
        .order('period');

      if (error) {
        console.error('Error fetching class sessions:', error);
        return [];
      }
      if (!data) return [];

      return (data as any[]).map((s) => ({
        id: s.id,
        sessionNumber: s.session_number,
        date: s.date,
        dayOfWeek: s.day_of_week,
        period: s.period,
        classInfo: s.class_info,
        academicEvent: s.academic_event ?? '',
        content: s.content ?? '',
        isBeforeFirstTest: s.is_before_first_test ?? false,
        segment: (s.segment ?? undefined) as ExamSegment | undefined,

        schoolId: s.school_id,
        year: s.year,
        semester: s.semester,
        teacherId: s.teacher_id,
        teacherName: s.teacher_name,
        grade: s.grade,
        classNumber: s.class_number,
        subject: s.subject,
      }));
    } catch (error) {
      console.error('Error in getClassSessions:', error);
      return [];
    }
  },

// ================================
// 학생 시간표 관련
// ================================
async saveStudentTimetables(rows: StudentBaseTimetableRow[]): Promise<void> {
  try {
    if (!rows || rows.length === 0) {
      console.warn('No student timetables to save');
      return;
    }

    // ✅ 혼입 방지: 한 번 저장 호출에는 school/year/semester가 동일해야 함
    const { schoolId, year, semester } = rows[0];
    const mixed = rows.find(
      (r) => r.schoolId !== schoolId || r.year !== year || r.semester !== semester,
    );
    if (mixed) {
      throw new Error(
        `[saveStudentTimetables] 서로 다른 학교/학년도/학기가 섞여 있습니다. ` +
          `첫 행: (${schoolId}, ${year}, ${semester}) / 혼입 행: (${mixed.schoolId}, ${mixed.year}, ${mixed.semester})`,
      );
    }

    // ✅ 기존 데이터 삭제 (교사와 동일한 운영 모델: 학기 단위 덮어쓰기)
    const { error: deleteError } = await supabase
      .from('student_timetables')
      .delete()
      .eq('school_id', schoolId)
      .eq('year', year)
      .eq('semester', semester);

    if (deleteError) {
      console.error('Error deleting old student timetables:', deleteError);
      throw deleteError;
    }

    // ✅ 유효성/중복 제거
    const dedup = new Map<string, any>();
    const invalidStudents: Array<{
      studentNumber: string;
      studentName: string;
      grade: number;
      classNumber: number;
    }> = [];

    for (const r of rows) {
      const grade = Number(r.grade);
      const classNo = Number(r.classNumber);
      const studentNo = Number(toDigits(String(r.studentNumber || '')) || '0');

      // 필수 값 검증(전체 실패 방지: invalid는 스킵)
      if (!grade || !classNo || !studentNo) {
        invalidStudents.push({
          studentNumber: String(r.studentNumber ?? ''),
          studentName: r.studentName,
          grade,
          classNumber: classNo,
        });
        continue;
      }

      const subject = String(r.subject ?? '').trim();
      if (!subject) continue;

      // ✅ 핵심: student_code 반드시 생성하여 넣기
      const studentCode = buildStudentCode(grade, classNo, studentNo);

      // ✅ (가장 일반적인) 유니크 키 후보로 중복 제거
      const key = [
        r.schoolId,
        r.year,
        r.semester,
        studentCode,
        r.dayOfWeek,
        r.period,
      ].join('|');

      if (dedup.has(key)) continue;

      dedup.set(key, {
        school_id: r.schoolId,
        year: r.year,
        semester: r.semester,
      
        grade,
        class_no: classNo,
        student_no: studentNo,
        student_name: r.studentName,
      
        // ✅ student_code는 DB GENERATED ALWAYS 컬럼일 가능성이 높으므로 INSERT에서 제외
      
        day_of_week: r.dayOfWeek,
        period: r.period,
      
        subject,
        teacher_id: r.teacherId ?? null,
        teacher_name: r.teacherName ?? null,
        room: (r as any).room ?? null,
      });
      
    }

    const payload = Array.from(dedup.values());

    if (payload.length === 0) {
      // invalid만 존재한 케이스
      const sample = invalidStudents.slice(0, 5);
      throw new Error(
        `[saveStudentTimetables] 저장 가능한 유효 행이 없습니다. ` +
          `학번/학년/반이 비정상인 학생이 존재할 수 있습니다. 예시: ${JSON.stringify(sample)}`,
      );
    }

    if (invalidStudents.length > 0) {
      console.warn(
        '[saveStudentTimetables] 일부 학생 행이 유효하지 않아 스킵되었습니다:',
        invalidStudents.slice(0, 10),
        `... total=${invalidStudents.length}`,
      );
    }

    // ✅ 대용량 방어(한 번에 너무 많이 insert하면 실패하는 환경이 있어 배치로 나눔)
    const BATCH = 500;
    for (let i = 0; i < payload.length; i += BATCH) {
      const chunk = payload.slice(i, i + BATCH);
      const { error: insertError } = await supabase
        .from('student_timetables')
        .insert(chunk);

      if (insertError) {
        const e = new Error(insertError.message);
        (e as any).code = insertError.code;
        (e as any).details = insertError.details;
        (e as any).hint = insertError.hint;
        throw e;
      }
    }

    console.log('[saveStudentTimetables] inserted rows:', payload.length);
  } catch (error) {
    console.error('Error in saveStudentTimetables:', error);
    throw error;
  }
},


// 🔹 학번(예: 30601)으로 학생 시간표 조회 (혼입/오조회 방지 버전)
async getStudentTimetableByStudentCode(
  schoolId: string,
  year: number,
  semester: 1 | 2,
  studentCode: string,
): Promise<StudentBaseTimetableRow[]> {
  const raw = (studentCode ?? '').trim();
  const digits = toDigits(raw);
  if (!digits) return [];

  // 5자리(30601) 우선. 5자리 미만이면(예: 601) grade 없이 class+no로만 해석
  const hasGrade = digits.length >= 5;
  const code5 = hasGrade ? digits.slice(-5).padStart(5, '0') : digits.padStart(3, '0');

  const grade = hasGrade ? Number(code5.slice(0, 1)) : null;
  const classNo = hasGrade ? Number(code5.slice(1, 3)) : Number(code5.slice(0, -2));
  const studentNo = hasGrade ? Number(code5.slice(3, 5)) : Number(code5.slice(-2));

  if (!classNo || !studentNo || (hasGrade && !grade)) return [];

  const mapRows = (data: any[]): StudentBaseTimetableRow[] =>
    data.map((row) => ({
      schoolId: row.school_id,
      year: row.year,
      semester: row.semester,

      grade: row.grade,
      classNumber: row.class_no,
      studentNumber: String(row.student_no),
      studentName: row.student_name,

      dayOfWeek: row.day_of_week,
      period: row.period,
      subject: row.subject,
      teacherId: row.teacher_id ?? undefined,
      teacherName: row.teacher_name ?? undefined,
      room: row.room ?? undefined,
    }));

  const ensureSingleStudent = (data: any[], require5: boolean) => {
    const keys = new Set(data.map((r) => `${r.grade}-${r.class_no}-${r.student_no}-${r.student_name}`));
    if (keys.size !== 1) {
      throw new Error(
        require5
          ? '조회 결과가 여러 학생으로 섞였습니다. 5자리 학번(예: 30601)으로 다시 조회해주세요.'
          : '학년 정보가 없는 학번 입력으로 여러 학생이 조회됩니다. 5자리 학번(예: 30601)으로 입력해주세요.',
      );
    }
  };

  try {
    // 1) (우선) student_code로 정확 조회 (가장 안전, 혼입 거의 0)
    if (hasGrade) {
      const exactCode = buildStudentCode(grade as number, classNo, studentNo);

      {
        const { data, error } = await supabase
          .from('student_timetables')
          .select('*')
          .eq('school_id', schoolId)
          .eq('year', year)
          .eq('semester', semester)
          .eq('student_code', exactCode)
          .order('day_of_week', { ascending: true })
          .order('period', { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          ensureSingleStudent(data as any[], true);
          return mapRows(data as any[]);
        }
      }

      // 2) fallback: grade + class_no + student_no 로 정확 조회
      {
        const { data, error } = await supabase
          .from('student_timetables')
          .select('*')
          .eq('school_id', schoolId)
          .eq('year', year)
          .eq('semester', semester)
          .eq('grade', grade as number)
          .eq('class_no', classNo)
          .eq('student_no', studentNo)
          .order('day_of_week', { ascending: true })
          .order('period', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) return [];

        ensureSingleStudent(data as any[], true);
        return mapRows(data as any[]);
      }
    }

    // 5자리 미만 입력(예: 601)일 때: class_no + student_no로 조회는 가능하지만,
    // 여러 학년이 걸릴 수 있으니 결과가 1명인지 강제 체크
    const { data, error } = await supabase
      .from('student_timetables')
      .select('*')
      .eq('school_id', schoolId)
      .eq('year', year)
      .eq('semester', semester)
      .eq('class_no', classNo)
      .eq('student_no', studentNo)
      .order('grade', { ascending: true })
      .order('day_of_week', { ascending: true })
      .order('period', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    ensureSingleStudent(data as any[], false);
    return mapRows(data as any[]);
  } catch (error) {
    console.error('Error in getStudentTimetableByStudentCode:', error);
    throw error;
  }
},


  // ================================
  // 수업 계획 템플릿 관련
  // ================================
  async getLessonPlanTemplates(
    schoolId: string,
    year: number,
    semester: 1 | 2,
    teacherId: string,
    grade: number,
    subject: string,
    segment: ExamSegment,
  ): Promise<LessonPlanTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('lesson_plan_templates')
        .select('*')
        .eq('school_id', schoolId)
        .eq('year', year)
        .eq('semester', semester)
        .eq('teacher_id', teacherId)
        .eq('grade', grade)
        .eq('subject', subject)
        .eq('segment', segment)
        .order('session_index', { ascending: true });

      if (error) {
        console.error('Error fetching lesson plan templates:', error);
        return [];
      }
      if (!data) return [];

      return (data as any[]).map((row) => ({
        id: row.id,
        schoolId: row.school_id,
        year: row.year,
        semester: row.semester,
        teacherId: row.teacher_id,
        grade: row.grade,
        subject: row.subject,
        segment: row.segment as ExamSegment,
        sessionIndex: row.session_index,
        content: row.content ?? '',
      }));
    } catch (error) {
      console.error('Error in getLessonPlanTemplates:', error);
      return [];
    }
  },

  async saveLessonPlanTemplates(
    schoolId: string,
    year: number,
    semester: 1 | 2,
    teacherId: string,
    grade: number,
    subject: string,
    segment: ExamSegment,
    rows: { sessionIndex: number; content: string }[],
  ): Promise<void> {
    try {
      if (rows.length === 0) {
        const { error: deleteError } = await supabase
          .from('lesson_plan_templates')
          .delete()
          .eq('school_id', schoolId)
          .eq('year', year)
          .eq('semester', semester)
          .eq('teacher_id', teacherId)
          .eq('grade', grade)
          .eq('subject', subject)
          .eq('segment', segment);

        if (deleteError) {
          console.error('Error deleting lesson plan templates:', deleteError);
          throw deleteError;
        }
        return;
      }

      const now = new Date().toISOString();

      const payload = rows.map((row) => ({
        school_id: schoolId,
        year,
        semester,
        teacher_id: teacherId,
        grade,
        subject,
        segment,
        session_index: row.sessionIndex,
        content: row.content,
        updated_at: now,
      }));

      const { error } = await supabase.from('lesson_plan_templates').upsert(payload, {
        onConflict: 'school_id,year,semester,teacher_id,grade,subject,segment,session_index',
      });

      if (error) {
        console.error('Error saving lesson plan templates:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in saveLessonPlanTemplates:', error);
      throw error;
    }
  },
};
