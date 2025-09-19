import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  coursesTable, 
  lessonsTable, 
  enrollmentsTable, 
  lessonProgressTable 
} from '../db/schema';
import { type MarkLessonCompleteInput } from '../schema';
import { markLessonComplete } from '../handlers/mark_lesson_complete';
import { eq, and } from 'drizzle-orm';

describe('markLessonComplete', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  async function createTestData() {
    // Create instructor
    const instructor = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    // Create student
    const student = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hashed_password',
        first_name: 'Jane',
        last_name: 'Student',
        role: 'student'
      })
      .returning()
      .execute();

    // Create course
    const course = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A test course',
        instructor_id: instructor[0].id,
        status: 'published'
      })
      .returning()
      .execute();

    // Create lessons
    const lesson1 = await db.insert(lessonsTable)
      .values({
        course_id: course[0].id,
        title: 'Lesson 1',
        content: 'Content 1',
        lesson_type: 'text',
        order_index: 1
      })
      .returning()
      .execute();

    const lesson2 = await db.insert(lessonsTable)
      .values({
        course_id: course[0].id,
        title: 'Lesson 2',
        content: 'Content 2',
        lesson_type: 'video',
        order_index: 2,
        video_url: 'https://example.com/video.mp4'
      })
      .returning()
      .execute();

    // Create enrollment
    const enrollment = await db.insert(enrollmentsTable)
      .values({
        student_id: student[0].id,
        course_id: course[0].id,
        status: 'active',
        progress_percentage: 0
      })
      .returning()
      .execute();

    return {
      instructor: instructor[0],
      student: student[0],
      course: course[0],
      lesson1: lesson1[0],
      lesson2: lesson2[0],
      enrollment: enrollment[0]
    };
  }

  const testInput = (studentId: number, lessonId: number): MarkLessonCompleteInput => ({
    student_id: studentId,
    lesson_id: lessonId
  });

  it('should create new lesson progress when none exists', async () => {
    const { student, lesson1 } = await createTestData();
    const input = testInput(student.id, lesson1.id);

    const result = await markLessonComplete(input);

    // Verify result
    expect(result.student_id).toEqual(student.id);
    expect(result.lesson_id).toEqual(lesson1.id);
    expect(result.is_completed).toBe(true);
    expect(result.completed_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.id).toBeDefined();

    // Verify database record
    const progressRecords = await db.select()
      .from(lessonProgressTable)
      .where(
        and(
          eq(lessonProgressTable.student_id, student.id),
          eq(lessonProgressTable.lesson_id, lesson1.id)
        )
      )
      .execute();

    expect(progressRecords).toHaveLength(1);
    expect(progressRecords[0].is_completed).toBe(true);
    expect(progressRecords[0].completed_at).toBeInstanceOf(Date);
  });

  it('should update existing lesson progress', async () => {
    const { student, lesson1 } = await createTestData();

    // Create initial progress record (incomplete)
    await db.insert(lessonProgressTable)
      .values({
        student_id: student.id,
        lesson_id: lesson1.id,
        is_completed: false,
        completed_at: null
      })
      .execute();

    const input = testInput(student.id, lesson1.id);
    const result = await markLessonComplete(input);

    // Verify result
    expect(result.is_completed).toBe(true);
    expect(result.completed_at).toBeInstanceOf(Date);

    // Verify database was updated
    const progressRecords = await db.select()
      .from(lessonProgressTable)
      .where(
        and(
          eq(lessonProgressTable.student_id, student.id),
          eq(lessonProgressTable.lesson_id, lesson1.id)
        )
      )
      .execute();

    expect(progressRecords).toHaveLength(1);
    expect(progressRecords[0].is_completed).toBe(true);
    expect(progressRecords[0].completed_at).toBeInstanceOf(Date);
  });

  it('should update course progress to 50% when completing 1 of 2 lessons', async () => {
    const { student, course, lesson1 } = await createTestData();
    const input = testInput(student.id, lesson1.id);

    await markLessonComplete(input);

    // Verify enrollment progress
    const enrollments = await db.select()
      .from(enrollmentsTable)
      .where(
        and(
          eq(enrollmentsTable.student_id, student.id),
          eq(enrollmentsTable.course_id, course.id)
        )
      )
      .execute();

    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].progress_percentage).toEqual(50);
    expect(enrollments[0].status).toEqual('active');
    expect(enrollments[0].completed_at).toBeNull();
  });

  it('should complete course when all lessons are finished', async () => {
    const { student, course, lesson1, lesson2 } = await createTestData();

    // Complete first lesson
    await markLessonComplete(testInput(student.id, lesson1.id));

    // Complete second lesson
    await markLessonComplete(testInput(student.id, lesson2.id));

    // Verify enrollment is completed
    const enrollments = await db.select()
      .from(enrollmentsTable)
      .where(
        and(
          eq(enrollmentsTable.student_id, student.id),
          eq(enrollmentsTable.course_id, course.id)
        )
      )
      .execute();

    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].progress_percentage).toEqual(100);
    expect(enrollments[0].status).toEqual('completed');
    expect(enrollments[0].completed_at).toBeInstanceOf(Date);
  });

  it('should handle completing already completed lesson', async () => {
    const { student, lesson1 } = await createTestData();
    const input = testInput(student.id, lesson1.id);

    // Complete lesson first time
    const firstResult = await markLessonComplete(input);

    // Complete lesson again
    const secondResult = await markLessonComplete(input);

    // Both results should show completed status
    expect(firstResult.is_completed).toBe(true);
    expect(secondResult.is_completed).toBe(true);

    // Should still have only one progress record
    const progressRecords = await db.select()
      .from(lessonProgressTable)
      .where(
        and(
          eq(lessonProgressTable.student_id, student.id),
          eq(lessonProgressTable.lesson_id, lesson1.id)
        )
      )
      .execute();

    expect(progressRecords).toHaveLength(1);
    expect(progressRecords[0].is_completed).toBe(true);
  });

  it('should handle course with single lesson', async () => {
    const { student, course } = await createTestData();

    // Create course with single lesson
    const singleLesson = await db.insert(lessonsTable)
      .values({
        course_id: course.id,
        title: 'Only Lesson',
        content: 'Single lesson content',
        lesson_type: 'text',
        order_index: 1
      })
      .returning()
      .execute();

    // Create new enrollment for single lesson course
    const newCourse = await db.insert(coursesTable)
      .values({
        title: 'Single Lesson Course',
        description: 'Course with one lesson',
        instructor_id: course.instructor_id,
        status: 'published'
      })
      .returning()
      .execute();

    const oneLesson = await db.insert(lessonsTable)
      .values({
        course_id: newCourse[0].id,
        title: 'Only Lesson',
        content: 'Content',
        lesson_type: 'text',
        order_index: 1
      })
      .returning()
      .execute();

    await db.insert(enrollmentsTable)
      .values({
        student_id: student.id,
        course_id: newCourse[0].id,
        status: 'active',
        progress_percentage: 0
      })
      .execute();

    const input = testInput(student.id, oneLesson[0].id);
    await markLessonComplete(input);

    // Should immediately complete course
    const enrollments = await db.select()
      .from(enrollmentsTable)
      .where(
        and(
          eq(enrollmentsTable.student_id, student.id),
          eq(enrollmentsTable.course_id, newCourse[0].id)
        )
      )
      .execute();

    expect(enrollments[0].progress_percentage).toEqual(100);
    expect(enrollments[0].status).toEqual('completed');
  });

  it('should throw error for non-existent lesson', async () => {
    const { student } = await createTestData();
    const input = testInput(student.id, 99999); // Non-existent lesson ID

    expect(markLessonComplete(input)).rejects.toThrow(/Lesson not found/i);
  });

  it('should handle multiple students in same course', async () => {
    const { student, course, lesson1 } = await createTestData();

    // Create second student
    const student2 = await db.insert(usersTable)
      .values({
        email: 'student2@test.com',
        password_hash: 'hashed_password',
        first_name: 'Bob',
        last_name: 'Student2',
        role: 'student'
      })
      .returning()
      .execute();

    // Enroll second student in same course
    await db.insert(enrollmentsTable)
      .values({
        student_id: student2[0].id,
        course_id: course.id,
        status: 'active',
        progress_percentage: 0
      })
      .execute();

    // Complete lesson for first student
    await markLessonComplete(testInput(student.id, lesson1.id));

    // Complete lesson for second student
    await markLessonComplete(testInput(student2[0].id, lesson1.id));

    // Both should have separate progress records
    const allProgress = await db.select()
      .from(lessonProgressTable)
      .where(eq(lessonProgressTable.lesson_id, lesson1.id))
      .execute();

    expect(allProgress).toHaveLength(2);
    expect(allProgress.every(p => p.is_completed)).toBe(true);

    // Both should have 50% progress
    const enrollments = await db.select()
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.course_id, course.id))
      .execute();

    expect(enrollments).toHaveLength(2);
    expect(enrollments.every(e => e.progress_percentage === 50)).toBe(true);
  });
});