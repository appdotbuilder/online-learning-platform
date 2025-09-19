import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  coursesTable, 
  enrollmentsTable, 
  lessonsTable,
  lessonProgressTable, 
  consultationSlotsTable, 
  digitalResourcesTable 
} from '../db/schema';
import { getStudentDashboard } from '../handlers/get_student_dashboard';

describe('getStudentDashboard', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty dashboard for student with no data', async () => {
    // Create a student user
    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hash',
        first_name: 'Student',
        last_name: 'User',
        role: 'student'
      })
      .returning()
      .execute();

    const student = studentResult[0];
    const dashboard = await getStudentDashboard(student.id);

    expect(dashboard.enrolled_courses).toHaveLength(0);
    expect(dashboard.recent_progress).toHaveLength(0);
    expect(dashboard.upcoming_consultations).toHaveLength(0);
    expect(dashboard.available_resources).toHaveLength(0);
  });

  it('should return comprehensive dashboard data for enrolled student', async () => {
    // Create instructor and student users
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hash',
        first_name: 'Instructor',
        last_name: 'User',
        role: 'instructor'
      })
      .returning()
      .execute();

    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hash',
        first_name: 'Student',
        last_name: 'User',
        role: 'student'
      })
      .returning()
      .execute();

    const instructor = instructorResult[0];
    const student = studentResult[0];

    // Create a course
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A test course',
        instructor_id: instructor.id,
        status: 'published'
      })
      .returning()
      .execute();

    const course = courseResult[0];

    // Enroll student in course
    await db.insert(enrollmentsTable)
      .values({
        student_id: student.id,
        course_id: course.id,
        status: 'active',
        progress_percentage: 50.0
      })
      .execute();

    // Create lesson and lesson progress
    const lessonResult = await db.insert(lessonsTable)
      .values({
        course_id: course.id,
        title: 'Test Lesson',
        content: 'Lesson content',
        lesson_type: 'text',
        order_index: 1
      })
      .returning()
      .execute();

    const lesson = lessonResult[0];

    await db.insert(lessonProgressTable)
      .values({
        student_id: student.id,
        lesson_id: lesson.id,
        is_completed: true,
        completed_at: new Date()
      })
      .execute();

    // Create consultation slot
    const consultationTime = new Date();
    consultationTime.setDate(consultationTime.getDate() + 1); // Tomorrow

    await db.insert(consultationSlotsTable)
      .values({
        instructor_id: instructor.id,
        start_time: consultationTime,
        end_time: new Date(consultationTime.getTime() + 60 * 60 * 1000), // 1 hour later
        status: 'booked',
        student_id: student.id,
        notes: 'Test consultation'
      })
      .execute();

    // Create digital resources (global and course-specific)
    await db.insert(digitalResourcesTable)
      .values([
        {
          course_id: null, // Global resource
          title: 'Global Resource',
          description: 'A global resource',
          file_url: 'https://example.com/global.pdf',
          file_size_bytes: 1024,
          resource_type: 'pdf',
          is_downloadable: true
        },
        {
          course_id: course.id, // Course-specific resource
          title: 'Course Resource',
          description: 'A course-specific resource',
          file_url: 'https://example.com/course.pdf',
          file_size_bytes: 2048,
          resource_type: 'document',
          is_downloadable: true
        }
      ])
      .execute();

    const dashboard = await getStudentDashboard(student.id);

    // Verify enrolled courses
    expect(dashboard.enrolled_courses).toHaveLength(1);
    expect(dashboard.enrolled_courses[0].id).toBe(course.id);
    expect(dashboard.enrolled_courses[0].title).toBe('Test Course');
    expect(dashboard.enrolled_courses[0].description).toBe('A test course');
    expect(dashboard.enrolled_courses[0].instructor_id).toBe(instructor.id);
    expect(dashboard.enrolled_courses[0].status).toBe('published');

    // Verify recent progress
    expect(dashboard.recent_progress).toHaveLength(1);
    expect(dashboard.recent_progress[0].student_id).toBe(student.id);
    expect(dashboard.recent_progress[0].lesson_id).toBe(lesson.id);
    expect(dashboard.recent_progress[0].is_completed).toBe(true);
    expect(dashboard.recent_progress[0].completed_at).toBeInstanceOf(Date);

    // Verify upcoming consultations
    expect(dashboard.upcoming_consultations).toHaveLength(1);
    expect(dashboard.upcoming_consultations[0].instructor_id).toBe(instructor.id);
    expect(dashboard.upcoming_consultations[0].student_id).toBe(student.id);
    expect(dashboard.upcoming_consultations[0].status).toBe('booked');
    expect(dashboard.upcoming_consultations[0].notes).toBe('Test consultation');

    // Verify available resources (should include both global and course-specific)
    expect(dashboard.available_resources).toHaveLength(2);
    const resourceTitles = dashboard.available_resources.map(r => r.title);
    expect(resourceTitles).toContain('Global Resource');
    expect(resourceTitles).toContain('Course Resource');
  });

  it('should limit recent progress to 10 items', async () => {
    // Create instructor and student
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hash',
        first_name: 'Instructor',
        last_name: 'User',
        role: 'instructor'
      })
      .returning()
      .execute();

    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hash',
        first_name: 'Student',
        last_name: 'User',
        role: 'student'
      })
      .returning()
      .execute();

    const instructor = instructorResult[0];
    const student = studentResult[0];

    // Create a course
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A test course',
        instructor_id: instructor.id
      })
      .returning()
      .execute();

    const course = courseResult[0];

    // Create 15 lessons
    const lessonInserts = Array.from({ length: 15 }, (_, i) => ({
      course_id: course.id,
      title: `Lesson ${i + 1}`,
      content: `Content for lesson ${i + 1}`,
      lesson_type: 'text' as const,
      order_index: i + 1
    }));

    const lessonResults = await db.insert(lessonsTable)
      .values(lessonInserts)
      .returning()
      .execute();

    // Create progress for all 15 lessons with different completion times
    const progressInserts = lessonResults.map((lesson, i) => {
      const completedAt = new Date();
      completedAt.setMinutes(completedAt.getMinutes() - i); // Different completion times
      return {
        student_id: student.id,
        lesson_id: lesson.id,
        is_completed: true,
        completed_at: completedAt
      };
    });

    await db.insert(lessonProgressTable)
      .values(progressInserts)
      .execute();

    const dashboard = await getStudentDashboard(student.id);

    // Should only return 10 most recent progress records
    expect(dashboard.recent_progress).toHaveLength(10);
  });

  it('should only show global resources for student not enrolled in any courses', async () => {
    // Create student
    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hash',
        first_name: 'Student',
        last_name: 'User',
        role: 'student'
      })
      .returning()
      .execute();

    // Create instructor for course
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hash',
        first_name: 'Instructor',
        last_name: 'User',
        role: 'instructor'
      })
      .returning()
      .execute();

    const student = studentResult[0];
    const instructor = instructorResult[0];

    // Create a course (but don't enroll student)
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A test course',
        instructor_id: instructor.id
      })
      .returning()
      .execute();

    const course = courseResult[0];

    // Create resources
    await db.insert(digitalResourcesTable)
      .values([
        {
          course_id: null, // Global resource
          title: 'Global Resource',
          description: 'A global resource',
          file_url: 'https://example.com/global.pdf',
          file_size_bytes: 1024,
          resource_type: 'pdf',
          is_downloadable: true
        },
        {
          course_id: course.id, // Course-specific resource (student not enrolled)
          title: 'Course Resource',
          description: 'A course-specific resource',
          file_url: 'https://example.com/course.pdf',
          file_size_bytes: 2048,
          resource_type: 'document',
          is_downloadable: true
        }
      ])
      .execute();

    const dashboard = await getStudentDashboard(student.id);

    // Should only show global resources
    expect(dashboard.available_resources).toHaveLength(1);
    expect(dashboard.available_resources[0].title).toBe('Global Resource');
    expect(dashboard.available_resources[0].course_id).toBeNull();
  });

  it('should only show booked consultations for the student', async () => {
    // Create instructor and student
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hash',
        first_name: 'Instructor',
        last_name: 'User',
        role: 'instructor'
      })
      .returning()
      .execute();

    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hash',
        first_name: 'Student',
        last_name: 'User',
        role: 'student'
      })
      .returning()
      .execute();

    const instructor = instructorResult[0];
    const student = studentResult[0];

    const now = new Date();
    const futureTime1 = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const futureTime2 = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

    // Create various consultation slots
    await db.insert(consultationSlotsTable)
      .values([
        {
          instructor_id: instructor.id,
          start_time: futureTime1,
          end_time: new Date(futureTime1.getTime() + 60 * 60 * 1000),
          status: 'available' // Not booked by this student
        },
        {
          instructor_id: instructor.id,
          start_time: futureTime2,
          end_time: new Date(futureTime2.getTime() + 60 * 60 * 1000),
          status: 'booked',
          student_id: student.id, // Booked by this student
          notes: 'Student consultation'
        },
        {
          instructor_id: instructor.id,
          start_time: new Date(now.getTime() + 3 * 60 * 60 * 1000),
          end_time: new Date(now.getTime() + 4 * 60 * 60 * 1000),
          status: 'completed' // Past consultation (wrong status)
        }
      ])
      .execute();

    const dashboard = await getStudentDashboard(student.id);

    // Should only show booked consultations for this student
    expect(dashboard.upcoming_consultations).toHaveLength(1);
    expect(dashboard.upcoming_consultations[0].student_id).toBe(student.id);
    expect(dashboard.upcoming_consultations[0].status).toBe('booked');
    expect(dashboard.upcoming_consultations[0].notes).toBe('Student consultation');
  });
});