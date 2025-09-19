import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable, testsTable, testAttemptsTable } from '../db/schema';
import { getTestAttemptsByStudent, getTestAttemptById, getTestAttemptsByTest } from '../handlers/get_test_attempts';

describe('get_test_attempts handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let studentId: number;
  let instructorId: number;
  let courseId: number;
  let testId: number;

  beforeEach(async () => {
    // Create test users
    const [student] = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hash123',
        first_name: 'John',
        last_name: 'Doe',
        role: 'student'
      })
      .returning()
      .execute();

    const [instructor] = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hash456',
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'instructor'
      })
      .returning()
      .execute();

    studentId = student.id;
    instructorId = instructor.id;

    // Create test course
    const [course] = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A course for testing',
        instructor_id: instructorId,
        status: 'published'
      })
      .returning()
      .execute();

    courseId = course.id;

    // Create test
    const [test] = await db.insert(testsTable)
      .values({
        course_id: courseId,
        title: 'Test Quiz',
        description: 'A test quiz',
        max_attempts: 3,
        passing_score: 70,
        is_published: true
      })
      .returning()
      .execute();

    testId = test.id;
  });

  describe('getTestAttemptsByStudent', () => {
    it('should return empty array when no attempts exist', async () => {
      const attempts = await getTestAttemptsByStudent(studentId, testId);
      
      expect(attempts).toEqual([]);
    });

    it('should return student test attempts for specific test', async () => {
      // Create test attempts
      const [attempt1] = await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: 85.5,
          answers: { '1': 'answer1', '2': 'answer2' },
          completed_at: new Date(),
          is_passed: true
        })
        .returning()
        .execute();

      const [attempt2] = await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: 65.0,
          answers: { '1': 'wrong', '2': 'answer2' },
          completed_at: new Date(),
          is_passed: false
        })
        .returning()
        .execute();

      const attempts = await getTestAttemptsByStudent(studentId, testId);

      expect(attempts).toHaveLength(2);
      
      // Check first attempt
      const firstAttempt = attempts.find(a => a.id === attempt1.id);
      expect(firstAttempt).toBeDefined();
      expect(firstAttempt!.test_id).toEqual(testId);
      expect(firstAttempt!.student_id).toEqual(studentId);
      expect(firstAttempt!.score).toEqual(85.5);
      expect(typeof firstAttempt!.score).toEqual('number');
      expect(firstAttempt!.answers).toEqual({ '1': 'answer1', '2': 'answer2' });
      expect(firstAttempt!.is_passed).toBe(true);
      expect(firstAttempt!.completed_at).toBeInstanceOf(Date);

      // Check second attempt
      const secondAttempt = attempts.find(a => a.id === attempt2.id);
      expect(secondAttempt).toBeDefined();
      expect(secondAttempt!.score).toEqual(65.0);
      expect(secondAttempt!.is_passed).toBe(false);
    });

    it('should not return attempts from other students', async () => {
      // Create another student
      const [otherStudent] = await db.insert(usersTable)
        .values({
          email: 'other@test.com',
          password_hash: 'hash789',
          first_name: 'Other',
          last_name: 'Student',
          role: 'student'
        })
        .returning()
        .execute();

      // Create attempt for original student
      await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: 90,
          answers: { '1': 'correct' },
          completed_at: new Date(),
          is_passed: true
        })
        .execute();

      // Create attempt for other student
      await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: otherStudent.id,
          score: 95,
          answers: { '1': 'also_correct' },
          completed_at: new Date(),
          is_passed: true
        })
        .execute();

      const attempts = await getTestAttemptsByStudent(studentId, testId);

      expect(attempts).toHaveLength(1);
      expect(attempts[0].student_id).toEqual(studentId);
      expect(attempts[0].score).toEqual(90);
    });

    it('should not return attempts from other tests', async () => {
      // Create another test
      const [otherTest] = await db.insert(testsTable)
        .values({
          course_id: courseId,
          title: 'Other Test',
          description: 'Another test',
          max_attempts: 2,
          passing_score: 80,
          is_published: true
        })
        .returning()
        .execute();

      // Create attempt for original test
      await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: 75,
          answers: { '1': 'answer' },
          completed_at: new Date(),
          is_passed: true
        })
        .execute();

      // Create attempt for other test
      await db.insert(testAttemptsTable)
        .values({
          test_id: otherTest.id,
          student_id: studentId,
          score: 85,
          answers: { '1': 'other_answer' },
          completed_at: new Date(),
          is_passed: true
        })
        .execute();

      const attempts = await getTestAttemptsByStudent(studentId, testId);

      expect(attempts).toHaveLength(1);
      expect(attempts[0].test_id).toEqual(testId);
      expect(attempts[0].score).toEqual(75);
    });

    it('should handle attempts with null scores (incomplete attempts)', async () => {
      await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: null,
          answers: { '1': 'partial' },
          completed_at: null,
          is_passed: null
        })
        .execute();

      const attempts = await getTestAttemptsByStudent(studentId, testId);

      expect(attempts).toHaveLength(1);
      expect(attempts[0].score).toBeNull();
      expect(attempts[0].completed_at).toBeNull();
      expect(attempts[0].is_passed).toBeNull();
      expect(attempts[0].answers).toEqual({ '1': 'partial' });
    });
  });

  describe('getTestAttemptById', () => {
    it('should return null when attempt does not exist', async () => {
      const attempt = await getTestAttemptById(999);
      
      expect(attempt).toBeNull();
    });

    it('should return test attempt by ID', async () => {
      const [createdAttempt] = await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: 92.5,
          answers: { '1': 'correct', '2': 'also_correct' },
          completed_at: new Date(),
          is_passed: true
        })
        .returning()
        .execute();

      const attempt = await getTestAttemptById(createdAttempt.id);

      expect(attempt).toBeDefined();
      expect(attempt!.id).toEqual(createdAttempt.id);
      expect(attempt!.test_id).toEqual(testId);
      expect(attempt!.student_id).toEqual(studentId);
      expect(attempt!.score).toEqual(92.5);
      expect(typeof attempt!.score).toEqual('number');
      expect(attempt!.answers).toEqual({ '1': 'correct', '2': 'also_correct' });
      expect(attempt!.is_passed).toBe(true);
      expect(attempt!.completed_at).toBeInstanceOf(Date);
      expect(attempt!.started_at).toBeInstanceOf(Date);
    });

    it('should handle attempt with null score', async () => {
      const [createdAttempt] = await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: null,
          answers: { '1': 'in_progress' },
          completed_at: null,
          is_passed: null
        })
        .returning()
        .execute();

      const attempt = await getTestAttemptById(createdAttempt.id);

      expect(attempt).toBeDefined();
      expect(attempt!.score).toBeNull();
      expect(attempt!.completed_at).toBeNull();
      expect(attempt!.is_passed).toBeNull();
      expect(attempt!.answers).toEqual({ '1': 'in_progress' });
    });
  });

  describe('getTestAttemptsByTest', () => {
    it('should return empty array when no attempts exist', async () => {
      const attempts = await getTestAttemptsByTest(testId);
      
      expect(attempts).toEqual([]);
    });

    it('should return all attempts for a test', async () => {
      // Create another student
      const [student2] = await db.insert(usersTable)
        .values({
          email: 'student2@test.com',
          password_hash: 'hash999',
          first_name: 'Alice',
          last_name: 'Johnson',
          role: 'student'
        })
        .returning()
        .execute();

      // Create attempts from different students
      const [attempt1] = await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: 78.0,
          answers: { '1': 'answer1' },
          completed_at: new Date(),
          is_passed: true
        })
        .returning()
        .execute();

      const [attempt2] = await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: student2.id,
          score: 82.5,
          answers: { '1': 'answer2' },
          completed_at: new Date(),
          is_passed: true
        })
        .returning()
        .execute();

      const [attempt3] = await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: null,
          answers: { '1': 'incomplete' },
          completed_at: null,
          is_passed: null
        })
        .returning()
        .execute();

      const attempts = await getTestAttemptsByTest(testId);

      expect(attempts).toHaveLength(3);

      // Check that all attempts are for the correct test
      attempts.forEach(attempt => {
        expect(attempt.test_id).toEqual(testId);
      });

      // Check specific attempts exist
      const attemptIds = attempts.map(a => a.id);
      expect(attemptIds).toContain(attempt1.id);
      expect(attemptIds).toContain(attempt2.id);
      expect(attemptIds).toContain(attempt3.id);

      // Check score conversions
      const completedAttempts = attempts.filter(a => a.score !== null);
      expect(completedAttempts).toHaveLength(2);
      completedAttempts.forEach(attempt => {
        expect(typeof attempt.score).toEqual('number');
      });

      // Check incomplete attempt
      const incompleteAttempt = attempts.find(a => a.id === attempt3.id);
      expect(incompleteAttempt!.score).toBeNull();
      expect(incompleteAttempt!.completed_at).toBeNull();
      expect(incompleteAttempt!.is_passed).toBeNull();
    });

    it('should not return attempts from other tests', async () => {
      // Create another test
      const [otherTest] = await db.insert(testsTable)
        .values({
          course_id: courseId,
          title: 'Other Test',
          description: 'Different test',
          max_attempts: 1,
          passing_score: 60,
          is_published: true
        })
        .returning()
        .execute();

      // Create attempt for original test
      await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: 88,
          answers: { '1': 'correct' },
          completed_at: new Date(),
          is_passed: true
        })
        .execute();

      // Create attempt for other test
      await db.insert(testAttemptsTable)
        .values({
          test_id: otherTest.id,
          student_id: studentId,
          score: 95,
          answers: { '1': 'also_correct' },
          completed_at: new Date(),
          is_passed: true
        })
        .execute();

      const attempts = await getTestAttemptsByTest(testId);

      expect(attempts).toHaveLength(1);
      expect(attempts[0].test_id).toEqual(testId);
      expect(attempts[0].score).toEqual(88);
    });

    it('should handle mixed complete and incomplete attempts', async () => {
      // Create complete attempt
      await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: 89.0,
          answers: { '1': 'done' },
          completed_at: new Date(),
          is_passed: true
        })
        .execute();

      // Create incomplete attempt
      await db.insert(testAttemptsTable)
        .values({
          test_id: testId,
          student_id: studentId,
          score: null,
          answers: { '1': 'partial' },
          completed_at: null,
          is_passed: null
        })
        .execute();

      const attempts = await getTestAttemptsByTest(testId);

      expect(attempts).toHaveLength(2);
      
      const completeAttempt = attempts.find(a => a.score !== null);
      const incompleteAttempt = attempts.find(a => a.score === null);

      expect(completeAttempt).toBeDefined();
      expect(completeAttempt!.score).toEqual(89.0);
      expect(typeof completeAttempt!.score).toEqual('number');
      expect(completeAttempt!.is_passed).toBe(true);
      expect(completeAttempt!.completed_at).toBeInstanceOf(Date);

      expect(incompleteAttempt).toBeDefined();
      expect(incompleteAttempt!.score).toBeNull();
      expect(incompleteAttempt!.is_passed).toBeNull();
      expect(incompleteAttempt!.completed_at).toBeNull();
    });
  });
});