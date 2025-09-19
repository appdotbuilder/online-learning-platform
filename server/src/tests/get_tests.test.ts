import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable, testsTable } from '../db/schema';
import { getTestsByCourse, getTestById, getPublishedTestsByCourse } from '../handlers/get_tests';

// Test data setup
const testUser = {
  email: 'instructor@test.com',
  password_hash: 'hashed_password',
  first_name: 'John',
  last_name: 'Doe',
  role: 'instructor' as const
};

const testCourse = {
  title: 'Test Course',
  description: 'A course for testing',
  instructor_id: 1, // Will be set after creating user
  status: 'published' as const
};

const testTest1 = {
  course_id: 1, // Will be set after creating course
  title: 'Test Quiz 1',
  description: 'First test quiz',
  time_limit_minutes: 60,
  max_attempts: 3,
  passing_score: 70.5,
  is_published: true
};

const testTest2 = {
  course_id: 1, // Will be set after creating course
  title: 'Test Quiz 2',
  description: 'Second test quiz',
  time_limit_minutes: null,
  max_attempts: 1,
  passing_score: 80.0,
  is_published: false
};

const testTest3 = {
  course_id: 2, // Different course
  title: 'Other Course Quiz',
  description: 'Quiz for another course',
  time_limit_minutes: 45,
  max_attempts: 2,
  passing_score: 65.0,
  is_published: true
};

describe('getTestsByCourse', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all tests for a specific course', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const courseResult = await db.insert(coursesTable)
      .values({ ...testCourse, instructor_id: userResult[0].id })
      .returning()
      .execute();

    const courseResult2 = await db.insert(coursesTable)
      .values({ 
        ...testCourse, 
        title: 'Other Course',
        instructor_id: userResult[0].id 
      })
      .returning()
      .execute();

    // Create tests
    await db.insert(testsTable)
      .values([
        { ...testTest1, course_id: courseResult[0].id },
        { ...testTest2, course_id: courseResult[0].id },
        { ...testTest3, course_id: courseResult2[0].id }
      ])
      .execute();

    // Test the handler
    const result = await getTestsByCourse(courseResult[0].id);

    // Verify results
    expect(result).toHaveLength(2);
    expect(result.map(t => t.title).sort()).toEqual(['Test Quiz 1', 'Test Quiz 2']);
    
    const quiz1 = result.find(t => t.title === 'Test Quiz 1')!;
    expect(quiz1.course_id).toEqual(courseResult[0].id);
    expect(quiz1.passing_score).toEqual(70.5);
    expect(typeof quiz1.passing_score).toEqual('number');
    expect(quiz1.is_published).toBe(true);
    expect(quiz1.time_limit_minutes).toEqual(60);
    expect(quiz1.max_attempts).toEqual(3);
    expect(quiz1.created_at).toBeInstanceOf(Date);
    expect(quiz1.updated_at).toBeInstanceOf(Date);

    const quiz2 = result.find(t => t.title === 'Test Quiz 2')!;
    expect(quiz2.course_id).toEqual(courseResult[0].id);
    expect(quiz2.passing_score).toEqual(80.0);
    expect(typeof quiz2.passing_score).toEqual('number');
    expect(quiz2.is_published).toBe(false);
    expect(quiz2.time_limit_minutes).toBeNull();
  });

  it('should return empty array for course with no tests', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const courseResult = await db.insert(coursesTable)
      .values({ ...testCourse, instructor_id: userResult[0].id })
      .returning()
      .execute();

    // Test the handler
    const result = await getTestsByCourse(courseResult[0].id);

    // Verify results
    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent course', async () => {
    const result = await getTestsByCourse(999);
    expect(result).toHaveLength(0);
  });
});

