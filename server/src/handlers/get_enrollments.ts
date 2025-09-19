import { db } from '../db';
import { enrollmentsTable } from '../db/schema';
import { type Enrollment } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function getEnrollmentsByStudent(studentId: number): Promise<Enrollment[]> {
  try {
    const results = await db.select()
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.student_id, studentId))
      .execute();

    return results.map(enrollment => ({
      ...enrollment,
      progress_percentage: parseFloat(enrollment.progress_percentage as any)
    }));
  } catch (error) {
    console.error('Failed to get enrollments by student:', error);
    throw error;
  }
}

export async function getEnrollmentsByCourse(courseId: number): Promise<Enrollment[]> {
  try {
    const results = await db.select()
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.course_id, courseId))
      .execute();

    return results.map(enrollment => ({
      ...enrollment,
      progress_percentage: parseFloat(enrollment.progress_percentage as any)
    }));
  } catch (error) {
    console.error('Failed to get enrollments by course:', error);
    throw error;
  }
}

export async function checkEnrollment(studentId: number, courseId: number): Promise<Enrollment | null> {
  try {
    const results = await db.select()
      .from(enrollmentsTable)
      .where(
        and(
          eq(enrollmentsTable.student_id, studentId),
          eq(enrollmentsTable.course_id, courseId)
        )
      )
      .execute();

    if (results.length === 0) {
      return null;
    }

    const enrollment = results[0];
    return {
      ...enrollment,
      progress_percentage: parseFloat(enrollment.progress_percentage as any)
    };
  } catch (error) {
    console.error('Failed to check enrollment:', error);
    throw error;
  }
}