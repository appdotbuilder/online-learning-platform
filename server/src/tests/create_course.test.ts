import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { coursesTable, usersTable } from '../db/schema';
import { type CreateCourseInput } from '../schema';
import { createCourse } from '../handlers/create_course';
import { eq } from 'drizzle-orm';

// Test input for course creation
const testInput: CreateCourseInput = {
  title: 'Introduction to TypeScript',
  description: 'A comprehensive course covering TypeScript fundamentals and advanced topics.',
  instructor_id: 1 // Will be set dynamically after creating instructor
};

describe('createCourse', () => {
  let instructorId: number;
  let studentId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create an instructor user for testing
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@example.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Doe',
        role: 'instructor'
      })
      .returning()
      .execute();
    
    instructorId = instructorResult[0].id;

    // Create a student user for negative testing
    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@example.com',
        password_hash: 'hashed_password',
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'student'
      })
      .returning()
      .execute();
    
    studentId = studentResult[0].id;
  });

  afterEach(resetDB);

  it('should create a course with valid instructor', async () => {
    const input: CreateCourseInput = {
      ...testInput,
      instructor_id: instructorId
    };

    const result = await createCourse(input);

    // Verify returned course data
    expect(result.title).toEqual('Introduction to TypeScript');
    expect(result.description).toEqual(testInput.description);
    expect(result.instructor_id).toEqual(instructorId);
    expect(result.status).toEqual('draft'); // Should default to draft
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save course to database', async () => {
    const input: CreateCourseInput = {
      ...testInput,
      instructor_id: instructorId
    };

    const result = await createCourse(input);

    // Verify course was saved to database
    const courses = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, result.id))
      .execute();

    expect(courses).toHaveLength(1);
    expect(courses[0].title).toEqual('Introduction to TypeScript');
    expect(courses[0].description).toEqual(testInput.description);
    expect(courses[0].instructor_id).toEqual(instructorId);
    expect(courses[0].status).toEqual('draft');
    expect(courses[0].created_at).toBeInstanceOf(Date);
    expect(courses[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create multiple courses for same instructor', async () => {
    const input1: CreateCourseInput = {
      title: 'JavaScript Basics',
      description: 'Learn JavaScript fundamentals',
      instructor_id: instructorId
    };

    const input2: CreateCourseInput = {
      title: 'Advanced React',
      description: 'Master advanced React patterns',
      instructor_id: instructorId
    };

    const course1 = await createCourse(input1);
    const course2 = await createCourse(input2);

    // Verify both courses were created with different IDs
    expect(course1.id).not.toEqual(course2.id);
    expect(course1.title).toEqual('JavaScript Basics');
    expect(course2.title).toEqual('Advanced React');
    expect(course1.instructor_id).toEqual(instructorId);
    expect(course2.instructor_id).toEqual(instructorId);

    // Verify both courses exist in database
    const allCourses = await db.select()
      .from(coursesTable)
      .execute();

    expect(allCourses).toHaveLength(2);
  });

  it('should throw error when instructor does not exist', async () => {
    const input: CreateCourseInput = {
      ...testInput,
      instructor_id: 999999 // Non-existent instructor ID
    };

    await expect(createCourse(input)).rejects.toThrow(/instructor not found/i);
  });

  it('should throw error when user is not an instructor', async () => {
    const input: CreateCourseInput = {
      ...testInput,
      instructor_id: studentId // Using student ID instead of instructor
    };

    await expect(createCourse(input)).rejects.toThrow(/must be an instructor/i);
  });

  it('should handle long course titles and descriptions', async () => {
    const input: CreateCourseInput = {
      title: 'A'.repeat(200), // Very long title
      description: 'B'.repeat(1000), // Very long description
      instructor_id: instructorId
    };

    const result = await createCourse(input);

    expect(result.title).toEqual('A'.repeat(200));
    expect(result.description).toEqual('B'.repeat(1000));
    expect(result.instructor_id).toEqual(instructorId);
  });

  it('should create course with minimal description', async () => {
    const input: CreateCourseInput = {
      title: 'Short Course',
      description: '',
      instructor_id: instructorId
    };

    const result = await createCourse(input);

    expect(result.title).toEqual('Short Course');
    expect(result.description).toEqual('');
    expect(result.instructor_id).toEqual(instructorId);
    expect(result.status).toEqual('draft');
  });

  it('should set created_at and updated_at timestamps', async () => {
    const beforeCreation = new Date();
    
    const input: CreateCourseInput = {
      ...testInput,
      instructor_id: instructorId
    };

    const result = await createCourse(input);
    
    const afterCreation = new Date();

    // Verify timestamps are within reasonable range
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.updated_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
  });
});