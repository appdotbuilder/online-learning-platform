import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { testsTable, coursesTable, usersTable } from '../db/schema';
import { type CreateTestInput } from '../schema';
import { createTest } from '../handlers/create_test';
import { eq } from 'drizzle-orm';

describe('createTest', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create prerequisite data for tests
  const createPrerequisiteData = async () => {
    // Create instructor user first
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    // Create course
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A course for testing',
        instructor_id: instructorResult[0].id
      })
      .returning()
      .execute();

    return { instructor: instructorResult[0], course: courseResult[0] };
  };

  it('should create a test with all fields', async () => {
    const { course } = await createPrerequisiteData();

    const testInput: CreateTestInput = {
      course_id: course.id,
      title: 'Introduction Quiz',
      description: 'Test your knowledge on the introduction',
      time_limit_minutes: 30,
      max_attempts: 3,
      passing_score: 75
    };

    const result = await createTest(testInput);

    // Verify all fields are set correctly
    expect(result.course_id).toEqual(course.id);
    expect(result.title).toEqual('Introduction Quiz');
    expect(result.description).toEqual('Test your knowledge on the introduction');
    expect(result.time_limit_minutes).toEqual(30);
    expect(result.max_attempts).toEqual(3);
    expect(result.passing_score).toEqual(75);
    expect(typeof result.passing_score).toBe('number'); // Verify numeric conversion
    expect(result.is_published).toBe(false); // Default value
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a test with nullable fields', async () => {
    const { course } = await createPrerequisiteData();

    const testInput: CreateTestInput = {
      course_id: course.id,
      title: 'Simple Quiz',
      description: null,
      time_limit_minutes: null,
      max_attempts: 1,
      passing_score: 60
    };

    const result = await createTest(testInput);

    expect(result.title).toEqual('Simple Quiz');
    expect(result.description).toBeNull();
    expect(result.time_limit_minutes).toBeNull();
    expect(result.max_attempts).toEqual(1);
    expect(result.passing_score).toEqual(60);
  });

  it('should save test to database correctly', async () => {
    const { course } = await createPrerequisiteData();

    const testInput: CreateTestInput = {
      course_id: course.id,
      title: 'Final Exam',
      description: 'Comprehensive final examination',
      time_limit_minutes: 120,
      max_attempts: 2,
      passing_score: 80
    };

    const result = await createTest(testInput);

    // Query database to verify the test was saved correctly
    const savedTests = await db.select()
      .from(testsTable)
      .where(eq(testsTable.id, result.id))
      .execute();

    expect(savedTests).toHaveLength(1);
    const savedTest = savedTests[0];
    expect(savedTest.course_id).toEqual(course.id);
    expect(savedTest.title).toEqual('Final Exam');
    expect(savedTest.description).toEqual('Comprehensive final examination');
    expect(savedTest.time_limit_minutes).toEqual(120);
    expect(savedTest.max_attempts).toEqual(2);
    expect(savedTest.passing_score).toEqual(80); // Real column stores numbers directly
    expect(savedTest.is_published).toBe(false);
    expect(savedTest.created_at).toBeInstanceOf(Date);
    expect(savedTest.updated_at).toBeInstanceOf(Date);
  });

  it('should handle decimal passing scores correctly', async () => {
    const { course } = await createPrerequisiteData();

    const testInput: CreateTestInput = {
      course_id: course.id,
      title: 'Precision Quiz',
      description: null,
      time_limit_minutes: null,
      max_attempts: 5,
      passing_score: 85.5
    };

    const result = await createTest(testInput);

    expect(result.passing_score).toEqual(85.5);
    expect(typeof result.passing_score).toBe('number');

    // Verify in database
    const savedTest = await db.select()
      .from(testsTable)
      .where(eq(testsTable.id, result.id))
      .execute();

    expect(savedTest[0].passing_score).toEqual(85.5);
  });

  it('should throw error when course does not exist', async () => {
    const testInput: CreateTestInput = {
      course_id: 999999, // Non-existent course ID
      title: 'Invalid Quiz',
      description: null,
      time_limit_minutes: null,
      max_attempts: 1,
      passing_score: 70
    };

    await expect(createTest(testInput)).rejects.toThrow(/Course with id 999999 not found/i);
  });

  it('should create multiple tests for the same course', async () => {
    const { course } = await createPrerequisiteData();

    const test1Input: CreateTestInput = {
      course_id: course.id,
      title: 'Chapter 1 Quiz',
      description: null,
      time_limit_minutes: 15,
      max_attempts: 2,
      passing_score: 70
    };

    const test2Input: CreateTestInput = {
      course_id: course.id,
      title: 'Chapter 2 Quiz',
      description: null,
      time_limit_minutes: 20,
      max_attempts: 3,
      passing_score: 75
    };

    const result1 = await createTest(test1Input);
    const result2 = await createTest(test2Input);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.course_id).toEqual(course.id);
    expect(result2.course_id).toEqual(course.id);
    expect(result1.title).toEqual('Chapter 1 Quiz');
    expect(result2.title).toEqual('Chapter 2 Quiz');

    // Verify both tests exist in database
    const allTests = await db.select()
      .from(testsTable)
      .where(eq(testsTable.course_id, course.id))
      .execute();

    expect(allTests).toHaveLength(2);
  });

  it('should handle edge case passing scores correctly', async () => {
    const { course } = await createPrerequisiteData();

    // Test minimum passing score
    const minScoreInput: CreateTestInput = {
      course_id: course.id,
      title: 'Minimum Score Test',
      description: null,
      time_limit_minutes: null,
      max_attempts: 1,
      passing_score: 0
    };

    const minResult = await createTest(minScoreInput);
    expect(minResult.passing_score).toEqual(0);

    // Test maximum passing score
    const maxScoreInput: CreateTestInput = {
      course_id: course.id,
      title: 'Maximum Score Test',
      description: null,
      time_limit_minutes: null,
      max_attempts: 1,
      passing_score: 100
    };

    const maxResult = await createTest(maxScoreInput);
    expect(maxResult.passing_score).toEqual(100);
  });
});