import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { enrollmentsTable, usersTable, coursesTable } from '../db/schema';
import { type CreateEnrollmentInput } from '../schema';
import { createEnrollment } from '../handlers/create_enrollment';
import { eq, and } from 'drizzle-orm';

describe('createEnrollment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create test users with unique emails
  const createTestUser = async (role: 'student' | 'instructor' = 'student', suffix: string = '') => {
    const timestamp = Date.now();
    const result = await db.insert(usersTable)
      .values({
        email: role === 'student' ? `student${suffix}${timestamp}@test.com` : `instructor${suffix}${timestamp}@test.com`,
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: role
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper to create test course
  const createTestCourse = async (instructorId: number) => {
    const result = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A course for testing',
        instructor_id: instructorId,
        status: 'published'
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should create an enrollment successfully', async () => {
    // Create prerequisite data
    const student = await createTestUser('student');
    const instructor = await createTestUser('instructor');
    const course = await createTestCourse(instructor.id);

    const input: CreateEnrollmentInput = {
      student_id: student.id,
      course_id: course.id
    };

    const result = await createEnrollment(input);

    // Verify enrollment fields
    expect(result.id).toBeDefined();
    expect(result.student_id).toEqual(student.id);
    expect(result.course_id).toEqual(course.id);
    expect(result.status).toEqual('active');
    expect(result.progress_percentage).toEqual(0);
    expect(typeof result.progress_percentage).toBe('number');
    expect(result.enrolled_at).toBeInstanceOf(Date);
    expect(result.completed_at).toBeNull();
  });

  it('should save enrollment to database correctly', async () => {
    // Create prerequisite data
    const student = await createTestUser('student');
    const instructor = await createTestUser('instructor');
    const course = await createTestCourse(instructor.id);

    const input: CreateEnrollmentInput = {
      student_id: student.id,
      course_id: course.id
    };

    const result = await createEnrollment(input);

    // Verify enrollment was saved to database
    const enrollments = await db.select()
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.id, result.id))
      .execute();

    expect(enrollments).toHaveLength(1);
    const savedEnrollment = enrollments[0];
    expect(savedEnrollment.student_id).toEqual(student.id);
    expect(savedEnrollment.course_id).toEqual(course.id);
    expect(savedEnrollment.status).toEqual('active');
    expect(parseFloat(savedEnrollment.progress_percentage.toString())).toEqual(0);
    expect(savedEnrollment.enrolled_at).toBeInstanceOf(Date);
    expect(savedEnrollment.completed_at).toBeNull();
  });

  it('should throw error when student does not exist', async () => {
    const instructor = await createTestUser('instructor');
    const course = await createTestCourse(instructor.id);

    const input: CreateEnrollmentInput = {
      student_id: 999, // Non-existent student
      course_id: course.id
    };

    expect(createEnrollment(input)).rejects.toThrow(/student not found/i);
  });

  it('should throw error when course does not exist', async () => {
    const student = await createTestUser('student');

    const input: CreateEnrollmentInput = {
      student_id: student.id,
      course_id: 999 // Non-existent course
    };

    expect(createEnrollment(input)).rejects.toThrow(/course not found/i);
  });

  it('should throw error when user is not a student', async () => {
    const instructor = await createTestUser('instructor', '1');
    const anotherInstructor = await createTestUser('instructor', '2');
    const course = await createTestCourse(anotherInstructor.id);

    const input: CreateEnrollmentInput = {
      student_id: instructor.id, // Instructor trying to enroll
      course_id: course.id
    };

    expect(createEnrollment(input)).rejects.toThrow(/user is not a student/i);
  });

  it('should throw error when student is already enrolled', async () => {
    // Create prerequisite data
    const student = await createTestUser('student');
    const instructor = await createTestUser('instructor');
    const course = await createTestCourse(instructor.id);

    // Create existing enrollment
    await db.insert(enrollmentsTable)
      .values({
        student_id: student.id,
        course_id: course.id,
        status: 'active',
        progress_percentage: 0
      })
      .execute();

    const input: CreateEnrollmentInput = {
      student_id: student.id,
      course_id: course.id
    };

    expect(createEnrollment(input)).rejects.toThrow(/already enrolled/i);
  });

  it('should allow same student to enroll in different courses', async () => {
    // Create prerequisite data
    const student = await createTestUser('student');
    const instructor = await createTestUser('instructor');
    const course1 = await createTestCourse(instructor.id);
    
    // Create second course
    const course2 = await db.insert(coursesTable)
      .values({
        title: 'Second Test Course',
        description: 'Another course for testing',
        instructor_id: instructor.id,
        status: 'published'
      })
      .returning()
      .execute();

    // Enroll in first course
    const input1: CreateEnrollmentInput = {
      student_id: student.id,
      course_id: course1.id
    };
    await createEnrollment(input1);

    // Enroll in second course - should succeed
    const input2: CreateEnrollmentInput = {
      student_id: student.id,
      course_id: course2[0].id
    };
    const result = await createEnrollment(input2);

    expect(result.student_id).toEqual(student.id);
    expect(result.course_id).toEqual(course2[0].id);
    expect(result.status).toEqual('active');
  });

  it('should allow different students to enroll in same course', async () => {
    // Create prerequisite data
    const instructor = await createTestUser('instructor');
    const course = await createTestCourse(instructor.id);
    
    // Create two students
    const student1 = await db.insert(usersTable)
      .values({
        email: 'student1@test.com',
        password_hash: 'hashed_password',
        first_name: 'Student',
        last_name: 'One',
        role: 'student'
      })
      .returning()
      .execute();

    const student2 = await db.insert(usersTable)
      .values({
        email: 'student2@test.com',
        password_hash: 'hashed_password',
        first_name: 'Student',
        last_name: 'Two',
        role: 'student'
      })
      .returning()
      .execute();

    // Enroll first student
    const input1: CreateEnrollmentInput = {
      student_id: student1[0].id,
      course_id: course.id
    };
    const result1 = await createEnrollment(input1);

    // Enroll second student - should succeed
    const input2: CreateEnrollmentInput = {
      student_id: student2[0].id,
      course_id: course.id
    };
    const result2 = await createEnrollment(input2);

    expect(result1.student_id).toEqual(student1[0].id);
    expect(result2.student_id).toEqual(student2[0].id);
    expect(result1.course_id).toEqual(course.id);
    expect(result2.course_id).toEqual(course.id);
  });

  it('should handle numeric conversion for progress_percentage correctly', async () => {
    // Create prerequisite data
    const student = await createTestUser('student');
    const instructor = await createTestUser('instructor');
    const course = await createTestCourse(instructor.id);

    const input: CreateEnrollmentInput = {
      student_id: student.id,
      course_id: course.id
    };

    const result = await createEnrollment(input);

    // Verify that progress_percentage is returned as a number
    expect(typeof result.progress_percentage).toBe('number');
    expect(result.progress_percentage).toEqual(0);
  });
});