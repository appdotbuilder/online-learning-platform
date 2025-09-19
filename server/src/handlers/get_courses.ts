import { db } from '../db';
import { coursesTable } from '../db/schema';
import { type Course } from '../schema';
import { eq } from 'drizzle-orm';

export async function getCourses(): Promise<Course[]> {
  try {
    // Fetch all published courses for the public catalog
    const results = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.status, 'published'))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch courses:', error);
    throw error;
  }
}

export async function getCoursesByInstructor(instructorId: number): Promise<Course[]> {
  try {
    // Fetch all courses created by a specific instructor (regardless of status)
    const results = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.instructor_id, instructorId))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch courses by instructor:', error);
    throw error;
  }
}

export async function getCourseById(courseId: number): Promise<Course | null> {
  try {
    // Fetch a specific course by ID
    const results = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch course by ID:', error);
    throw error;
  }
}