import { db } from '../db';
import { lessonsTable, coursesTable } from '../db/schema';
import { type CreateLessonInput, type Lesson } from '../schema';
import { eq } from 'drizzle-orm';

export const createLesson = async (input: CreateLessonInput): Promise<Lesson> => {
  try {
    // Verify that the course exists
    const course = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, input.course_id))
      .execute();

    if (course.length === 0) {
      throw new Error(`Course with ID ${input.course_id} not found`);
    }

    // Insert the lesson record
    const result = await db.insert(lessonsTable)
      .values({
        course_id: input.course_id,
        title: input.title,
        content: input.content,
        lesson_type: input.lesson_type,
        order_index: input.order_index,
        video_url: input.video_url,
        document_url: input.document_url
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Lesson creation failed:', error);
    throw error;
  }
};