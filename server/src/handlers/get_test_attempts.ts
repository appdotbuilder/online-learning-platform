import { db } from '../db';
import { testAttemptsTable } from '../db/schema';
import { type TestAttempt } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function getTestAttemptsByStudent(studentId: number, testId: number): Promise<TestAttempt[]> {
  try {
    const results = await db.select()
      .from(testAttemptsTable)
      .where(
        and(
          eq(testAttemptsTable.student_id, studentId),
          eq(testAttemptsTable.test_id, testId)
        )
      )
      .execute();

    return results.map(attempt => ({
      ...attempt,
      score: attempt.score ? parseFloat(attempt.score.toString()) : null,
      answers: attempt.answers as Record<string, string>
    }));
  } catch (error) {
    console.error('Failed to fetch test attempts by student:', error);
    throw error;
  }
}

export async function getTestAttemptById(attemptId: number): Promise<TestAttempt | null> {
  try {
    const results = await db.select()
      .from(testAttemptsTable)
      .where(eq(testAttemptsTable.id, attemptId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const attempt = results[0];
    return {
      ...attempt,
      score: attempt.score ? parseFloat(attempt.score.toString()) : null,
      answers: attempt.answers as Record<string, string>
    };
  } catch (error) {
    console.error('Failed to fetch test attempt by ID:', error);
    throw error;
  }
}

export async function getTestAttemptsByTest(testId: number): Promise<TestAttempt[]> {
  try {
    const results = await db.select()
      .from(testAttemptsTable)
      .where(eq(testAttemptsTable.test_id, testId))
      .execute();

    return results.map(attempt => ({
      ...attempt,
      score: attempt.score ? parseFloat(attempt.score.toString()) : null,
      answers: attempt.answers as Record<string, string>
    }));
  } catch (error) {
    console.error('Failed to fetch test attempts by test:', error);
    throw error;
  }
}