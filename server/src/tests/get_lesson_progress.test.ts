import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable, lessonsTable, lessonProgressTable } from '../db/schema';
import { getLessonProgressByStudent, getLessonProgressByLesson } from '../handlers/get_lesson_progress';

// Test data setup
const testUser1 = {
  email: 'student1@example.com',
  password_hash: 'hashed_password_1',
  first_name: 'Student',
  last_name: 'One',
  role: 'student' as const
};

const testUser2 = {
  email: 'student2@example.com',
  password_hash: 'hashed_password_2',
  first_name: 'Student',
  last_name: 'Two',
  role: 'student' as const
};

const testInstructor = {
  email: 'instructor@example.com',
  password_hash: 'hashed_password_instructor',
  first_name: 'John',
  last_name: 'Instructor',
  role: 'instructor' as const
};

const testCourse1 = {
  title: 'Test Course 1',
  description: 'First test course'
};

const testCourse2 = {
  title: 'Test Course 2',
  description: 'Second test course'
};

const testLesson1 = {
  title: 'Lesson 1',
  content: 'Content for lesson 1',
  lesson_type: 'text' as const,
  order_index: 1,
  video_url: null,
  document_url: null
};

const testLesson2 = {
  title: 'Lesson 2',
  content: 'Content for lesson 2',
  lesson_type: 'video' as const,
  order_index: 2,
  video_url: 'https://example.com/video2',
  document_url: null
};

const testLesson3 = {
  title: 'Lesson 3',
  content: 'Content for lesson 3',
  lesson_type: 'document' as const,
  order_index: 1,
  video_url: null,
  document_url: 'https://example.com/doc3'
};

