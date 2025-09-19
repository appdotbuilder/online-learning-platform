import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable, enrollmentsTable } from '../db/schema';
import { getEnrollmentsByStudent, getEnrollmentsByCourse, checkEnrollment } from '../handlers/get_enrollments';
import { eq } from 'drizzle-orm';

describe('get_enrollments handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testInstructorId: number;
  let testStudentId: number;
  let testStudent2Id: number;
  let testCourseId: number;
  let testCourse2Id: number;
  let testEnrollmentId: number;
  let testEnrollment2Id: number;

  beforeEach(async () => {
    // Create test instructor
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();
    testInstructorId = instructorResult[0].id;

    // Create test students
    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'Student',
        role: 'student'
      })
      .returning()
      .execute();
    testStudentId = studentResult[0].id;

    const student2Result = await db.insert(usersTable)
      .values({
        email: 'student2@test.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'Student2',
        role: 'student'
      })
      .returning()
      .execute();
    testStudent2Id = student2Result[0].id;

    // Create test courses
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A test course',
        instructor_id: testInstructorId
      })
      .returning()
      .execute();
    testCourseId = courseResult[0].id;

    const course2Result = await db.insert(coursesTable)
      .values({
        title: 'Test Course 2',
        description: 'Another test course',
        instructor_id: testInstructorId
      })
      .returning()
      .execute();
    testCourse2Id = course2Result[0].id;

    // Create test enrollments
    const enrollmentResult = await db.insert(enrollmentsTable)
      .values({
        student_id: testStudentId,
        course_id: testCourseId,
        status: 'active',
        progress_percentage: 25.5
      })
      .returning()
      .execute();
    testEnrollmentId = enrollmentResult[0].id;

    const enrollment2Result = await db.insert(enrollmentsTable)
      .values({
        student_id: testStudent2Id,
        course_id: testCourseId,
        status: 'completed',
        progress_percentage: 100.0
      })
      .returning()
      .execute();
    testEnrollment2Id = enrollment2Result[0].id;

    // Create enrollment for same student in different course
    await db.insert(enrollmentsTable)
      .values({
        student_id: testStudentId,
        course_id: testCourse2Id,
        status: 'dropped',
        progress_percentage: 10.0
      })
      .execute();
  });

  describe('getEnrollmentsByStudent', () => {
    it('should return all enrollments for a specific student', async () => {
      const enrollments = await getEnrollmentsByStudent(testStudentId);

      expect(enrollments).toHaveLength(2);
      
      // Check first enrollment
      const firstEnrollment = enrollments.find(e => e.course_id === testCourseId);
      expect(firstEnrollment).toBeDefined();
      expect(firstEnrollment!.id).toEqual(testEnrollmentId);
      expect(firstEnrollment!.student_id).toEqual(testStudentId);
      expect(firstEnrollment!.course_id).toEqual(testCourseId);
      expect(firstEnrollment!.status).toEqual('active');
      expect(firstEnrollment!.progress_percentage).toEqual(25.5);
      expect(typeof firstEnrollment!.progress_percentage).toBe('number');

      // Check second enrollment
      const secondEnrollment = enrollments.find(e => e.course_id === testCourse2Id);
      expect(secondEnrollment).toBeDefined();
      expect(secondEnrollment!.student_id).toEqual(testStudentId);
      expect(secondEnrollment!.course_id).toEqual(testCourse2Id);
      expect(secondEnrollment!.status).toEqual('dropped');
      expect(secondEnrollment!.progress_percentage).toEqual(10.0);
    });

    it('should return empty array when student has no enrollments', async () => {
      // Create a student with no enrollments
      const newStudentResult = await db.insert(usersTable)
        .values({
          email: 'nostudent@test.com',
          password_hash: 'hashedpassword',
          first_name: 'No',
          last_name: 'Enrollments',
          role: 'student'
        })
        .returning()
        .execute();
      
      const enrollments = await getEnrollmentsByStudent(newStudentResult[0].id);
      expect(enrollments).toHaveLength(0);
    });

    it('should return empty array when student does not exist', async () => {
      const enrollments = await getEnrollmentsByStudent(99999);
      expect(enrollments).toHaveLength(0);
    });
  });

  describe('getEnrollmentsByCourse', () => {
    it('should return all enrollments for a specific course', async () => {
      const enrollments = await getEnrollmentsByCourse(testCourseId);

      expect(enrollments).toHaveLength(2);

      // Check first enrollment
      const firstEnrollment = enrollments.find(e => e.student_id === testStudentId);
      expect(firstEnrollment).toBeDefined();
      expect(firstEnrollment!.id).toEqual(testEnrollmentId);
      expect(firstEnrollment!.student_id).toEqual(testStudentId);
      expect(firstEnrollment!.course_id).toEqual(testCourseId);
      expect(firstEnrollment!.status).toEqual('active');
      expect(firstEnrollment!.progress_percentage).toEqual(25.5);
      expect(typeof firstEnrollment!.progress_percentage).toBe('number');

      // Check second enrollment
      const secondEnrollment = enrollments.find(e => e.student_id === testStudent2Id);
      expect(secondEnrollment).toBeDefined();
      expect(secondEnrollment!.id).toEqual(testEnrollment2Id);
      expect(secondEnrollment!.student_id).toEqual(testStudent2Id);
      expect(secondEnrollment!.course_id).toEqual(testCourseId);
      expect(secondEnrollment!.status).toEqual('completed');
      expect(secondEnrollment!.progress_percentage).toEqual(100.0);
    });

    it('should return enrollments with different statuses', async () => {
      const enrollments = await getEnrollmentsByCourse(testCourseId);

      const statuses = enrollments.map(e => e.status);
      expect(statuses).toContain('active');
      expect(statuses).toContain('completed');
    });

    it('should return empty array when course has no enrollments', async () => {
      // Create a course with no enrollments
      const newCourseResult = await db.insert(coursesTable)
        .values({
          title: 'Empty Course',
          description: 'A course with no enrollments',
          instructor_id: testInstructorId
        })
        .returning()
        .execute();
      
      const enrollments = await getEnrollmentsByCourse(newCourseResult[0].id);
      expect(enrollments).toHaveLength(0);
    });

    it('should return empty array when course does not exist', async () => {
      const enrollments = await getEnrollmentsByCourse(99999);
      expect(enrollments).toHaveLength(0);
    });
  });

  describe('checkEnrollment', () => {
    it('should return enrollment when student is enrolled in course', async () => {
      const enrollment = await checkEnrollment(testStudentId, testCourseId);

      expect(enrollment).toBeDefined();
      expect(enrollment!.id).toEqual(testEnrollmentId);
      expect(enrollment!.student_id).toEqual(testStudentId);
      expect(enrollment!.course_id).toEqual(testCourseId);
      expect(enrollment!.status).toEqual('active');
      expect(enrollment!.progress_percentage).toEqual(25.5);
      expect(typeof enrollment!.progress_percentage).toBe('number');
      expect(enrollment!.enrolled_at).toBeInstanceOf(Date);
    });

    it('should return enrollment with completed status', async () => {
      const enrollment = await checkEnrollment(testStudent2Id, testCourseId);

      expect(enrollment).toBeDefined();
      expect(enrollment!.student_id).toEqual(testStudent2Id);
      expect(enrollment!.course_id).toEqual(testCourseId);
      expect(enrollment!.status).toEqual('completed');
      expect(enrollment!.progress_percentage).toEqual(100.0);
    });

    it('should return null when student is not enrolled in course', async () => {
      // Check for enrollment that doesn't exist
      const enrollment = await checkEnrollment(testStudentId, 99999);
      expect(enrollment).toBeNull();
    });

    it('should return null when student does not exist', async () => {
      const enrollment = await checkEnrollment(99999, testCourseId);
      expect(enrollment).toBeNull();
    });

    it('should return null when course does not exist', async () => {
      const enrollment = await checkEnrollment(testStudentId, 99999);
      expect(enrollment).toBeNull();
    });

    it('should return null when both student and course do not exist', async () => {
      const enrollment = await checkEnrollment(99999, 99999);
      expect(enrollment).toBeNull();
    });
  });

  describe('date handling', () => {
    it('should properly handle date fields in enrollment records', async () => {
      const enrollments = await getEnrollmentsByStudent(testStudentId);
      
      expect(enrollments.length).toBeGreaterThan(0);
      enrollments.forEach(enrollment => {
        expect(enrollment.enrolled_at).toBeInstanceOf(Date);
        // completed_at can be null for active enrollments
        if (enrollment.completed_at) {
          expect(enrollment.completed_at).toBeInstanceOf(Date);
        }
      });
    });

    it('should handle completed_at field properly', async () => {
      // Update enrollment to completed with completion date
      const completionDate = new Date();
      await db.update(enrollmentsTable)
        .set({ 
          status: 'completed',
          completed_at: completionDate
        })
        .where(eq(enrollmentsTable.id, testEnrollmentId))
        .execute();

      const enrollment = await checkEnrollment(testStudentId, testCourseId);
      
      expect(enrollment).toBeDefined();
      expect(enrollment!.status).toEqual('completed');
      expect(enrollment!.completed_at).toBeInstanceOf(Date);
    });
  });
});