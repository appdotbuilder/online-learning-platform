import { db } from '../db';
import { 
  coursesTable, 
  enrollmentsTable, 
  lessonProgressTable, 
  consultationSlotsTable, 
  digitalResourcesTable 
} from '../db/schema';
import { type StudentDashboard } from '../schema';
import { eq, and, desc, or, isNull } from 'drizzle-orm';

export async function getStudentDashboard(studentId: number): Promise<StudentDashboard> {
  try {
    // Get enrolled courses with their details
    const enrolledCoursesResult = await db
      .select({
        id: coursesTable.id,
        title: coursesTable.title,
        description: coursesTable.description,
        instructor_id: coursesTable.instructor_id,
        status: coursesTable.status,
        created_at: coursesTable.created_at,
        updated_at: coursesTable.updated_at
      })
      .from(coursesTable)
      .innerJoin(enrollmentsTable, eq(coursesTable.id, enrollmentsTable.course_id))
      .where(eq(enrollmentsTable.student_id, studentId))
      .execute();

    // Get recent lesson progress (last 10 completed lessons)
    const recentProgressResult = await db
      .select()
      .from(lessonProgressTable)
      .where(
        and(
          eq(lessonProgressTable.student_id, studentId),
          eq(lessonProgressTable.is_completed, true)
        )
      )
      .orderBy(desc(lessonProgressTable.completed_at))
      .limit(10)
      .execute();

    // Get upcoming consultations (booked slots for this student in the future)
    const upcomingConsultationsResult = await db
      .select()
      .from(consultationSlotsTable)
      .where(
        and(
          eq(consultationSlotsTable.student_id, studentId),
          eq(consultationSlotsTable.status, 'booked')
        )
      )
      .orderBy(consultationSlotsTable.start_time)
      .execute();

    // Get available digital resources (global resources + course-specific for enrolled courses)
    const enrolledCourseIds = enrolledCoursesResult.map(course => course.id);
    
    let availableResourcesResult;
    if (enrolledCourseIds.length > 0) {
      // Get global resources (course_id is null) and resources from enrolled courses
      availableResourcesResult = await db
        .select()
        .from(digitalResourcesTable)
        .where(
          or(
            isNull(digitalResourcesTable.course_id),
            ...enrolledCourseIds.map(courseId => eq(digitalResourcesTable.course_id, courseId))
          )
        )
        .orderBy(desc(digitalResourcesTable.created_at))
        .execute();
    } else {
      // Only get global resources if not enrolled in any courses
      availableResourcesResult = await db
        .select()
        .from(digitalResourcesTable)
        .where(isNull(digitalResourcesTable.course_id))
        .orderBy(desc(digitalResourcesTable.created_at))
        .execute();
    }

    return {
      enrolled_courses: enrolledCoursesResult,
      recent_progress: recentProgressResult,
      upcoming_consultations: upcomingConsultationsResult,
      available_resources: availableResourcesResult
    };
  } catch (error) {
    console.error('Failed to get student dashboard:', error);
    throw error;
  }
}