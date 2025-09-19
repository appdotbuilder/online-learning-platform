import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { lessonsTable, coursesTable, usersTable } from '../db/schema';
import { type CreateLessonInput } from '../schema';
import { createLesson } from '../handlers/create_lesson';
import { eq } from 'drizzle-orm';

describe('createLesson', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let instructorId: number;
  let courseId: number;

  beforeEach(async () => {
    // Create instructor user
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
    
    instructorId = instructorResult[0].id;

    // Create course
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A course for testing lessons',
        instructor_id: instructorId
      })
      .returning()
      .execute();

    courseId = courseResult[0].id;
  });

  it('should create a video lesson successfully', async () => {
    const testInput: CreateLessonInput = {
      course_id: courseId,
      title: 'Introduction to JavaScript',
      content: 'This lesson covers the basics of JavaScript programming.',
      lesson_type: 'video',
      order_index: 1,
      video_url: 'https://example.com/video.mp4',
      document_url: null
    };

    const result = await createLesson(testInput);

    // Verify all fields are set correctly
    expect(result.course_id).toEqual(courseId);
    expect(result.title).toEqual('Introduction to JavaScript');
    expect(result.content).toEqual('This lesson covers the basics of JavaScript programming.');
    expect(result.lesson_type).toEqual('video');
    expect(result.order_index).toEqual(1);
    expect(result.video_url).toEqual('https://example.com/video.mp4');
    expect(result.document_url).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a text lesson with null content', async () => {
    const testInput: CreateLessonInput = {
      course_id: courseId,
      title: 'Text Lesson',
      content: null,
      lesson_type: 'text',
      order_index: 2,
      video_url: null,
      document_url: null
    };

    const result = await createLesson(testInput);

    expect(result.course_id).toEqual(courseId);
    expect(result.title).toEqual('Text Lesson');
    expect(result.content).toBeNull();
    expect(result.lesson_type).toEqual('text');
    expect(result.order_index).toEqual(2);
    expect(result.video_url).toBeNull();
    expect(result.document_url).toBeNull();
  });

  it('should create a document lesson successfully', async () => {
    const testInput: CreateLessonInput = {
      course_id: courseId,
      title: 'Course Materials',
      content: 'Download and review these materials.',
      lesson_type: 'document',
      order_index: 3,
      video_url: null,
      document_url: 'https://example.com/materials.pdf'
    };

    const result = await createLesson(testInput);

    expect(result.course_id).toEqual(courseId);
    expect(result.title).toEqual('Course Materials');
    expect(result.content).toEqual('Download and review these materials.');
    expect(result.lesson_type).toEqual('document');
    expect(result.order_index).toEqual(3);
    expect(result.video_url).toBeNull();
    expect(result.document_url).toEqual('https://example.com/materials.pdf');
  });

  it('should create a mixed lesson with both video and document URLs', async () => {
    const testInput: CreateLessonInput = {
      course_id: courseId,
      title: 'Advanced Topics',
      content: 'Watch the video and review the supporting documents.',
      lesson_type: 'mixed',
      order_index: 4,
      video_url: 'https://example.com/advanced.mp4',
      document_url: 'https://example.com/notes.pdf'
    };

    const result = await createLesson(testInput);

    expect(result.lesson_type).toEqual('mixed');
    expect(result.video_url).toEqual('https://example.com/advanced.mp4');
    expect(result.document_url).toEqual('https://example.com/notes.pdf');
  });

  it('should save lesson to database correctly', async () => {
    const testInput: CreateLessonInput = {
      course_id: courseId,
      title: 'Database Test Lesson',
      content: 'Testing database persistence.',
      lesson_type: 'text',
      order_index: 5,
      video_url: null,
      document_url: null
    };

    const result = await createLesson(testInput);

    // Query the database directly to verify persistence
    const lessons = await db.select()
      .from(lessonsTable)
      .where(eq(lessonsTable.id, result.id))
      .execute();

    expect(lessons).toHaveLength(1);
    expect(lessons[0].title).toEqual('Database Test Lesson');
    expect(lessons[0].content).toEqual('Testing database persistence.');
    expect(lessons[0].course_id).toEqual(courseId);
    expect(lessons[0].lesson_type).toEqual('text');
    expect(lessons[0].order_index).toEqual(5);
    expect(lessons[0].created_at).toBeInstanceOf(Date);
    expect(lessons[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle multiple lessons with different order indices', async () => {
    const lesson1Input: CreateLessonInput = {
      course_id: courseId,
      title: 'Lesson 1',
      content: 'First lesson content',
      lesson_type: 'text',
      order_index: 1,
      video_url: null,
      document_url: null
    };

    const lesson2Input: CreateLessonInput = {
      course_id: courseId,
      title: 'Lesson 2',
      content: 'Second lesson content',
      lesson_type: 'video',
      order_index: 2,
      video_url: 'https://example.com/lesson2.mp4',
      document_url: null
    };

    const result1 = await createLesson(lesson1Input);
    const result2 = await createLesson(lesson2Input);

    expect(result1.order_index).toEqual(1);
    expect(result2.order_index).toEqual(2);
    expect(result1.title).toEqual('Lesson 1');
    expect(result2.title).toEqual('Lesson 2');
  });

  it('should throw error when course does not exist', async () => {
    const testInput: CreateLessonInput = {
      course_id: 99999, // Non-existent course ID
      title: 'Invalid Course Lesson',
      content: 'This should fail',
      lesson_type: 'text',
      order_index: 1,
      video_url: null,
      document_url: null
    };

    await expect(createLesson(testInput)).rejects.toThrow(/Course with ID 99999 not found/i);
  });

  it('should handle zero order index correctly', async () => {
    const testInput: CreateLessonInput = {
      course_id: courseId,
      title: 'Introduction',
      content: 'Course introduction',
      lesson_type: 'text',
      order_index: 0,
      video_url: null,
      document_url: null
    };

    const result = await createLesson(testInput);

    expect(result.order_index).toEqual(0);
    expect(result.title).toEqual('Introduction');
  });
});