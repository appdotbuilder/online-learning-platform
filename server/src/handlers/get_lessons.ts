import { db } from '../db';
import { lessonsTable } from '../db/schema';
import { type Lesson } from '../schema';
import { eq, asc } from 'drizzle-orm';

export async function getLessonsByCourse(courseId: number): Promise<Lesson[]> {
  try {
    const results = await db.select()
      .from(lessonsTable)
      .where(eq(lessonsTable.course_id, courseId))
      .orderBy(asc(lessonsTable.order_index))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch lessons by course:', error);
    throw error;
  }
}

export async function getLessonById(lessonId: number): Promise<Lesson | null> {
  try {
    const results = await db.select()
      .from(lessonsTable)
      .where(eq(lessonsTable.id, lessonId))
      .execute();

    return results[0] || null;
  } catch (error) {
    console.error('Failed to fetch lesson by ID:', error);
    throw error;
  }
}