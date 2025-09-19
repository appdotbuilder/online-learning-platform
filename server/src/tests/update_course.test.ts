import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { coursesTable, usersTable } from '../db/schema';
import { type UpdateCourseInput } from '../schema';
import { updateCourse } from '../handlers/update_course';
import { eq } from 'drizzle-orm';

describe('updateCourse', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test instructor
  const createTestInstructor = async () => {
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    return instructorResult[0];
  };

  // Helper function to create test course
  const createTestCourse = async (instructorId: number) => {
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Original Course Title',
        description: 'Original course description',
        instructor_id: instructorId,
        status: 'draft'
      })
      .returning()
      .execute();

    return courseResult[0];
  };

  it('should update course title', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);

    const updateInput: UpdateCourseInput = {
      id: course.id,
      title: 'Updated Course Title'
    };

    const result = await updateCourse(updateInput);

    expect(result.id).toEqual(course.id);
    expect(result.title).toEqual('Updated Course Title');
    expect(result.description).toEqual('Original course description');
    expect(result.instructor_id).toEqual(instructor.id);
    expect(result.status).toEqual('draft');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > course.updated_at).toBe(true);
  });

  it('should update course description', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);

    const updateInput: UpdateCourseInput = {
      id: course.id,
      description: 'Updated course description'
    };

    const result = await updateCourse(updateInput);

    expect(result.id).toEqual(course.id);
    expect(result.title).toEqual('Original Course Title');
    expect(result.description).toEqual('Updated course description');
    expect(result.instructor_id).toEqual(instructor.id);
    expect(result.status).toEqual('draft');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update course status', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);

    const updateInput: UpdateCourseInput = {
      id: course.id,
      status: 'published'
    };

    const result = await updateCourse(updateInput);

    expect(result.id).toEqual(course.id);
    expect(result.title).toEqual('Original Course Title');
    expect(result.description).toEqual('Original course description');
    expect(result.instructor_id).toEqual(instructor.id);
    expect(result.status).toEqual('published');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update multiple fields simultaneously', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);

    const updateInput: UpdateCourseInput = {
      id: course.id,
      title: 'Complete New Title',
      description: 'Complete new description',
      status: 'published'
    };

    const result = await updateCourse(updateInput);

    expect(result.id).toEqual(course.id);
    expect(result.title).toEqual('Complete New Title');
    expect(result.description).toEqual('Complete new description');
    expect(result.instructor_id).toEqual(instructor.id);
    expect(result.status).toEqual('published');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save updated course to database', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);

    const updateInput: UpdateCourseInput = {
      id: course.id,
      title: 'Database Test Title',
      status: 'archived'
    };

    const result = await updateCourse(updateInput);

    // Verify changes are persisted in database
    const courses = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, result.id))
      .execute();

    expect(courses).toHaveLength(1);
    expect(courses[0].title).toEqual('Database Test Title');
    expect(courses[0].description).toEqual('Original course description');
    expect(courses[0].status).toEqual('archived');
    expect(courses[0].updated_at).toBeInstanceOf(Date);
    expect(courses[0].updated_at > course.updated_at).toBe(true);
  });

  it('should handle updates with no changes gracefully', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);

    const updateInput: UpdateCourseInput = {
      id: course.id
      // No fields to update, only updated_at should change
    };

    const result = await updateCourse(updateInput);

    expect(result.id).toEqual(course.id);
    expect(result.title).toEqual('Original Course Title');
    expect(result.description).toEqual('Original course description');
    expect(result.instructor_id).toEqual(instructor.id);
    expect(result.status).toEqual('draft');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > course.updated_at).toBe(true);
  });

  it('should throw error for non-existent course', async () => {
    const updateInput: UpdateCourseInput = {
      id: 99999,
      title: 'This should fail'
    };

    await expect(updateCourse(updateInput)).rejects.toThrow(/Course with id 99999 not found/i);
  });

  it('should update course status from draft to published', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);

    // Verify initial status is draft
    expect(course.status).toEqual('draft');

    const updateInput: UpdateCourseInput = {
      id: course.id,
      status: 'published'
    };

    const result = await updateCourse(updateInput);

    expect(result.status).toEqual('published');

    // Verify in database
    const updatedCourses = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, result.id))
      .execute();

    expect(updatedCourses[0].status).toEqual('published');
  });

  it('should handle all course status transitions', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);

    // Test draft -> published
    let result = await updateCourse({
      id: course.id,
      status: 'published'
    });
    expect(result.status).toEqual('published');

    // Test published -> archived
    result = await updateCourse({
      id: course.id,
      status: 'archived'
    });
    expect(result.status).toEqual('archived');

    // Test archived -> draft (republishing)
    result = await updateCourse({
      id: course.id,
      status: 'draft'
    });
    expect(result.status).toEqual('draft');
  });

  it('should preserve unchanged fields when updating specific fields', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);

    // Update only title
    const titleUpdate: UpdateCourseInput = {
      id: course.id,
      title: 'New Title Only'
    };

    const result1 = await updateCourse(titleUpdate);
    expect(result1.title).toEqual('New Title Only');
    expect(result1.description).toEqual('Original course description');
    expect(result1.status).toEqual('draft');

    // Update only description  
    const descriptionUpdate: UpdateCourseInput = {
      id: course.id,
      description: 'New Description Only'
    };

    const result2 = await updateCourse(descriptionUpdate);
    expect(result2.title).toEqual('New Title Only'); // Should preserve previous update
    expect(result2.description).toEqual('New Description Only');
    expect(result2.status).toEqual('draft');
  });
});