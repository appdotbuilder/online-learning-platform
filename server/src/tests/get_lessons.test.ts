import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable, lessonsTable } from '../db/schema';
import { getLessonsByCourse, getLessonById } from '../handlers/get_lessons';

// Test data setup
const testInstructor = {
  email: 'instructor@test.com',
  password_hash: 'hashed_password',
  first_name: 'John',
  last_name: 'Instructor',
  role: 'instructor' as const
};

const testCourse = {
  title: 'Test Course',
  description: 'A course for testing lessons',
  instructor_id: 0 // Will be set after creating instructor
};

const testLessons = [
  {
    course_id: 0, // Will be set after creating course
    title: 'First Lesson',
    content: 'Content for first lesson',
    lesson_type: 'text' as const,
    order_index: 1,
    video_url: null,
    document_url: null
  },
  {
    course_id: 0, // Will be set after creating course
    title: 'Second Lesson',
    content: 'Content for second lesson',
    lesson_type: 'video' as const,
    order_index: 2,
    video_url: 'https://example.com/video1',
    document_url: null
  },
  {
    course_id: 0, // Will be set after creating course
    title: 'Third Lesson',
    content: null,
    lesson_type: 'document' as const,
    order_index: 3,
    video_url: null,
    document_url: 'https://example.com/doc1'
  }
];

describe('getLessonsByCourse', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return lessons for a course ordered by order_index', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values(testInstructor)
      .returning()
      .execute();
    
    const instructorId = instructorResult[0].id;

    // Create course
    const courseResult = await db.insert(coursesTable)
      .values({
        ...testCourse,
        instructor_id: instructorId
      })
      .returning()
      .execute();
    
    const courseId = courseResult[0].id;

    // Create lessons with mixed order
    const lessonsToCreate = testLessons.map(lesson => ({
      ...lesson,
      course_id: courseId
    }));

    // Insert in different order to test sorting
    await db.insert(lessonsTable)
      .values([lessonsToCreate[1], lessonsToCreate[2], lessonsToCreate[0]])
      .execute();

    // Test the handler
    const results = await getLessonsByCourse(courseId);

    expect(results).toHaveLength(3);
    
    // Verify ordering by order_index
    expect(results[0].title).toEqual('First Lesson');
    expect(results[0].order_index).toEqual(1);
    expect(results[0].lesson_type).toEqual('text');
    expect(results[0].content).toEqual('Content for first lesson');
    expect(results[0].video_url).toBeNull();
    expect(results[0].document_url).toBeNull();

    expect(results[1].title).toEqual('Second Lesson');
    expect(results[1].order_index).toEqual(2);
    expect(results[1].lesson_type).toEqual('video');
    expect(results[1].video_url).toEqual('https://example.com/video1');

    expect(results[2].title).toEqual('Third Lesson');
    expect(results[2].order_index).toEqual(3);
    expect(results[2].lesson_type).toEqual('document');
    expect(results[2].content).toBeNull();
    expect(results[2].document_url).toEqual('https://example.com/doc1');

    // Verify all results have required fields
    results.forEach(lesson => {
      expect(lesson.id).toBeDefined();
      expect(lesson.course_id).toEqual(courseId);
      expect(lesson.created_at).toBeInstanceOf(Date);
      expect(lesson.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return empty array for course with no lessons', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values(testInstructor)
      .returning()
      .execute();
    
    const instructorId = instructorResult[0].id;

    // Create course without lessons
    const courseResult = await db.insert(coursesTable)
      .values({
        ...testCourse,
        instructor_id: instructorId
      })
      .returning()
      .execute();
    
    const courseId = courseResult[0].id;

    const results = await getLessonsByCourse(courseId);

    expect(results).toHaveLength(0);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should return empty array for non-existent course', async () => {
    const nonExistentCourseId = 99999;

    const results = await getLessonsByCourse(nonExistentCourseId);

    expect(results).toHaveLength(0);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should handle lessons with same order_index consistently', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values(testInstructor)
      .returning()
      .execute();
    
    const instructorId = instructorResult[0].id;

    // Create course
    const courseResult = await db.insert(coursesTable)
      .values({
        ...testCourse,
        instructor_id: instructorId
      })
      .returning()
      .execute();
    
    const courseId = courseResult[0].id;

    // Create lessons with same order_index
    const lessonsWithSameOrder = [
      {
        course_id: courseId,
        title: 'Lesson A',
        content: 'Content A',
        lesson_type: 'text' as const,
        order_index: 1,
        video_url: null,
        document_url: null
      },
      {
        course_id: courseId,
        title: 'Lesson B',
        content: 'Content B',
        lesson_type: 'text' as const,
        order_index: 1,
        video_url: null,
        document_url: null
      }
    ];

    await db.insert(lessonsTable)
      .values(lessonsWithSameOrder)
      .execute();

    const results = await getLessonsByCourse(courseId);

    expect(results).toHaveLength(2);
    expect(results[0].order_index).toEqual(1);
    expect(results[1].order_index).toEqual(1);
  });
});

