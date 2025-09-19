import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable } from '../db/schema';
import { getCourses, getCoursesByInstructor, getCourseById } from '../handlers/get_courses';

describe('getCourses', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return only published courses', async () => {
    // Create instructor first
    const instructor = await db.insert(usersTable).values({
      email: 'instructor@test.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'Instructor',
      role: 'instructor'
    }).returning().execute();

    // Create courses with different statuses
    await db.insert(coursesTable).values([
      {
        title: 'Published Course 1',
        description: 'A published course',
        instructor_id: instructor[0].id,
        status: 'published'
      },
      {
        title: 'Draft Course',
        description: 'A draft course',
        instructor_id: instructor[0].id,
        status: 'draft'
      },
      {
        title: 'Published Course 2',
        description: 'Another published course',
        instructor_id: instructor[0].id,
        status: 'published'
      },
      {
        title: 'Archived Course',
        description: 'An archived course',
        instructor_id: instructor[0].id,
        status: 'archived'
      }
    ]).execute();

    const result = await getCourses();

    // Should only return published courses
    expect(result).toHaveLength(2);
    expect(result.every(course => course.status === 'published')).toBe(true);
    expect(result.some(course => course.title === 'Published Course 1')).toBe(true);
    expect(result.some(course => course.title === 'Published Course 2')).toBe(true);
    expect(result.some(course => course.title === 'Draft Course')).toBe(false);
    expect(result.some(course => course.title === 'Archived Course')).toBe(false);
  });

  it('should return empty array when no published courses exist', async () => {
    // Create instructor first
    const instructor = await db.insert(usersTable).values({
      email: 'instructor@test.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'Instructor',
      role: 'instructor'
    }).returning().execute();

    // Create only draft courses
    await db.insert(coursesTable).values({
      title: 'Draft Course',
      description: 'A draft course',
      instructor_id: instructor[0].id,
      status: 'draft'
    }).execute();

    const result = await getCourses();

    expect(result).toHaveLength(0);
  });

  it('should return courses with all required fields', async () => {
    // Create instructor first
    const instructor = await db.insert(usersTable).values({
      email: 'instructor@test.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'Instructor',
      role: 'instructor'
    }).returning().execute();

    // Create a published course
    await db.insert(coursesTable).values({
      title: 'Test Course',
      description: 'A test course description',
      instructor_id: instructor[0].id,
      status: 'published'
    }).execute();

    const result = await getCourses();

    expect(result).toHaveLength(1);
    const course = result[0];
    expect(course.id).toBeDefined();
    expect(course.title).toBe('Test Course');
    expect(course.description).toBe('A test course description');
    expect(course.instructor_id).toBe(instructor[0].id);
    expect(course.status).toBe('published');
    expect(course.created_at).toBeInstanceOf(Date);
    expect(course.updated_at).toBeInstanceOf(Date);
  });
});

