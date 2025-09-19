import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable, testsTable, questionsTable } from '../db/schema';
import { type CreateQuestionInput } from '../schema';
import { createQuestion } from '../handlers/create_question';
import { eq } from 'drizzle-orm';

describe('createQuestion', () => {
  let testId: number;

  beforeEach(async () => {
    await createDB();

    // Create prerequisite data: user -> course -> test
    const userResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A course for testing',
        instructor_id: userResult[0].id,
        status: 'published'
      })
      .returning()
      .execute();

    const testResult = await db.insert(testsTable)
      .values({
        course_id: courseResult[0].id,
        title: 'Test Quiz',
        description: 'A test for testing questions',
        time_limit_minutes: 60,
        max_attempts: 3,
        passing_score: 70,
        is_published: true
      })
      .returning()
      .execute();

    testId = testResult[0].id;
  });

  afterEach(resetDB);

  it('should create a multiple choice question', async () => {
    const input: CreateQuestionInput = {
      test_id: testId,
      question_text: 'What is the capital of France?',
      question_type: 'multiple_choice',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correct_answer: 'Paris',
      points: 5,
      order_index: 1
    };

    const result = await createQuestion(input);

    expect(result.id).toBeDefined();
    expect(result.test_id).toEqual(testId);
    expect(result.question_text).toEqual('What is the capital of France?');
    expect(result.question_type).toEqual('multiple_choice');
    expect(result.options).toEqual(['London', 'Berlin', 'Paris', 'Madrid']);
    expect(result.correct_answer).toEqual('Paris');
    expect(result.points).toEqual(5);
    expect(result.order_index).toEqual(1);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a true/false question', async () => {
    const input: CreateQuestionInput = {
      test_id: testId,
      question_text: 'The Earth is flat.',
      question_type: 'true_false',
      options: null,
      correct_answer: 'false',
      points: 2,
      order_index: 2
    };

    const result = await createQuestion(input);

    expect(result.question_text).toEqual('The Earth is flat.');
    expect(result.question_type).toEqual('true_false');
    expect(result.options).toBeNull();
    expect(result.correct_answer).toEqual('false');
    expect(result.points).toEqual(2);
    expect(result.order_index).toEqual(2);
  });

  it('should create a short answer question', async () => {
    const input: CreateQuestionInput = {
      test_id: testId,
      question_text: 'Explain photosynthesis in one sentence.',
      question_type: 'short_answer',
      options: null,
      correct_answer: 'Photosynthesis is the process by which plants convert sunlight into energy.',
      points: 10,
      order_index: 3
    };

    const result = await createQuestion(input);

    expect(result.question_text).toEqual('Explain photosynthesis in one sentence.');
    expect(result.question_type).toEqual('short_answer');
    expect(result.options).toBeNull();
    expect(result.correct_answer).toEqual('Photosynthesis is the process by which plants convert sunlight into energy.');
    expect(result.points).toEqual(10);
    expect(result.order_index).toEqual(3);
  });

  it('should save question to database', async () => {
    const input: CreateQuestionInput = {
      test_id: testId,
      question_text: 'Test question for database verification',
      question_type: 'multiple_choice',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'C',
      points: 3,
      order_index: 4
    };

    const result = await createQuestion(input);

    // Verify the question was saved to the database
    const questions = await db.select()
      .from(questionsTable)
      .where(eq(questionsTable.id, result.id))
      .execute();

    expect(questions).toHaveLength(1);
    expect(questions[0].question_text).toEqual('Test question for database verification');
    expect(questions[0].question_type).toEqual('multiple_choice');
    expect(questions[0].options).toEqual(['A', 'B', 'C', 'D']);
    expect(questions[0].correct_answer).toEqual('C');
    expect(questions[0].points).toEqual(3);
    expect(questions[0].order_index).toEqual(4);
    expect(questions[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error when test does not exist', async () => {
    const input: CreateQuestionInput = {
      test_id: 99999, // Non-existent test ID
      question_text: 'This should fail',
      question_type: 'true_false',
      options: null,
      correct_answer: 'true',
      points: 1,
      order_index: 1
    };

    await expect(createQuestion(input)).rejects.toThrow(/Test with id 99999 not found/i);
  });

  it('should handle empty options array for multiple choice', async () => {
    const input: CreateQuestionInput = {
      test_id: testId,
      question_text: 'Question with empty options',
      question_type: 'multiple_choice',
      options: [],
      correct_answer: 'No options',
      points: 1,
      order_index: 5
    };

    const result = await createQuestion(input);

    expect(result.options).toEqual([]);
    expect(result.question_type).toEqual('multiple_choice');
  });

  it('should handle high point values', async () => {
    const input: CreateQuestionInput = {
      test_id: testId,
      question_text: 'High value question',
      question_type: 'short_answer',
      options: null,
      correct_answer: 'Detailed answer required',
      points: 50,
      order_index: 6
    };

    const result = await createQuestion(input);

    expect(result.points).toEqual(50);
    expect(typeof result.points).toBe('number');
  });

  it('should maintain order index correctly', async () => {
    const questions = [
      {
        test_id: testId,
        question_text: 'First question',
        question_type: 'true_false' as const,
        options: null,
        correct_answer: 'true',
        points: 1,
        order_index: 10
      },
      {
        test_id: testId,
        question_text: 'Second question', 
        question_type: 'true_false' as const,
        options: null,
        correct_answer: 'false',
        points: 1,
        order_index: 20
      }
    ];

    const results = [];
    for (const questionInput of questions) {
      results.push(await createQuestion(questionInput));
    }

    expect(results[0].order_index).toEqual(10);
    expect(results[1].order_index).toEqual(20);

    // Verify both questions exist in database with correct order
    const dbQuestions = await db.select()
      .from(questionsTable)
      .where(eq(questionsTable.test_id, testId))
      .execute();

    expect(dbQuestions).toHaveLength(2);
    
    const sortedQuestions = dbQuestions.sort((a, b) => a.order_index - b.order_index);
    expect(sortedQuestions[0].question_text).toEqual('First question');
    expect(sortedQuestions[1].question_text).toEqual('Second question');
  });
});