describe('getLessonById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return lesson by ID', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values(testInstructor)
      .returning()
      .execute();
    
    const instructorId = instructorResult[0].id;

    // Create course
    const courseResult = await db.insert(coursesTable)
      .values({
        ...testCourse,
        instructor_id: instructorId
      })
      .returning()
      .execute();
    
    const courseId = courseResult[0].id;

    // Create lesson
    const lessonResult = await db.insert(lessonsTable)
      .values({
        ...testLessons[0],
        course_id: courseId
      })
      .returning()
      .execute();
    
    const lessonId = lessonResult[0].id;

    // Test the handler
    const result = await getLessonById(lessonId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(lessonId);
    expect(result!.title).toEqual('First Lesson');
    expect(result!.content).toEqual('Content for first lesson');
    expect(result!.lesson_type).toEqual('text');
    expect(result!.order_index).toEqual(1);
    expect(result!.course_id).toEqual(courseId);
    expect(result!.video_url).toBeNull();
    expect(result!.document_url).toBeNull();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return lesson with video URL', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values(testInstructor)
      .returning()
      .execute();
    
    const instructorId = instructorResult[0].id;

    // Create course
    const courseResult = await db.insert(coursesTable)
      .values({
        ...testCourse,
        instructor_id: instructorId
      })
      .returning()
      .execute();
    
    const courseId = courseResult[0].id;

    // Create video lesson
    const lessonResult = await db.insert(lessonsTable)
      .values({
        ...testLessons[1], // Video lesson
        course_id: courseId
      })
      .returning()
      .execute();
    
    const lessonId = lessonResult[0].id;

    const result = await getLessonById(lessonId);

    expect(result).not.toBeNull();
    expect(result!.lesson_type).toEqual('video');
    expect(result!.video_url).toEqual('https://example.com/video1');
    expect(result!.document_url).toBeNull();
  });

  it('should return lesson with document URL', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values(testInstructor)
      .returning()
      .execute();
    
    const instructorId = instructorResult[0].id;

    // Create course
    const courseResult = await db.insert(coursesTable)
      .values({
        ...testCourse,
        instructor_id: instructorId
      })
      .returning()
      .execute();
    
    const courseId = courseResult[0].id;

    // Create document lesson
    const lessonResult = await db.insert(lessonsTable)
      .values({
        ...testLessons[2], // Document lesson
        course_id: courseId
      })
      .returning()
      .execute();
    
    const lessonId = lessonResult[0].id;

    const result = await getLessonById(lessonId);

    expect(result).not.toBeNull();
    expect(result!.lesson_type).toEqual('document');
    expect(result!.content).toBeNull();
    expect(result!.video_url).toBeNull();
    expect(result!.document_url).toEqual('https://example.com/doc1');
  });

  it('should return null for non-existent lesson', async () => {
    const nonExistentLessonId = 99999;

    const result = await getLessonById(nonExistentLessonId);

    expect(result).toBeNull();
  });

  it('should handle mixed lesson type correctly', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values(testInstructor)
      .returning()
      .execute();
    
    const instructorId = instructorResult[0].id;

    // Create course
    const courseResult = await db.insert(coursesTable)
      .values({
        ...testCourse,
        instructor_id: instructorId
      })
      .returning()
      .execute();
    
    const courseId = courseResult[0].id;

    // Create mixed lesson
    const mixedLesson = {
      course_id: courseId,
      title: 'Mixed Content Lesson',
      content: 'Text content with video and document',
      lesson_type: 'mixed' as const,
      order_index: 1,
      video_url: 'https://example.com/video2',
      document_url: 'https://example.com/doc2'
    };

    const lessonResult = await db.insert(lessonsTable)
      .values(mixedLesson)
      .returning()
      .execute();
    
    const lessonId = lessonResult[0].id;

    const result = await getLessonById(lessonId);

    expect(result).not.toBeNull();
    expect(result!.lesson_type).toEqual('mixed');
    expect(result!.content).toEqual('Text content with video and document');
    expect(result!.video_url).toEqual('https://example.com/video2');
    expect(result!.document_url).toEqual('https://example.com/doc2');
  });
});