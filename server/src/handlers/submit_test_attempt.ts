import { db } from '../db';
import { testAttemptsTable, testsTable, questionsTable } from '../db/schema';
import { type SubmitTestAttemptInput, type TestAttempt } from '../schema';
import { eq } from 'drizzle-orm';

export async function submitTestAttempt(input: SubmitTestAttemptInput): Promise<TestAttempt> {
  try {
    // First, verify the test attempt exists and is not already completed
    const existingAttempts = await db.select()
      .from(testAttemptsTable)
      .where(eq(testAttemptsTable.id, input.attempt_id))
      .execute();

    if (existingAttempts.length === 0) {
      throw new Error('Test attempt not found');
    }

    const attempt = existingAttempts[0];
    if (attempt.completed_at) {
      throw new Error('Test attempt has already been submitted');
    }

    // Get test details and questions to calculate score
    const testDetails = await db.select()
      .from(testsTable)
      .where(eq(testsTable.id, attempt.test_id))
      .execute();

    if (testDetails.length === 0) {
      throw new Error('Test not found');
    }

    const test = testDetails[0];

    // Get all questions for this test to calculate score
    const questions = await db.select()
      .from(questionsTable)
      .where(eq(questionsTable.test_id, attempt.test_id))
      .execute();

    if (questions.length === 0) {
      throw new Error('No questions found for test');
    }

    // Calculate score
    let totalPoints = 0;
    let earnedPoints = 0;

    questions.forEach(question => {
      totalPoints += question.points;
      const studentAnswer = input.answers[question.id.toString()];
      
      // Simple exact match comparison for grading
      if (studentAnswer && studentAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase()) {
        earnedPoints += question.points;
      }
    });

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passingScore = typeof test.passing_score === 'string' ? parseFloat(test.passing_score) : test.passing_score;
    const isPassed = score >= passingScore;

    // Update the test attempt with results
    const updatedAttempts = await db.update(testAttemptsTable)
      .set({
        answers: input.answers as any, // JSONB field accepts any JSON value
        score: score, // Real column accepts numbers directly
        completed_at: new Date(),
        is_passed: isPassed
      })
      .where(eq(testAttemptsTable.id, input.attempt_id))
      .returning()
      .execute();

    const updatedAttempt = updatedAttempts[0];

    // Return the result with proper type conversion
    return {
      ...updatedAttempt,
      score: typeof updatedAttempt.score === 'string' ? parseFloat(updatedAttempt.score) : updatedAttempt.score,
      answers: updatedAttempt.answers as Record<string, string>
    };
  } catch (error) {
    console.error('Test attempt submission failed:', error);
    throw error;
  }
}