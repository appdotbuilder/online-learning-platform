import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  coursesTable, 
  testsTable, 
  questionsTable, 
  testAttemptsTable 
} from '../db/schema';
import { type SubmitTestAttemptInput } from '../schema';
import { submitTestAttempt } from '../handlers/submit_test_attempt';
import { eq } from 'drizzle-orm';

describe('submitTestAttempt', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const setupTestData = async () => {
    // Create instructor
    const instructors = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashedpass',
        first_name: 'Test',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    // Create student
    const students = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hashedpass',
        first_name: 'Test',
        last_name: 'Student',
        role: 'student'
      })
      .returning()
      .execute();

    // Create course
    const courses = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A test course',
        instructor_id: instructors[0].id,
        status: 'published'
      })
      .returning()
      .execute();

    // Create test
    const tests = await db.insert(testsTable)
      .values({
        course_id: courses[0].id,
        title: 'Test Quiz',
        description: 'A test quiz',
        time_limit_minutes: 60,
        max_attempts: 3,
        passing_score: 70, // Real column accepts numbers
        is_published: true
      })
      .returning()
      .execute();

    // Create questions
    const questions = await db.insert(questionsTable)
      .values([
        {
          test_id: tests[0].id,
          question_text: 'What is 2 + 2?',
          question_type: 'short_answer',
          options: null,
          correct_answer: '4',
          points: 10,
          order_index: 1
        },
        {
          test_id: tests[0].id,
          question_text: 'Is the sky blue?',
          question_type: 'true_false',
          options: null,
          correct_answer: 'true',
          points: 10,
          order_index: 2
        }
      ])
      .returning()
      .execute();

    // Create test attempt
    const attempts = await db.insert(testAttemptsTable)
      .values({
        test_id: tests[0].id,
        student_id: students[0].id,
        answers: {},
        started_at: new Date()
      })
      .returning()
      .execute();

    return {
      instructor: instructors[0],
      student: students[0],
      course: courses[0],
      test: tests[0],
      questions: questions,
      attempt: attempts[0]
    };
  };

  it('should submit and grade test attempt with perfect score', async () => {
    const { questions, attempt } = await setupTestData();

    const input: SubmitTestAttemptInput = {
      attempt_id: attempt.id,
      answers: {
        [questions[0].id.toString()]: '4',
        [questions[1].id.toString()]: 'true'
      }
    };

    const result = await submitTestAttempt(input);

    expect(result.id).toEqual(attempt.id);
    expect(result.score).toEqual(100);
    expect(result.is_passed).toBe(true);
    expect(result.answers).toEqual(input.answers);
    expect(result.completed_at).toBeInstanceOf(Date);
    expect(typeof result.score).toBe('number');
  });

  it('should submit and grade test attempt with partial score', async () => {
    const { questions, attempt } = await setupTestData();

    const input: SubmitTestAttemptInput = {
      attempt_id: attempt.id,
      answers: {
        [questions[0].id.toString()]: '4', // Correct
        [questions[1].id.toString()]: 'false' // Incorrect
      }
    };

    const result = await submitTestAttempt(input);

    expect(result.score).toEqual(50); // 10 out of 20 points
    expect(result.is_passed).toBe(false); // Below 70% passing score
    expect(result.answers).toEqual(input.answers);
    expect(result.completed_at).toBeInstanceOf(Date);
  });

  it('should submit and grade test attempt with failing score', async () => {
    const { questions, attempt } = await setupTestData();

    const input: SubmitTestAttemptInput = {
      attempt_id: attempt.id,
      answers: {
        [questions[0].id.toString()]: 'wrong',
        [questions[1].id.toString()]: 'false'
      }
    };

    const result = await submitTestAttempt(input);

    expect(result.score).toEqual(0);
    expect(result.is_passed).toBe(false);
    expect(result.completed_at).toBeInstanceOf(Date);
  });

  it('should handle case-insensitive grading', async () => {
    const { questions, attempt } = await setupTestData();

    const input: SubmitTestAttemptInput = {
      attempt_id: attempt.id,
      answers: {
        [questions[0].id.toString()]: '  4  ', // With spaces
        [questions[1].id.toString()]: 'TRUE' // Different case
      }
    };

    const result = await submitTestAttempt(input);

    expect(result.score).toEqual(100);
    expect(result.is_passed).toBe(true);
  });

  it('should save answers to database correctly', async () => {
    const { questions, attempt } = await setupTestData();

    const input: SubmitTestAttemptInput = {
      attempt_id: attempt.id,
      answers: {
        [questions[0].id.toString()]: '4',
        [questions[1].id.toString()]: 'true'
      }
    };

    await submitTestAttempt(input);

    // Verify data was saved to database
    const savedAttempts = await db.select()
      .from(testAttemptsTable)
      .where(eq(testAttemptsTable.id, attempt.id))
      .execute();

    expect(savedAttempts).toHaveLength(1);
    const savedAttempt = savedAttempts[0];
    expect(savedAttempt.answers).toEqual(input.answers);
    const savedScore = typeof savedAttempt.score === 'string' ? parseFloat(savedAttempt.score) : savedAttempt.score;
    expect(savedScore).toEqual(100);
    expect(savedAttempt.is_passed).toBe(true);
    expect(savedAttempt.completed_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent test attempt', async () => {
    const input: SubmitTestAttemptInput = {
      attempt_id: 99999,
      answers: { '1': 'answer' }
    };

    expect(submitTestAttempt(input)).rejects.toThrow(/test attempt not found/i);
  });

  it('should throw error for already completed test attempt', async () => {
    const { questions, attempt } = await setupTestData();

    // Complete the attempt first
    await db.update(testAttemptsTable)
      .set({ completed_at: new Date() })
      .where(eq(testAttemptsTable.id, attempt.id))
      .execute();

    const input: SubmitTestAttemptInput = {
      attempt_id: attempt.id,
      answers: {
        [questions[0].id.toString()]: '4'
      }
    };

    expect(submitTestAttempt(input)).rejects.toThrow(/already been submitted/i);
  });

  it('should handle test with no questions', async () => {
    const { attempt } = await setupTestData();

    // Delete all questions  
    await db.delete(questionsTable)
      .where(eq(questionsTable.test_id, attempt.test_id))
      .execute();

    const input: SubmitTestAttemptInput = {
      attempt_id: attempt.id,
      answers: {}
    };

    expect(submitTestAttempt(input)).rejects.toThrow(/no questions found/i);
  });

  it('should handle missing answers gracefully', async () => {
    const { questions, attempt } = await setupTestData();

    const input: SubmitTestAttemptInput = {
      attempt_id: attempt.id,
      answers: {
        [questions[0].id.toString()]: '4'
        // Missing answer for second question
      }
    };

    const result = await submitTestAttempt(input);

    expect(result.score).toEqual(50); // Only first question correct
    expect(result.is_passed).toBe(false);
  });
});