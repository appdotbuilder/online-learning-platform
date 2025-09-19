import { db } from '../db';
import { testAttemptsTable, testsTable, usersTable } from '../db/schema';
import { type CreateTestAttemptInput, type TestAttempt } from '../schema';
import { eq, and, count } from 'drizzle-orm';

export const createTestAttempt = async (input: CreateTestAttemptInput): Promise<TestAttempt> => {
  try {
    // Verify test exists
    const testExists = await db.select()
      .from(testsTable)
      .where(eq(testsTable.id, input.test_id))
      .execute();

    if (testExists.length === 0) {
      throw new Error(`Test with id ${input.test_id} not found`);
    }

    const test = testExists[0];

    // Verify student exists
    const studentExists = await db.select()
      .from(usersTable)
      .where(and(
        eq(usersTable.id, input.student_id),
        eq(usersTable.role, 'student')
      ))
      .execute();

    if (studentExists.length === 0) {
      throw new Error(`Student with id ${input.student_id} not found`);
    }

    // Check if student has exceeded max attempts
    const existingAttempts = await db.select({ count: count() })
      .from(testAttemptsTable)
      .where(and(
        eq(testAttemptsTable.test_id, input.test_id),
        eq(testAttemptsTable.student_id, input.student_id)
      ))
      .execute();

    const attemptCount = existingAttempts[0].count;
    
    if (attemptCount >= test.max_attempts) {
      throw new Error(`Maximum attempts (${test.max_attempts}) exceeded for this test`);
    }

    // Create new test attempt
    const result = await db.insert(testAttemptsTable)
      .values({
        test_id: input.test_id,
        student_id: input.student_id,
        score: null,
        answers: {},
        started_at: new Date(),
        completed_at: null,
        is_passed: null
      })
      .returning()
      .execute();

    const testAttempt = result[0];
    
    return {
      ...testAttempt,
      score: testAttempt.score ? parseFloat(testAttempt.score.toString()) : null,
      answers: testAttempt.answers as Record<string, string>
    };
  } catch (error) {
    console.error('Test attempt creation failed:', error);
    throw error;
  }
};