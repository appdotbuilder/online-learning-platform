import { db } from '../db';
import { lessonProgressTable, lessonsTable } from '../db/schema';
import { type LessonProgress } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

export async function getLessonProgressByStudent(studentId: number, courseId?: number): Promise<LessonProgress[]> {
  try {
    if (courseId !== undefined) {
      // Use join when courseId filter is needed
      const results = await db.select()
        .from(lessonProgressTable)
        .innerJoin(
          lessonsTable,
          eq(lessonProgressTable.lesson_id, lessonsTable.id)
        )
        .where(and(
          eq(lessonProgressTable.student_id, studentId),
          eq(lessonsTable.course_id, courseId)
        ))
        .execute();

      return results.map(result => ({
        ...result.lesson_progress,
        // Ensure dates are properly converted
        completed_at: result.lesson_progress.completed_at ? new Date(result.lesson_progress.completed_at) : null,
        created_at: new Date(result.lesson_progress.created_at)
      }));
    } else {
      // Simple query without join when no courseId filter
      const results = await db.select()
        .from(lessonProgressTable)
        .where(eq(lessonProgressTable.student_id, studentId))
        .execute();

      return results.map(progress => ({
        ...progress,
        // Ensure dates are properly converted
        completed_at: progress.completed_at ? new Date(progress.completed_at) : null,
        created_at: new Date(progress.created_at)
      }));
    }
  } catch (error) {
    console.error('Failed to fetch lesson progress by student:', error);
    throw error;
  }
}

export async function getLessonProgressByLesson(lessonId: number): Promise<LessonProgress[]> {
  try {
    const results = await db.select()
      .from(lessonProgressTable)
      .where(eq(lessonProgressTable.lesson_id, lessonId))
      .execute();

    return results.map(progress => ({
      ...progress,
      // Ensure dates are properly converted
      completed_at: progress.completed_at ? new Date(progress.completed_at) : null,
      created_at: new Date(progress.created_at)
    }));
  } catch (error) {
    console.error('Failed to fetch lesson progress by lesson:', error);
    throw error;
  }
}