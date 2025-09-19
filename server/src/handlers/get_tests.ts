import { db } from '../db';
import { testsTable } from '../db/schema';
import { type Test } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function getTestsByCourse(courseId: number): Promise<Test[]> {
  try {
    const results = await db.select()
      .from(testsTable)
      .where(eq(testsTable.course_id, courseId))
      .execute();

    return results.map(test => ({
      ...test,
      passing_score: parseFloat(test.passing_score.toString()) // Convert numeric to number
    }));
  } catch (error) {
    console.error('Failed to fetch tests by course:', error);
    throw error;
  }
}

export async function getTestById(testId: number): Promise<Test | null> {
  try {
    const results = await db.select()
      .from(testsTable)
      .where(eq(testsTable.id, testId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const test = results[0];
    return {
      ...test,
      passing_score: parseFloat(test.passing_score.toString()) // Convert numeric to number
    };
  } catch (error) {
    console.error('Failed to fetch test by ID:', error);
    throw error;
  }
}

export async function getPublishedTestsByCourse(courseId: number): Promise<Test[]> {
  try {
    const results = await db.select()
      .from(testsTable)
      .where(and(
        eq(testsTable.course_id, courseId),
        eq(testsTable.is_published, true)
      ))
      .execute();

    return results.map(test => ({
      ...test,
      passing_score: parseFloat(test.passing_score.toString()) // Convert numeric to number
    }));
  } catch (error) {
    console.error('Failed to fetch published tests by course:', error);
    throw error;
  }
}