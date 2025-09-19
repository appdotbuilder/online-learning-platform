import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  coursesTable, 
  consultationSlotsTable,
  enrollmentsTable 
} from '../db/schema';
import { getInstructorDashboard } from '../handlers/get_instructor_dashboard';

describe('getInstructorDashboard', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty dashboard for instructor with no data', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashed',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    const instructor = instructorResult[0];
    const result = await getInstructorDashboard(instructor.id);

    expect(result.created_courses).toHaveLength(0);
    expect(result.upcoming_consultations).toHaveLength(0);
    expect(result.student_progress_overview).toHaveLength(0);
  });

  it('should return created courses for instructor', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashed',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    const instructor = instructorResult[0];

    // Create courses
    await db.insert(coursesTable)
      .values([
        {
          title: 'Course 1',
          description: 'First course',
          instructor_id: instructor.id,
          status: 'published'
        },
        {
          title: 'Course 2',
          description: 'Second course',
          instructor_id: instructor.id,
          status: 'draft'
        }
      ])
      .execute();

    const result = await getInstructorDashboard(instructor.id);

    expect(result.created_courses).toHaveLength(2);
    expect(result.created_courses[0].title).toEqual('Course 1');
    expect(result.created_courses[0].instructor_id).toEqual(instructor.id);
    expect(result.created_courses[1].title).toEqual('Course 2');
    expect(result.created_courses[1].instructor_id).toEqual(instructor.id);
  });

  it('should return upcoming consultations for instructor', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashed',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    const instructor = instructorResult[0];

    // Create student
    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hashed',
        first_name: 'Jane',
        last_name: 'Student',
        role: 'student'
      })
      .returning()
      .execute();

    const student = studentResult[0];

    // Create consultation slots
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    await db.insert(consultationSlotsTable)
      .values([
        {
          instructor_id: instructor.id,
          start_time: futureDate,
          end_time: new Date(futureDate.getTime() + 60 * 60 * 1000), // +1 hour
          status: 'booked',
          student_id: student.id,
          notes: 'Future consultation'
        },
        {
          instructor_id: instructor.id,
          start_time: pastDate,
          end_time: new Date(pastDate.getTime() + 60 * 60 * 1000),
          status: 'booked',
          student_id: student.id,
          notes: 'Past consultation'
        },
        {
          instructor_id: instructor.id,
          start_time: futureDate,
          end_time: new Date(futureDate.getTime() + 60 * 60 * 1000),
          status: 'available'
        }
      ])
      .execute();

    const result = await getInstructorDashboard(instructor.id);

    // Should only include future, booked consultations
    expect(result.upcoming_consultations).toHaveLength(1);
    expect(result.upcoming_consultations[0].status).toEqual('booked');
    expect(result.upcoming_consultations[0].student_id).toEqual(student.id);
    expect(result.upcoming_consultations[0].notes).toEqual('Future consultation');
    expect(result.upcoming_consultations[0].start_time).toBeInstanceOf(Date);
  });

  it('should return student progress overview for instructor courses', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashed',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    const instructor = instructorResult[0];

    // Create students
    const studentsResult = await db.insert(usersTable)
      .values([
        {
          email: 'student1@test.com',
          password_hash: 'hashed',
          first_name: 'Jane',
          last_name: 'Student1',
          role: 'student'
        },
        {
          email: 'student2@test.com',
          password_hash: 'hashed',
          first_name: 'Bob',
          last_name: 'Student2',
          role: 'student'
        }
      ])
      .returning()
      .execute();

    const students = studentsResult;

    // Create courses
    const coursesResult = await db.insert(coursesTable)
      .values([
        {
          title: 'Math Course',
          description: 'Mathematics course',
          instructor_id: instructor.id,
          status: 'published'
        },
        {
          title: 'Science Course',
          description: 'Science course',
          instructor_id: instructor.id,
          status: 'published'
        }
      ])
      .returning()
      .execute();

    const courses = coursesResult;

    // Create enrollments with different progress
    await db.insert(enrollmentsTable)
      .values([
        {
          student_id: students[0].id,
          course_id: courses[0].id,
          status: 'active',
          progress_percentage: 80
        },
        {
          student_id: students[1].id,
          course_id: courses[0].id,
          status: 'active',
          progress_percentage: 60
        },
        {
          student_id: students[0].id,
          course_id: courses[1].id,
          status: 'active',
          progress_percentage: 100
        }
      ])
      .execute();

    const result = await getInstructorDashboard(instructor.id);

    expect(result.student_progress_overview).toHaveLength(2);
    
    // Find Math Course progress
    const mathProgress = result.student_progress_overview.find(p => p.course_title === 'Math Course');
    expect(mathProgress).toBeDefined();
    expect(mathProgress!.course_id).toEqual(courses[0].id);
    expect(mathProgress!.total_students).toEqual(2);
    expect(mathProgress!.average_progress).toEqual(70); // (80 + 60) / 2

    // Find Science Course progress
    const scienceProgress = result.student_progress_overview.find(p => p.course_title === 'Science Course');
    expect(scienceProgress).toBeDefined();
    expect(scienceProgress!.course_id).toEqual(courses[1].id);
    expect(scienceProgress!.total_students).toEqual(1);
    expect(scienceProgress!.average_progress).toEqual(100);
  });

  it('should handle courses with no enrollments', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashed',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    const instructor = instructorResult[0];

    // Create course without enrollments
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Empty Course',
        description: 'Course with no students',
        instructor_id: instructor.id,
        status: 'published'
      })
      .returning()
      .execute();

    const course = courseResult[0];

    const result = await getInstructorDashboard(instructor.id);

    expect(result.created_courses).toHaveLength(1);
    expect(result.student_progress_overview).toHaveLength(1);
    expect(result.student_progress_overview[0].course_id).toEqual(course.id);
    expect(result.student_progress_overview[0].course_title).toEqual('Empty Course');
    expect(result.student_progress_overview[0].total_students).toEqual(0);
    expect(result.student_progress_overview[0].average_progress).toEqual(0);
  });

  it('should return complete dashboard with all components', async () => {
    // Create instructor
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashed',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();

    const instructor = instructorResult[0];

    // Create student
    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hashed',
        first_name: 'Jane',
        last_name: 'Student',
        role: 'student'
      })
      .returning()
      .execute();

    const student = studentResult[0];

    // Create course
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Complete Course',
        description: 'A complete course',
        instructor_id: instructor.id,
        status: 'published'
      })
      .returning()
      .execute();

    const course = courseResult[0];

    // Create enrollment
    await db.insert(enrollmentsTable)
      .values({
        student_id: student.id,
        course_id: course.id,
        status: 'active',
        progress_percentage: 50
      })
      .execute();

    // Create consultation
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    await db.insert(consultationSlotsTable)
      .values({
        instructor_id: instructor.id,
        start_time: futureDate,
        end_time: new Date(futureDate.getTime() + 60 * 60 * 1000),
        status: 'booked',
        student_id: student.id
      })
      .execute();

    const result = await getInstructorDashboard(instructor.id);

    // Verify all components are present
    expect(result.created_courses).toHaveLength(1);
    expect(result.created_courses[0].title).toEqual('Complete Course');

    expect(result.upcoming_consultations).toHaveLength(1);
    expect(result.upcoming_consultations[0].status).toEqual('booked');

    expect(result.student_progress_overview).toHaveLength(1);
    expect(result.student_progress_overview[0].course_title).toEqual('Complete Course');
    expect(result.student_progress_overview[0].total_students).toEqual(1);
    expect(result.student_progress_overview[0].average_progress).toEqual(50);
  });

  it('should not include other instructors data', async () => {
    // Create two instructors
    const instructor1Result = await db.insert(usersTable)
      .values({
        email: 'instructor1@test.com',
        password_hash: 'hashed',
        first_name: 'John',
        last_name: 'Instructor1',
        role: 'instructor'
      })
      .returning()
      .execute();

    const instructor2Result = await db.insert(usersTable)
      .values({
        email: 'instructor2@test.com',
        password_hash: 'hashed',
        first_name: 'Jane',
        last_name: 'Instructor2',
        role: 'instructor'
      })
      .returning()
      .execute();

    const instructor1 = instructor1Result[0];
    const instructor2 = instructor2Result[0];

    // Create courses for both instructors
    await db.insert(coursesTable)
      .values([
        {
          title: 'Instructor 1 Course',
          description: 'Course by instructor 1',
          instructor_id: instructor1.id,
          status: 'published'
        },
        {
          title: 'Instructor 2 Course',
          description: 'Course by instructor 2',
          instructor_id: instructor2.id,
          status: 'published'
        }
      ])
      .execute();

    const result = await getInstructorDashboard(instructor1.id);

    // Should only return data for instructor1
    expect(result.created_courses).toHaveLength(1);
    expect(result.created_courses[0].title).toEqual('Instructor 1 Course');
    expect(result.created_courses[0].instructor_id).toEqual(instructor1.id);

    expect(result.student_progress_overview).toHaveLength(1);
    expect(result.student_progress_overview[0].course_title).toEqual('Instructor 1 Course');
  });
});