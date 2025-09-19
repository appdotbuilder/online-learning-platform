import { db } from '../db';
import { 
  coursesTable, 
  consultationSlotsTable, 
  enrollmentsTable,
  usersTable 
} from '../db/schema';
import { type InstructorDashboard } from '../schema';
import { eq, and, gte, avg, count } from 'drizzle-orm';

export async function getInstructorDashboard(instructorId: number): Promise<InstructorDashboard> {
  try {
    // Fetch instructor's created courses
    const createdCoursesResult = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.instructor_id, instructorId))
      .execute();

    // Fetch upcoming consultations (booked slots with future start times)
    const now = new Date();
    const upcomingConsultationsResult = await db.select()
      .from(consultationSlotsTable)
      .where(and(
        eq(consultationSlotsTable.instructor_id, instructorId),
        eq(consultationSlotsTable.status, 'booked'),
        gte(consultationSlotsTable.start_time, now)
      ))
      .execute();

    // Fetch student progress overview for instructor's courses
    const studentProgressResult = await db.select({
      course_id: coursesTable.id,
      course_title: coursesTable.title,
      total_students: count(enrollmentsTable.id),
      average_progress: avg(enrollmentsTable.progress_percentage)
    })
      .from(coursesTable)
      .leftJoin(enrollmentsTable, eq(coursesTable.id, enrollmentsTable.course_id))
      .where(eq(coursesTable.instructor_id, instructorId))
      .groupBy(coursesTable.id, coursesTable.title)
      .execute();

    // Process the student progress data to ensure proper numeric conversion
    const studentProgressOverview = studentProgressResult.map(result => ({
      course_id: result.course_id,
      course_title: result.course_title,
      total_students: result.total_students || 0,
      average_progress: result.average_progress ? parseFloat(result.average_progress.toString()) : 0
    }));

    return {
      created_courses: createdCoursesResult,
      upcoming_consultations: upcomingConsultationsResult,
      student_progress_overview: studentProgressOverview
    };
  } catch (error) {
    console.error('Failed to fetch instructor dashboard:', error);
    throw error;
  }
}