describe('getLessonProgressByStudent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch all lesson progress for a student across all courses', async () => {
    // Create test data
    const [instructor] = await db.insert(usersTable).values(testInstructor).returning().execute();
    const [student] = await db.insert(usersTable).values(testUser1).returning().execute();
    
    const [course1] = await db.insert(coursesTable).values({
      ...testCourse1,
      instructor_id: instructor.id
    }).returning().execute();
    
    const [course2] = await db.insert(coursesTable).values({
      ...testCourse2,
      instructor_id: instructor.id
    }).returning().execute();
    
    const [lesson1] = await db.insert(lessonsTable).values({
      ...testLesson1,
      course_id: course1.id
    }).returning().execute();
    
    const [lesson2] = await db.insert(lessonsTable).values({
      ...testLesson2,
      course_id: course1.id
    }).returning().execute();
    
    const [lesson3] = await db.insert(lessonsTable).values({
      ...testLesson3,
      course_id: course2.id
    }).returning().execute();
    
    // Create progress records
    const progress1 = await db.insert(lessonProgressTable).values({
      student_id: student.id,
      lesson_id: lesson1.id,
      is_completed: true,
      completed_at: new Date('2024-01-15T10:00:00Z')
    }).returning().execute();
    
    const progress2 = await db.insert(lessonProgressTable).values({
      student_id: student.id,
      lesson_id: lesson2.id,
      is_completed: false,
      completed_at: null
    }).returning().execute();
    
    const progress3 = await db.insert(lessonProgressTable).values({
      student_id: student.id,
      lesson_id: lesson3.id,
      is_completed: true,
      completed_at: new Date('2024-01-16T14:30:00Z')
    }).returning().execute();

    // Fetch progress for student across all courses
    const result = await getLessonProgressByStudent(student.id);

    expect(result).toHaveLength(3);
    
    // Verify all progress records are returned
    const progressIds = result.map(p => p.id).sort();
    const expectedIds = [progress1[0].id, progress2[0].id, progress3[0].id].sort();
    expect(progressIds).toEqual(expectedIds);
    
    // Verify completed progress
    const completedProgress = result.find(p => p.lesson_id === lesson1.id);
    expect(completedProgress).toBeDefined();
    expect(completedProgress!.is_completed).toBe(true);
    expect(completedProgress!.completed_at).toBeInstanceOf(Date);
    
    // Verify incomplete progress
    const incompleteProgress = result.find(p => p.lesson_id === lesson2.id);
    expect(incompleteProgress).toBeDefined();
    expect(incompleteProgress!.is_completed).toBe(false);
    expect(incompleteProgress!.completed_at).toBeNull();
  });

  it('should fetch lesson progress for a student filtered by specific course', async () => {
    // Create test data
    const [instructor] = await db.insert(usersTable).values(testInstructor).returning().execute();
    const [student] = await db.insert(usersTable).values(testUser1).returning().execute();
    
    const [course1] = await db.insert(coursesTable).values({
      ...testCourse1,
      instructor_id: instructor.id
    }).returning().execute();
    
    const [course2] = await db.insert(coursesTable).values({
      ...testCourse2,
      instructor_id: instructor.id
    }).returning().execute();
    
    const [lesson1] = await db.insert(lessonsTable).values({
      ...testLesson1,
      course_id: course1.id
    }).returning().execute();
    
    const [lesson2] = await db.insert(lessonsTable).values({
      ...testLesson2,
      course_id: course1.id
    }).returning().execute();
    
    const [lesson3] = await db.insert(lessonsTable).values({
      ...testLesson3,
      course_id: course2.id
    }).returning().execute();
    
    // Create progress records for different courses
    const progress1 = await db.insert(lessonProgressTable).values({
      student_id: student.id,
      lesson_id: lesson1.id,
      is_completed: true,
      completed_at: new Date('2024-01-15T10:00:00Z')
    }).returning().execute();
    
    const progress2 = await db.insert(lessonProgressTable).values({
      student_id: student.id,
      lesson_id: lesson2.id,
      is_completed: false,
      completed_at: null
    }).returning().execute();
    
    await db.insert(lessonProgressTable).values({
      student_id: student.id,
      lesson_id: lesson3.id,
      is_completed: true,
      completed_at: new Date('2024-01-16T14:30:00Z')
    }).returning().execute();

    // Fetch progress for student filtered by course1
    const result = await getLessonProgressByStudent(student.id, course1.id);

    expect(result).toHaveLength(2);
    
    // Verify only progress from course1 is returned
    const progressIds = result.map(p => p.id).sort();
    const expectedIds = [progress1[0].id, progress2[0].id].sort();
    expect(progressIds).toEqual(expectedIds);
    
    // Verify lesson IDs belong to course1
    const lessonIds = result.map(p => p.lesson_id).sort();
    expect(lessonIds).toEqual([lesson1.id, lesson2.id].sort());
  });

  it('should return empty array when student has no progress', async () => {
    // Create test data without progress
    const [instructor] = await db.insert(usersTable).values(testInstructor).returning().execute();
    const [student] = await db.insert(usersTable).values(testUser1).returning().execute();
    
    const [course] = await db.insert(coursesTable).values({
      ...testCourse1,
      instructor_id: instructor.id
    }).returning().execute();

    // Fetch progress for student with no progress records
    const result = await getLessonProgressByStudent(student.id);

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should return empty array when filtering by course with no progress', async () => {
    // Create test data
    const [instructor] = await db.insert(usersTable).values(testInstructor).returning().execute();
    const [student] = await db.insert(usersTable).values(testUser1).returning().execute();
    
    const [course1] = await db.insert(coursesTable).values({
      ...testCourse1,
      instructor_id: instructor.id
    }).returning().execute();
    
    const [course2] = await db.insert(coursesTable).values({
      ...testCourse2,
      instructor_id: instructor.id
    }).returning().execute();
    
    const [lesson1] = await db.insert(lessonsTable).values({
      ...testLesson1,
      course_id: course1.id
    }).returning().execute();
    
    // Create progress only in course1
    await db.insert(lessonProgressTable).values({
      student_id: student.id,
      lesson_id: lesson1.id,
      is_completed: true,
      completed_at: new Date('2024-01-15T10:00:00Z')
    }).returning().execute();

    // Fetch progress filtered by course2 (no progress exists)
    const result = await getLessonProgressByStudent(student.id, course2.id);

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });
});

