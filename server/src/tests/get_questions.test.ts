import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable, testsTable, questionsTable } from '../db/schema';
import { type CreateQuestionInput } from '../schema';
import { getQuestionsByTest } from '../handlers/get_questions';

describe('getQuestionsByTest', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testId: number;
  
  beforeEach(async () => {
    // Create prerequisite data: instructor, course, and test
    const instructor = await db.insert(usersTable).values({
      email: 'instructor@test.com',
      password_hash: 'hash123',
      first_name: 'John',
      last_name: 'Instructor',
      role: 'instructor'
    }).returning().execute();

    const course = await db.insert(coursesTable).values({
      title: 'Test Course',
      description: 'A course for testing',
      instructor_id: instructor[0].id
    }).returning().execute();

    const test = await db.insert(testsTable).values({
      course_id: course[0].id,
      title: 'Test Quiz',
      description: 'A test for testing',
      max_attempts: 3,
      passing_score: 70
    }).returning().execute();

    testId = test[0].id;
  });

  it('should return empty array when test has no questions', async () => {
    const result = await getQuestionsByTest(testId);
    expect(result).toEqual([]);
  });

  it('should return questions ordered by order_index', async () => {
    // Create questions in random order
    const questions = [
      {
        test_id: testId,
        question_text: 'Question 3',
        question_type: 'multiple_choice' as const,
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'B',
        points: 5,
        order_index: 3
      },
      {
        test_id: testId,
        question_text: 'Question 1',
        question_type: 'true_false' as const,
        options: null,
        correct_answer: 'true',
        points: 2,
        order_index: 1
      },
      {
        test_id: testId,
        question_text: 'Question 2',
        question_type: 'short_answer' as const,
        options: null,
        correct_answer: 'Answer',
        points: 3,
        order_index: 2
      }
    ];

    // Insert questions
    await db.insert(questionsTable).values(questions).execute();

    const result = await getQuestionsByTest(testId);

    expect(result).toHaveLength(3);
    expect(result[0].question_text).toEqual('Question 1');
    expect(result[0].order_index).toEqual(1);
    expect(result[1].question_text).toEqual('Question 2');
    expect(result[1].order_index).toEqual(2);
    expect(result[2].question_text).toEqual('Question 3');
    expect(result[2].order_index).toEqual(3);
  });

  it('should return questions with all required fields', async () => {
    const questionData = {
      test_id: testId,
      question_text: 'What is 2+2?',
      question_type: 'multiple_choice' as const,
      options: ['2', '3', '4', '5'],
      correct_answer: '4',
      points: 5,
      order_index: 1
    };

    await db.insert(questionsTable).values(questionData).execute();

    const result = await getQuestionsByTest(testId);

    expect(result).toHaveLength(1);
    const question = result[0];
    expect(question.id).toBeDefined();
    expect(question.test_id).toEqual(testId);
    expect(question.question_text).toEqual('What is 2+2?');
    expect(question.question_type).toEqual('multiple_choice');
    expect(question.options).toEqual(['2', '3', '4', '5']);
    expect(question.correct_answer).toEqual('4');
    expect(question.points).toEqual(5);
    expect(question.order_index).toEqual(1);
    expect(question.created_at).toBeInstanceOf(Date);
  });

  it('should handle questions with null options', async () => {
    const questionData = {
      test_id: testId,
      question_text: 'True or false?',
      question_type: 'true_false' as const,
      options: null,
      correct_answer: 'true',
      points: 2,
      order_index: 1
    };

    await db.insert(questionsTable).values(questionData).execute();

    const result = await getQuestionsByTest(testId);

    expect(result).toHaveLength(1);
    expect(result[0].options).toBeNull();
    expect(result[0].question_type).toEqual('true_false');
  });

  it('should return empty array for non-existent test', async () => {
    const result = await getQuestionsByTest(99999);
    expect(result).toEqual([]);
  });

  it('should handle multiple question types correctly', async () => {
    const questions = [
      {
        test_id: testId,
        question_text: 'Multiple choice question?',
        question_type: 'multiple_choice' as const,
        options: ['A', 'B', 'C'],
        correct_answer: 'B',
        points: 3,
        order_index: 1
      },
      {
        test_id: testId,
        question_text: 'True or false?',
        question_type: 'true_false' as const,
        options: null,
        correct_answer: 'false',
        points: 2,
        order_index: 2
      },
      {
        test_id: testId,
        question_text: 'Short answer question?',
        question_type: 'short_answer' as const,
        options: null,
        correct_answer: 'Short answer',
        points: 5,
        order_index: 3
      }
    ];

    await db.insert(questionsTable).values(questions).execute();

    const result = await getQuestionsByTest(testId);

    expect(result).toHaveLength(3);
    expect(result[0].question_type).toEqual('multiple_choice');
    expect(result[0].options).toEqual(['A', 'B', 'C']);
    expect(result[1].question_type).toEqual('true_false');
    expect(result[1].options).toBeNull();
    expect(result[2].question_type).toEqual('short_answer');
    expect(result[2].options).toBeNull();
  });

  it('should only return questions for the specified test', async () => {
    // Create another test
    const instructor = await db.select().from(usersTable).execute();
    const course = await db.select().from(coursesTable).execute();
    
    const anotherTest = await db.insert(testsTable).values({
      course_id: course[0].id,
      title: 'Another Test',
      description: 'Another test',
      max_attempts: 3,
      passing_score: 70
    }).returning().execute();

    // Create questions for both tests
    const questionsTest1 = [
      {
        test_id: testId,
        question_text: 'Question for test 1',
        question_type: 'multiple_choice' as const,
        options: ['A', 'B'],
        correct_answer: 'A',
        points: 2,
        order_index: 1
      }
    ];

    const questionsTest2 = [
      {
        test_id: anotherTest[0].id,
        question_text: 'Question for test 2',
        question_type: 'true_false' as const,
        options: null,
        correct_answer: 'true',
        points: 3,
        order_index: 1
      }
    ];

    await db.insert(questionsTable).values([...questionsTest1, ...questionsTest2]).execute();

    // Get questions for first test only
    const result = await getQuestionsByTest(testId);

    expect(result).toHaveLength(1);
    expect(result[0].test_id).toEqual(testId);
    expect(result[0].question_text).toEqual('Question for test 1');
  });
});