describe('getTestById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return test by ID', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const courseResult = await db.insert(coursesTable)
      .values({ ...testCourse, instructor_id: userResult[0].id })
      .returning()
      .execute();

    const testResult = await db.insert(testsTable)
      .values({ ...testTest1, course_id: courseResult[0].id })
      .returning()
      .execute();

    // Test the handler
    const result = await getTestById(testResult[0].id);

    // Verify results
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(testResult[0].id);
    expect(result!.title).toEqual('Test Quiz 1');
    expect(result!.description).toEqual('First test quiz');
    expect(result!.course_id).toEqual(courseResult[0].id);
    expect(result!.passing_score).toEqual(70.5);
    expect(typeof result!.passing_score).toEqual('number');
    expect(result!.is_published).toBe(true);
    expect(result!.time_limit_minutes).toEqual(60);
    expect(result!.max_attempts).toEqual(3);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent test', async () => {
    const result = await getTestById(999);
    expect(result).toBeNull();
  });

  it('should handle numeric conversions correctly', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const courseResult = await db.insert(coursesTable)
      .values({ ...testCourse, instructor_id: userResult[0].id })
      .returning()
      .execute();

    // Test with decimal passing score
    const testResult = await db.insert(testsTable)
      .values({ 
        ...testTest1, 
        course_id: courseResult[0].id,
        passing_score: 85.75 
      })
      .returning()
      .execute();

    const result = await getTestById(testResult[0].id);

    expect(result!.passing_score).toEqual(85.75);
    expect(typeof result!.passing_score).toEqual('number');
  });
});

describe('getPublishedTestsByCourse', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return only published tests for a course', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const courseResult = await db.insert(coursesTable)
      .values({ ...testCourse, instructor_id: userResult[0].id })
      .returning()
      .execute();

    // Create tests - mix of published and unpublished
    await db.insert(testsTable)
      .values([
        { ...testTest1, course_id: courseResult[0].id, is_published: true },
        { ...testTest2, course_id: courseResult[0].id, is_published: false },
        { 
          ...testTest1, 
          course_id: courseResult[0].id, 
          title: 'Published Quiz 3',
          is_published: true 
        }
      ])
      .execute();

    // Test the handler
    const result = await getPublishedTestsByCourse(courseResult[0].id);

    // Verify results
    expect(result).toHaveLength(2);
    expect(result.every(t => t.is_published)).toBe(true);
    expect(result.map(t => t.title).sort()).toEqual(['Published Quiz 3', 'Test Quiz 1']);
    
    // Verify numeric conversions
    result.forEach(test => {
      expect(typeof test.passing_score).toEqual('number');
      expect(test.course_id).toEqual(courseResult[0].id);
    });
  });

  it('should return empty array when no published tests exist', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const courseResult = await db.insert(coursesTable)
      .values({ ...testCourse, instructor_id: userResult[0].id })
      .returning()
      .execute();

    // Create only unpublished tests
    await db.insert(testsTable)
      .values([
        { ...testTest1, course_id: courseResult[0].id, is_published: false },
        { ...testTest2, course_id: courseResult[0].id, is_published: false }
      ])
      .execute();

    // Test the handler
    const result = await getPublishedTestsByCourse(courseResult[0].id);

    // Verify results
    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent course', async () => {
    const result = await getPublishedTestsByCourse(999);
    expect(result).toHaveLength(0);
  });

  it('should not return tests from other courses', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const courseResult1 = await db.insert(coursesTable)
      .values({ ...testCourse, instructor_id: userResult[0].id })
      .returning()
      .execute();

    const courseResult2 = await db.insert(coursesTable)
      .values({ 
        ...testCourse, 
        title: 'Other Course',
        instructor_id: userResult[0].id 
      })
      .returning()
      .execute();

    // Create tests for both courses
    await db.insert(testsTable)
      .values([
        { ...testTest1, course_id: courseResult1[0].id, is_published: true },
        { ...testTest3, course_id: courseResult2[0].id, is_published: true }
      ])
      .execute();

    // Test the handler for first course
    const result = await getPublishedTestsByCourse(courseResult1[0].id);

    // Verify results - should only get tests from first course
    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Test Quiz 1');
    expect(result[0].course_id).toEqual(courseResult1[0].id);
  });
});