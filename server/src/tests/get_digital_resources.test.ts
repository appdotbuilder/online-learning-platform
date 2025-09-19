import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { digitalResourcesTable, usersTable, coursesTable } from '../db/schema';
import { 
  getDigitalResourcesByCourse, 
  getGlobalDigitalResources, 
  getDigitalResourceById 
} from '../handlers/get_digital_resources';

describe('Digital Resources Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getDigitalResourcesByCourse', () => {
    it('should return digital resources for a specific course', async () => {
      // Create prerequisite instructor user
      const [instructor] = await db.insert(usersTable)
        .values({
          email: 'instructor@test.com',
          password_hash: 'hash123',
          first_name: 'John',
          last_name: 'Instructor',
          role: 'instructor'
        })
        .returning()
        .execute();

      // Create course
      const [course] = await db.insert(coursesTable)
        .values({
          title: 'Test Course',
          description: 'Course for testing',
          instructor_id: instructor.id
        })
        .returning()
        .execute();

      // Create course-specific digital resources
      const [resource1] = await db.insert(digitalResourcesTable)
        .values({
          course_id: course.id,
          title: 'Course PDF Guide',
          description: 'Essential guide for the course',
          file_url: 'https://example.com/guide.pdf',
          file_size_bytes: 1024000,
          resource_type: 'pdf',
          is_downloadable: true
        })
        .returning()
        .execute();

      const [resource2] = await db.insert(digitalResourcesTable)
        .values({
          course_id: course.id,
          title: 'Course Template',
          description: 'Template for assignments',
          file_url: 'https://example.com/template.docx',
          file_size_bytes: 512000,
          resource_type: 'template',
          is_downloadable: true
        })
        .returning()
        .execute();

      // Create global resource (should not be returned)
      await db.insert(digitalResourcesTable)
        .values({
          course_id: null,
          title: 'Global Resource',
          description: 'Available to all',
          file_url: 'https://example.com/global.pdf',
          file_size_bytes: 256000,
          resource_type: 'pdf',
          is_downloadable: true
        })
        .execute();

      const results = await getDigitalResourcesByCourse(course.id);

      expect(results).toHaveLength(2);
      
      // Verify first resource
      const foundResource1 = results.find(r => r.id === resource1.id);
      expect(foundResource1).toBeDefined();
      expect(foundResource1!.title).toEqual('Course PDF Guide');
      expect(foundResource1!.description).toEqual('Essential guide for the course');
      expect(foundResource1!.file_url).toEqual('https://example.com/guide.pdf');
      expect(foundResource1!.file_size_bytes).toEqual(1024000);
      expect(foundResource1!.resource_type).toEqual('pdf');
      expect(foundResource1!.is_downloadable).toEqual(true);
      expect(foundResource1!.course_id).toEqual(course.id);
      expect(foundResource1!.created_at).toBeInstanceOf(Date);
      expect(foundResource1!.updated_at).toBeInstanceOf(Date);

      // Verify second resource
      const foundResource2 = results.find(r => r.id === resource2.id);
      expect(foundResource2).toBeDefined();
      expect(foundResource2!.title).toEqual('Course Template');
      expect(foundResource2!.resource_type).toEqual('template');
      expect(foundResource2!.file_size_bytes).toEqual(512000);
    });

    it('should return empty array when course has no resources', async () => {
      // Create prerequisite instructor user
      const [instructor] = await db.insert(usersTable)
        .values({
          email: 'instructor@test.com',
          password_hash: 'hash123',
          first_name: 'John',
          last_name: 'Instructor',
          role: 'instructor'
        })
        .returning()
        .execute();

      // Create course without resources
      const [course] = await db.insert(coursesTable)
        .values({
          title: 'Empty Course',
          description: 'Course with no resources',
          instructor_id: instructor.id
        })
        .returning()
        .execute();

      const results = await getDigitalResourcesByCourse(course.id);

      expect(results).toHaveLength(0);
    });

    it('should return empty array for non-existent course', async () => {
      const results = await getDigitalResourcesByCourse(99999);

      expect(results).toHaveLength(0);
    });
  });

  describe('getGlobalDigitalResources', () => {
    it('should return only global digital resources', async () => {
      // Create prerequisite instructor user
      const [instructor] = await db.insert(usersTable)
        .values({
          email: 'instructor@test.com',
          password_hash: 'hash123',
          first_name: 'John',
          last_name: 'Instructor',
          role: 'instructor'
        })
        .returning()
        .execute();

      // Create course
      const [course] = await db.insert(coursesTable)
        .values({
          title: 'Test Course',
          description: 'Course for testing',
          instructor_id: instructor.id
        })
        .returning()
        .execute();

      // Create global resources
      const [globalResource1] = await db.insert(digitalResourcesTable)
        .values({
          course_id: null,
          title: 'Global Checklist',
          description: 'Universal checklist for all students',
          file_url: 'https://example.com/checklist.pdf',
          file_size_bytes: 128000,
          resource_type: 'checklist',
          is_downloadable: true
        })
        .returning()
        .execute();

      const [globalResource2] = await db.insert(digitalResourcesTable)
        .values({
          course_id: null,
          title: 'General Template',
          description: 'Template for all courses',
          file_url: 'https://example.com/general-template.docx',
          file_size_bytes: 64000,
          resource_type: 'template',
          is_downloadable: false
        })
        .returning()
        .execute();

      // Create course-specific resource (should not be returned)
      await db.insert(digitalResourcesTable)
        .values({
          course_id: course.id,
          title: 'Course Specific',
          description: 'Only for this course',
          file_url: 'https://example.com/course-specific.pdf',
          file_size_bytes: 256000,
          resource_type: 'pdf',
          is_downloadable: true
        })
        .execute();

      const results = await getGlobalDigitalResources();

      expect(results).toHaveLength(2);

      // Verify first global resource
      const foundGlobal1 = results.find(r => r.id === globalResource1.id);
      expect(foundGlobal1).toBeDefined();
      expect(foundGlobal1!.title).toEqual('Global Checklist');
      expect(foundGlobal1!.description).toEqual('Universal checklist for all students');
      expect(foundGlobal1!.file_url).toEqual('https://example.com/checklist.pdf');
      expect(foundGlobal1!.file_size_bytes).toEqual(128000);
      expect(foundGlobal1!.resource_type).toEqual('checklist');
      expect(foundGlobal1!.is_downloadable).toEqual(true);
      expect(foundGlobal1!.course_id).toBeNull();

      // Verify second global resource
      const foundGlobal2 = results.find(r => r.id === globalResource2.id);
      expect(foundGlobal2).toBeDefined();
      expect(foundGlobal2!.title).toEqual('General Template');
      expect(foundGlobal2!.is_downloadable).toEqual(false);
      expect(foundGlobal2!.course_id).toBeNull();
    });

    it('should return empty array when no global resources exist', async () => {
      // Create prerequisite instructor user
      const [instructor] = await db.insert(usersTable)
        .values({
          email: 'instructor@test.com',
          password_hash: 'hash123',
          first_name: 'John',
          last_name: 'Instructor',
          role: 'instructor'
        })
        .returning()
        .execute();

      // Create course
      const [course] = await db.insert(coursesTable)
        .values({
          title: 'Test Course',
          description: 'Course for testing',
          instructor_id: instructor.id
        })
        .returning()
        .execute();

      // Create only course-specific resource
      await db.insert(digitalResourcesTable)
        .values({
          course_id: course.id,
          title: 'Course Only',
          description: 'Not global',
          file_url: 'https://example.com/course-only.pdf',
          file_size_bytes: 100000,
          resource_type: 'pdf',
          is_downloadable: true
        })
        .execute();

      const results = await getGlobalDigitalResources();

      expect(results).toHaveLength(0);
    });
  });

  describe('getDigitalResourceById', () => {
    it('should return digital resource by ID', async () => {
      // Create prerequisite instructor user
      const [instructor] = await db.insert(usersTable)
        .values({
          email: 'instructor@test.com',
          password_hash: 'hash123',
          first_name: 'John',
          last_name: 'Instructor',
          role: 'instructor'
        })
        .returning()
        .execute();

      // Create course
      const [course] = await db.insert(coursesTable)
        .values({
          title: 'Test Course',
          description: 'Course for testing',
          instructor_id: instructor.id
        })
        .returning()
        .execute();

      // Create digital resource
      const [resource] = await db.insert(digitalResourcesTable)
        .values({
          course_id: course.id,
          title: 'Downloadable Document',
          description: 'Important course document',
          file_url: 'https://example.com/document.pdf',
          file_size_bytes: 2048000,
          resource_type: 'document',
          is_downloadable: true
        })
        .returning()
        .execute();

      const result = await getDigitalResourceById(resource.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(resource.id);
      expect(result!.title).toEqual('Downloadable Document');
      expect(result!.description).toEqual('Important course document');
      expect(result!.file_url).toEqual('https://example.com/document.pdf');
      expect(result!.file_size_bytes).toEqual(2048000);
      expect(result!.resource_type).toEqual('document');
      expect(result!.is_downloadable).toEqual(true);
      expect(result!.course_id).toEqual(course.id);
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
    });

    it('should return global resource by ID', async () => {
      // Create global resource
      const [globalResource] = await db.insert(digitalResourcesTable)
        .values({
          course_id: null,
          title: 'Global Document',
          description: 'Available to all users',
          file_url: 'https://example.com/global-doc.pdf',
          file_size_bytes: 512000,
          resource_type: 'other',
          is_downloadable: false
        })
        .returning()
        .execute();

      const result = await getDigitalResourceById(globalResource.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(globalResource.id);
      expect(result!.title).toEqual('Global Document');
      expect(result!.description).toEqual('Available to all users');
      expect(result!.course_id).toBeNull();
      expect(result!.resource_type).toEqual('other');
      expect(result!.is_downloadable).toEqual(false);
    });

    it('should return null for non-existent resource', async () => {
      const result = await getDigitalResourceById(99999);

      expect(result).toBeNull();
    });

    it('should handle resources with nullable fields correctly', async () => {
      // Create resource with minimal required fields
      const [resource] = await db.insert(digitalResourcesTable)
        .values({
          course_id: null, // Nullable field
          title: 'Minimal Resource',
          description: null, // Nullable field
          file_url: 'https://example.com/minimal.pdf',
          file_size_bytes: 1024,
          resource_type: 'pdf',
          is_downloadable: true
        })
        .returning()
        .execute();

      const result = await getDigitalResourceById(resource.id);

      expect(result).not.toBeNull();
      expect(result!.course_id).toBeNull();
      expect(result!.description).toBeNull();
      expect(result!.title).toEqual('Minimal Resource');
      expect(result!.file_size_bytes).toEqual(1024);
    });
  });
});