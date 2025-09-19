import { db } from '../db';
import { testsTable, coursesTable } from '../db/schema';
import { type CreateTestInput, type Test } from '../schema';
import { eq } from 'drizzle-orm';

export async function createTest(input: CreateTestInput): Promise<Test> {
  try {
    // Verify that the course exists first to prevent foreign key constraint violations
    const course = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, input.course_id))
      .execute();

    if (course.length === 0) {
      throw new Error(`Course with id ${input.course_id} not found`);
    }

    // Insert test record
    const result = await db.insert(testsTable)
      .values({
        course_id: input.course_id,
        title: input.title,
        description: input.description,
        time_limit_minutes: input.time_limit_minutes,
        max_attempts: input.max_attempts,
        passing_score: input.passing_score // Real column accepts numbers directly
      })
      .returning()
      .execute();

    const test = result[0];
    return test;
  } catch (error) {
    console.error('Test creation failed:', error);
    throw error;
  }
}