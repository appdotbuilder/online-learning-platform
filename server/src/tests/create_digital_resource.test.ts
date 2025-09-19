import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { digitalResourcesTable, coursesTable, usersTable } from '../db/schema';
import { type CreateDigitalResourceInput } from '../schema';
import { createDigitalResource } from '../handlers/create_digital_resource';
import { eq } from 'drizzle-orm';

// Test input for course-specific resource
const testCourseResourceInput: CreateDigitalResourceInput = {
  course_id: 1,
  title: 'Course Resource PDF',
  description: 'A helpful PDF for this course',
  file_url: 'https://example.com/course-resource.pdf',
  file_size_bytes: 1048576, // 1MB
  resource_type: 'pdf',
  is_downloadable: true
};

// Test input for global resource
const testGlobalResourceInput: CreateDigitalResourceInput = {
  course_id: null,
  title: 'Global Template',
  description: 'A template available to all users',
  file_url: 'https://example.com/global-template.docx',
  file_size_bytes: 512000, // 500KB
  resource_type: 'template',
  is_downloadable: true
};

describe('createDigitalResource', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a course-specific digital resource', async () => {
    // Create prerequisite user and course
    const instructor = await db.insert(usersTable)
      .values({
        email: 'instructor@example.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    const course = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A test course',
        instructor_id: instructor[0].id
      })
      .returning()
      .execute();

    const inputWithValidCourseId = {
      ...testCourseResourceInput,
      course_id: course[0].id
    };

    const result = await createDigitalResource(inputWithValidCourseId);

    // Verify basic fields
    expect(result.title).toEqual('Course Resource PDF');
    expect(result.description).toEqual('A helpful PDF for this course');
    expect(result.file_url).toEqual('https://example.com/course-resource.pdf');
    expect(result.file_size_bytes).toEqual(1048576);
    expect(result.resource_type).toEqual('pdf');
    expect(result.is_downloadable).toEqual(true);
    expect(result.course_id).toEqual(course[0].id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a global digital resource', async () => {
    const result = await createDigitalResource(testGlobalResourceInput);

    // Verify basic fields
    expect(result.title).toEqual('Global Template');
    expect(result.description).toEqual('A template available to all users');
    expect(result.file_url).toEqual('https://example.com/global-template.docx');
    expect(result.file_size_bytes).toEqual(512000);
    expect(result.resource_type).toEqual('template');
    expect(result.is_downloadable).toEqual(true);
    expect(result.course_id).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save digital resource to database', async () => {
    const result = await createDigitalResource(testGlobalResourceInput);

    // Query database to verify resource was saved
    const resources = await db.select()
      .from(digitalResourcesTable)
      .where(eq(digitalResourcesTable.id, result.id))
      .execute();

    expect(resources).toHaveLength(1);
    expect(resources[0].title).toEqual('Global Template');
    expect(resources[0].description).toEqual('A template available to all users');
    expect(resources[0].file_url).toEqual('https://example.com/global-template.docx');
    expect(resources[0].file_size_bytes).toEqual(512000);
    expect(resources[0].resource_type).toEqual('template');
    expect(resources[0].is_downloadable).toEqual(true);
    expect(resources[0].course_id).toBeNull();
    expect(resources[0].created_at).toBeInstanceOf(Date);
    expect(resources[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle different resource types correctly', async () => {
    const checklistInput: CreateDigitalResourceInput = {
      course_id: null,
      title: 'Study Checklist',
      description: 'A checklist for students',
      file_url: 'https://example.com/checklist.pdf',
      file_size_bytes: 256000,
      resource_type: 'checklist',
      is_downloadable: false
    };

    const result = await createDigitalResource(checklistInput);

    expect(result.resource_type).toEqual('checklist');
    expect(result.is_downloadable).toEqual(false);
  });

  it('should throw error for non-existent course_id', async () => {
    const inputWithInvalidCourseId = {
      ...testCourseResourceInput,
      course_id: 999 // Non-existent course ID
    };

    await expect(createDigitalResource(inputWithInvalidCourseId)).rejects.toThrow(/Course with id 999 not found/i);
  });

  it('should handle nullable description correctly', async () => {
    const inputWithoutDescription: CreateDigitalResourceInput = {
      course_id: null,
      title: 'Resource Without Description',
      description: null,
      file_url: 'https://example.com/no-desc.pdf',
      file_size_bytes: 128000,
      resource_type: 'other',
      is_downloadable: true
    };

    const result = await createDigitalResource(inputWithoutDescription);

    expect(result.description).toBeNull();
    expect(result.title).toEqual('Resource Without Description');
  });

  it('should verify course exists when course_id is provided', async () => {
    // Create prerequisite user and course
    const instructor = await db.insert(usersTable)
      .values({
        email: 'instructor@example.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    const course = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A test course',
        instructor_id: instructor[0].id
      })
      .returning()
      .execute();

    const inputWithValidCourseId = {
      ...testCourseResourceInput,
      course_id: course[0].id
    };

    // Should succeed with valid course ID
    const result = await createDigitalResource(inputWithValidCourseId);
    expect(result.course_id).toEqual(course[0].id);

    // Should fail with invalid course ID
    const inputWithInvalidCourseId = {
      ...testCourseResourceInput,
      course_id: course[0].id + 100
    };

    await expect(createDigitalResource(inputWithInvalidCourseId)).rejects.toThrow();
  });
});