describe('getLessonProgressByLesson', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch all student progress for a specific lesson', async () => {
    // Create test data
    const [instructor] = await db.insert(usersTable).values(testInstructor).returning().execute();
    const [student1] = await db.insert(usersTable).values(testUser1).returning().execute();
    const [student2] = await db.insert(usersTable).values(testUser2).returning().execute();
    
    const [course] = await db.insert(coursesTable).values({
      ...testCourse1,
      instructor_id: instructor.id
    }).returning().execute();
    
    const [lesson1] = await db.insert(lessonsTable).values({
      ...testLesson1,
      course_id: course.id
    }).returning().execute();
    
    const [lesson2] = await db.insert(lessonsTable).values({
      ...testLesson2,
      course_id: course.id
    }).returning().execute();
    
    // Create progress records for different students and lessons
    const progress1 = await db.insert(lessonProgressTable).values({
      student_id: student1.id,
      lesson_id: lesson1.id,
      is_completed: true,
      completed_at: new Date('2024-01-15T10:00:00Z')
    }).returning().execute();
    
    const progress2 = await db.insert(lessonProgressTable).values({
      student_id: student2.id,
      lesson_id: lesson1.id,
      is_completed: false,
      completed_at: null
    }).returning().execute();
    
    // Progress for different lesson (should not be included)
    await db.insert(lessonProgressTable).values({
      student_id: student1.id,
      lesson_id: lesson2.id,
      is_completed: true,
      completed_at: new Date('2024-01-16T14:30:00Z')
    }).returning().execute();

    // Fetch progress for specific lesson
    const result = await getLessonProgressByLesson(lesson1.id);

    expect(result).toHaveLength(2);
    
    // Verify correct progress records are returned
    const progressIds = result.map(p => p.id).sort();
    const expectedIds = [progress1[0].id, progress2[0].id].sort();
    expect(progressIds).toEqual(expectedIds);
    
    // Verify all records are for the correct lesson
    result.forEach(progress => {
      expect(progress.lesson_id).toBe(lesson1.id);
    });
    
    // Verify student progress details
    const student1Progress = result.find(p => p.student_id === student1.id);
    expect(student1Progress).toBeDefined();
    expect(student1Progress!.is_completed).toBe(true);
    expect(student1Progress!.completed_at).toBeInstanceOf(Date);
    
    const student2Progress = result.find(p => p.student_id === student2.id);
    expect(student2Progress).toBeDefined();
    expect(student2Progress!.is_completed).toBe(false);
    expect(student2Progress!.completed_at).toBeNull();
  });

  it('should return empty array when lesson has no progress records', async () => {
    // Create test data without progress
    const [instructor] = await db.insert(usersTable).values(testInstructor).returning().execute();
    
    const [course] = await db.insert(coursesTable).values({
      ...testCourse1,
      instructor_id: instructor.id
    }).returning().execute();
    
    const [lesson] = await db.insert(lessonsTable).values({
      ...testLesson1,
      course_id: course.id
    }).returning().execute();

    // Fetch progress for lesson with no progress records
    const result = await getLessonProgressByLesson(lesson.id);

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should handle date conversion correctly for completed and incomplete progress', async () => {
    // Create test data
    const [instructor] = await db.insert(usersTable).values(testInstructor).returning().execute();
    const [student1] = await db.insert(usersTable).values(testUser1).returning().execute();
    const [student2] = await db.insert(usersTable).values(testUser2).returning().execute();
    
    const [course] = await db.insert(coursesTable).values({
      ...testCourse1,
      instructor_id: instructor.id
    }).returning().execute();
    
    const [lesson] = await db.insert(lessonsTable).values({
      ...testLesson1,
      course_id: course.id
    }).returning().execute();
    
    const completedDate = new Date('2024-01-15T10:00:00Z');
    
    // Create completed progress
    await db.insert(lessonProgressTable).values({
      student_id: student1.id,
      lesson_id: lesson.id,
      is_completed: true,
      completed_at: completedDate
    }).returning().execute();
    
    // Create incomplete progress
    await db.insert(lessonProgressTable).values({
      student_id: student2.id,
      lesson_id: lesson.id,
      is_completed: false,
      completed_at: null
    }).returning().execute();

    const result = await getLessonProgressByLesson(lesson.id);

    expect(result).toHaveLength(2);
    
    // Verify date handling
    const completedProgress = result.find(p => p.student_id === student1.id);
    expect(completedProgress!.completed_at).toBeInstanceOf(Date);
    expect(completedProgress!.completed_at!.getTime()).toBe(completedDate.getTime());
    expect(completedProgress!.created_at).toBeInstanceOf(Date);
    
    const incompleteProgress = result.find(p => p.student_id === student2.id);
    expect(incompleteProgress!.completed_at).toBeNull();
    expect(incompleteProgress!.created_at).toBeInstanceOf(Date);
  });
});