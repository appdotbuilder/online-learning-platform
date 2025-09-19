import { db } from '../db';
import { coursesTable, usersTable } from '../db/schema';
import { type CreateCourseInput, type Course } from '../schema';
import { eq } from 'drizzle-orm';

export const createCourse = async (input: CreateCourseInput): Promise<Course> => {
  try {
    // Verify that the instructor exists and has the correct role
    const instructor = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.instructor_id))
      .execute();

    if (instructor.length === 0) {
      throw new Error('Instructor not found');
    }

    if (instructor[0].role !== 'instructor') {
      throw new Error('User must be an instructor to create courses');
    }

    // Insert course record with draft status
    const result = await db.insert(coursesTable)
      .values({
        title: input.title,
        description: input.description,
        instructor_id: input.instructor_id,
        status: 'draft' // Default status for new courses
      })
      .returning()
      .execute();

    const course = result[0];
    return course;
  } catch (error) {
    console.error('Course creation failed:', error);
    throw error;
  }
};