import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable, testsTable, testAttemptsTable } from '../db/schema';
import { type CreateTestAttemptInput } from '../schema';
import { createTestAttempt } from '../handlers/create_test_attempt';
import { eq, and } from 'drizzle-orm';

// Test setup data
const testInstructor = {
  email: 'instructor@test.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'Instructor',
  role: 'instructor' as const
};

const testStudent = {
  email: 'student@test.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'Student',
  role: 'student' as const
};

const testCourse = {
  title: 'Test Course',
  description: 'A course for testing',
  instructor_id: 1
};

const testTest = {
  course_id: 1,
  title: 'Test Quiz',
  description: 'A quiz for testing',
  time_limit_minutes: 60,
  max_attempts: 3,
  passing_score: 70.0,
  is_published: true
};

describe('createTestAttempt', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a test attempt successfully', async () => {
    // Create prerequisite data
    const instructor = await db.insert(usersTable).values(testInstructor).returning().execute();
    const student = await db.insert(usersTable).values(testStudent).returning().execute();
    const course = await db.insert(coursesTable).values({
      ...testCourse,
      instructor_id: instructor[0].id
    }).returning().execute();
    const test = await db.insert(testsTable).values({
      ...testTest,
      course_id: course[0].id
    }).returning().execute();

    const input: CreateTestAttemptInput = {
      test_id: test[0].id,
      student_id: student[0].id
    };

    const result = await createTestAttempt(input);

    // Basic field validation
    expect(result.test_id).toEqual(test[0].id);
    expect(result.student_id).toEqual(student[0].id);
    expect(result.score).toBeNull();
    expect(result.answers).toEqual({});
    expect(result.started_at).toBeInstanceOf(Date);
    expect(result.completed_at).toBeNull();
    expect(result.is_passed).toBeNull();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
  });

  it('should save test attempt to database', async () => {
    // Create prerequisite data
    const instructor = await db.insert(usersTable).values(testInstructor).returning().execute();
    const student = await db.insert(usersTable).values(testStudent).returning().execute();
    const course = await db.insert(coursesTable).values({
      ...testCourse,
      instructor_id: instructor[0].id
    }).returning().execute();
    const test = await db.insert(testsTable).values({
      ...testTest,
      course_id: course[0].id
    }).returning().execute();

    const input: CreateTestAttemptInput = {
      test_id: test[0].id,
      student_id: student[0].id
    };

    const result = await createTestAttempt(input);

    // Verify in database
    const attempts = await db.select()
      .from(testAttemptsTable)
      .where(eq(testAttemptsTable.id, result.id))
      .execute();

    expect(attempts).toHaveLength(1);
    expect(attempts[0].test_id).toEqual(test[0].id);
    expect(attempts[0].student_id).toEqual(student[0].id);
    expect(attempts[0].score).toBeNull();
    expect(attempts[0].answers).toEqual({});
    expect(attempts[0].started_at).toBeInstanceOf(Date);
    expect(attempts[0].completed_at).toBeNull();
    expect(attempts[0].is_passed).toBeNull();
  });

  it('should throw error when test does not exist', async () => {
    // Create student but no test
    const student = await db.insert(usersTable).values(testStudent).returning().execute();

    const input: CreateTestAttemptInput = {
      test_id: 999,
      student_id: student[0].id
    };

    await expect(createTestAttempt(input)).rejects.toThrow(/Test with id 999 not found/i);
  });

  it('should throw error when student does not exist', async () => {
    // Create test but no student
    const instructor = await db.insert(usersTable).values(testInstructor).returning().execute();
    const course = await db.insert(coursesTable).values({
      ...testCourse,
      instructor_id: instructor[0].id
    }).returning().execute();
    const test = await db.insert(testsTable).values({
      ...testTest,
      course_id: course[0].id
    }).returning().execute();

    const input: CreateTestAttemptInput = {
      test_id: test[0].id,
      student_id: 999
    };

    await expect(createTestAttempt(input)).rejects.toThrow(/Student with id 999 not found/i);
  });

  it('should throw error when user is not a student', async () => {
    // Create instructor and test, try to use instructor as student
    const instructor = await db.insert(usersTable).values(testInstructor).returning().execute();
    const course = await db.insert(coursesTable).values({
      ...testCourse,
      instructor_id: instructor[0].id
    }).returning().execute();
    const test = await db.insert(testsTable).values({
      ...testTest,
      course_id: course[0].id
    }).returning().execute();

    const input: CreateTestAttemptInput = {
      test_id: test[0].id,
      student_id: instructor[0].id // Using instructor ID as student
    };

    await expect(createTestAttempt(input)).rejects.toThrow(/Student with id .* not found/i);
  });

  it('should throw error when max attempts exceeded', async () => {
    // Create prerequisite data with max_attempts = 1
    const instructor = await db.insert(usersTable).values(testInstructor).returning().execute();
    const student = await db.insert(usersTable).values(testStudent).returning().execute();
    const course = await db.insert(coursesTable).values({
      ...testCourse,
      instructor_id: instructor[0].id
    }).returning().execute();
    const test = await db.insert(testsTable).values({
      ...testTest,
      course_id: course[0].id,
      max_attempts: 1
    }).returning().execute();

    // Create first attempt
    await db.insert(testAttemptsTable).values({
      test_id: test[0].id,
      student_id: student[0].id,
      score: null,
      answers: {},
      started_at: new Date(),
      completed_at: null,
      is_passed: null
    }).execute();

    const input: CreateTestAttemptInput = {
      test_id: test[0].id,
      student_id: student[0].id
    };

    // Attempt to create second attempt should fail
    await expect(createTestAttempt(input)).rejects.toThrow(/Maximum attempts \(1\) exceeded for this test/i);
  });

  it('should allow multiple attempts within limit', async () => {
    // Create prerequisite data with max_attempts = 3
    const instructor = await db.insert(usersTable).values(testInstructor).returning().execute();
    const student = await db.insert(usersTable).values(testStudent).returning().execute();
    const course = await db.insert(coursesTable).values({
      ...testCourse,
      instructor_id: instructor[0].id
    }).returning().execute();
    const test = await db.insert(testsTable).values({
      ...testTest,
      course_id: course[0].id,
      max_attempts: 3
    }).returning().execute();

    // Create first attempt
    await db.insert(testAttemptsTable).values({
      test_id: test[0].id,
      student_id: student[0].id,
      score: null,
      answers: {},
      started_at: new Date(),
      completed_at: null,
      is_passed: null
    }).execute();

    const input: CreateTestAttemptInput = {
      test_id: test[0].id,
      student_id: student[0].id
    };

    // Second attempt should succeed
    const result = await createTestAttempt(input);
    expect(result.id).toBeDefined();
    expect(result.test_id).toEqual(test[0].id);
    expect(result.student_id).toEqual(student[0].id);

    // Verify we now have 2 attempts in database
    const attempts = await db.select()
      .from(testAttemptsTable)
      .where(and(
        eq(testAttemptsTable.test_id, test[0].id),
        eq(testAttemptsTable.student_id, student[0].id)
      ))
      .execute();

    expect(attempts).toHaveLength(2);
  });

  it('should handle numeric score field correctly', async () => {
    // Create prerequisite data
    const instructor = await db.insert(usersTable).values(testInstructor).returning().execute();
    const student = await db.insert(usersTable).values(testStudent).returning().execute();
    const course = await db.insert(coursesTable).values({
      ...testCourse,
      instructor_id: instructor[0].id
    }).returning().execute();
    const test = await db.insert(testsTable).values({
      ...testTest,
      course_id: course[0].id
    }).returning().execute();

    const input: CreateTestAttemptInput = {
      test_id: test[0].id,
      student_id: student[0].id
    };

    const result = await createTestAttempt(input);

    // Score should be null initially and have correct type
    expect(result.score).toBeNull();
    expect(typeof result.score).toBe('object'); // null has typeof 'object'
  });
});