describe('getCoursesByInstructor', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all courses by specific instructor regardless of status', async () => {
    // Create multiple instructors
    const instructor1 = await db.insert(usersTable).values({
      email: 'instructor1@test.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'Instructor1',
      role: 'instructor'
    }).returning().execute();

    const instructor2 = await db.insert(usersTable).values({
      email: 'instructor2@test.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'Instructor2',
      role: 'instructor'
    }).returning().execute();

    // Create courses for both instructors with different statuses
    await db.insert(coursesTable).values([
      {
        title: 'Course 1 by Instructor 1',
        description: 'Published course',
        instructor_id: instructor1[0].id,
        status: 'published'
      },
      {
        title: 'Course 2 by Instructor 1',
        description: 'Draft course',
        instructor_id: instructor1[0].id,
        status: 'draft'
      },
      {
        title: 'Course 3 by Instructor 1',
        description: 'Archived course',
        instructor_id: instructor1[0].id,
        status: 'archived'
      },
      {
        title: 'Course by Instructor 2',
        description: 'Course by different instructor',
        instructor_id: instructor2[0].id,
        status: 'published'
      }
    ]).execute();

    const result = await getCoursesByInstructor(instructor1[0].id);

    // Should return all 3 courses by instructor 1
    expect(result).toHaveLength(3);
    expect(result.every(course => course.instructor_id === instructor1[0].id)).toBe(true);
    expect(result.some(course => course.status === 'published')).toBe(true);
    expect(result.some(course => course.status === 'draft')).toBe(true);
    expect(result.some(course => course.status === 'archived')).toBe(true);
  });

  it('should return empty array when instructor has no courses', async () => {
    // Create instructor without courses
    const instructor = await db.insert(usersTable).values({
      email: 'instructor@test.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'Instructor',
      role: 'instructor'
    }).returning().execute();

    const result = await getCoursesByInstructor(instructor[0].id);

    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent instructor', async () => {
    const result = await getCoursesByInstructor(999);

    expect(result).toHaveLength(0);
  });

  it('should return courses with all required fields', async () => {
    // Create instructor
    const instructor = await db.insert(usersTable).values({
      email: 'instructor@test.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'Instructor',
      role: 'instructor'
    }).returning().execute();

    // Create a course
    await db.insert(coursesTable).values({
      title: 'Test Course',
      description: 'A test course description',
      instructor_id: instructor[0].id,
      status: 'published'
    }).execute();

    const result = await getCoursesByInstructor(instructor[0].id);

    expect(result).toHaveLength(1);
    const course = result[0];
    expect(course.id).toBeDefined();
    expect(course.title).toBe('Test Course');
    expect(course.description).toBe('A test course description');
    expect(course.instructor_id).toBe(instructor[0].id);
    expect(course.status).toBe('published');
    expect(course.created_at).toBeInstanceOf(Date);
    expect(course.updated_at).toBeInstanceOf(Date);
  });
});

describe('getCourseById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return course when it exists', async () => {
    // Create instructor
    const instructor = await db.insert(usersTable).values({
      email: 'instructor@test.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'Instructor',
      role: 'instructor'
    }).returning().execute();

    // Create course
    const course = await db.insert(coursesTable).values({
      title: 'Test Course',
      description: 'A test course description',
      instructor_id: instructor[0].id,
      status: 'published'
    }).returning().execute();

    const result = await getCourseById(course[0].id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(course[0].id);
    expect(result!.title).toBe('Test Course');
    expect(result!.description).toBe('A test course description');
    expect(result!.instructor_id).toBe(instructor[0].id);
    expect(result!.status).toBe('published');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when course does not exist', async () => {
    const result = await getCourseById(999);

    expect(result).toBeNull();
  });

  it('should return course regardless of status', async () => {
    // Create instructor
    const instructor = await db.insert(usersTable).values({
      email: 'instructor@test.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'Instructor',
      role: 'instructor'
    }).returning().execute();

    // Create draft course
    const course = await db.insert(coursesTable).values({
      title: 'Draft Course',
      description: 'A draft course',
      instructor_id: instructor[0].id,
      status: 'draft'
    }).returning().execute();

    const result = await getCourseById(course[0].id);

    expect(result).not.toBeNull();
    expect(result!.status).toBe('draft');
    expect(result!.title).toBe('Draft Course');
  });

  it('should return first course when multiple courses exist', async () => {
    // Create instructor
    const instructor = await db.insert(usersTable).values({
      email: 'instructor@test.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'Instructor',
      role: 'instructor'
    }).returning().execute();

    // Create multiple courses
    const courses = await db.insert(coursesTable).values([
      {
        title: 'Course 1',
        description: 'First course',
        instructor_id: instructor[0].id,
        status: 'published'
      },
      {
        title: 'Course 2',
        description: 'Second course',
        instructor_id: instructor[0].id,
        status: 'draft'
      }
    ]).returning().execute();

    // Test each course individually
    const result1 = await getCourseById(courses[0].id);
    const result2 = await getCourseById(courses[1].id);

    expect(result1).not.toBeNull();
    expect(result1!.title).toBe('Course 1');
    expect(result2).not.toBeNull();
    expect(result2!.title).toBe('Course 2');
  });
});