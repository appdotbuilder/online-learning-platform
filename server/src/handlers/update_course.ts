import { db } from '../db';
import { coursesTable } from '../db/schema';
import { type UpdateCourseInput, type Course } from '../schema';
import { eq } from 'drizzle-orm';

export const updateCourse = async (input: UpdateCourseInput): Promise<Course> => {
  try {
    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.title !== undefined) {
      updateData.title = input.title;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    // Update the course record
    const result = await db.update(coursesTable)
      .set(updateData)
      .where(eq(coursesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Course with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Course update failed:', error);
    throw error;
  }
};