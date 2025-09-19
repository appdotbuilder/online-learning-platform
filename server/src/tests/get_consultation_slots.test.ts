import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, consultationSlotsTable } from '../db/schema';
import { 
  getAvailableConsultationSlots, 
  getConsultationSlotsByInstructor, 
  getConsultationSlotsByStudent 
} from '../handlers/get_consultation_slots';

describe('getConsultationSlots handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getAvailableConsultationSlots', () => {
    it('should return only available consultation slots', async () => {
      // Create test instructor
      const instructor = await db.insert(usersTable)
        .values({
          email: 'instructor@test.com',
          password_hash: 'hashed_password',
          first_name: 'John',
          last_name: 'Instructor',
          role: 'instructor'
        })
        .returning()
        .execute();

      // Create available and booked slots
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      await db.insert(consultationSlotsTable)
        .values([
          {
            instructor_id: instructor[0].id,
            start_time: tomorrow,
            end_time: new Date(tomorrow.getTime() + 60 * 60 * 1000), // 1 hour later
            status: 'available'
          },
          {
            instructor_id: instructor[0].id,
            start_time: dayAfter,
            end_time: new Date(dayAfter.getTime() + 60 * 60 * 1000),
            status: 'booked'
          }
        ])
        .execute();

      const result = await getAvailableConsultationSlots();

      expect(result).toHaveLength(1);
      expect(result[0].status).toEqual('available');
      expect(result[0].instructor_id).toEqual(instructor[0].id);
      expect(result[0].start_time).toBeInstanceOf(Date);
      expect(result[0].end_time).toBeInstanceOf(Date);
    });

    it('should filter by instructor when instructorId is provided', async () => {
      // Create test instructors
      const instructor1 = await db.insert(usersTable)
        .values({
          email: 'instructor1@test.com',
          password_hash: 'hashed_password',
          first_name: 'John',
          last_name: 'Instructor1',
          role: 'instructor'
        })
        .returning()
        .execute();

      const instructor2 = await db.insert(usersTable)
        .values({
          email: 'instructor2@test.com',
          password_hash: 'hashed_password',
          first_name: 'Jane',
          last_name: 'Instructor2',
          role: 'instructor'
        })
        .returning()
        .execute();

      // Create slots for both instructors
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await db.insert(consultationSlotsTable)
        .values([
          {
            instructor_id: instructor1[0].id,
            start_time: tomorrow,
            end_time: new Date(tomorrow.getTime() + 60 * 60 * 1000),
            status: 'available'
          },
          {
            instructor_id: instructor2[0].id,
            start_time: tomorrow,
            end_time: new Date(tomorrow.getTime() + 60 * 60 * 1000),
            status: 'available'
          }
        ])
        .execute();

      const result = await getAvailableConsultationSlots(instructor1[0].id);

      expect(result).toHaveLength(1);
      expect(result[0].instructor_id).toEqual(instructor1[0].id);
    });

    it('should return empty array when no available slots exist', async () => {
      const result = await getAvailableConsultationSlots();

      expect(result).toHaveLength(0);
    });
  });

  describe('getConsultationSlotsByInstructor', () => {
    it('should return all slots for a specific instructor', async () => {
      // Create test instructor
      const instructor = await db.insert(usersTable)
        .values({
          email: 'instructor@test.com',
          password_hash: 'hashed_password',
          first_name: 'John',
          last_name: 'Instructor',
          role: 'instructor'
        })
        .returning()
        .execute();

      // Create test student
      const student = await db.insert(usersTable)
        .values({
          email: 'student@test.com',
          password_hash: 'hashed_password',
          first_name: 'Jane',
          last_name: 'Student',
          role: 'student'
        })
        .returning()
        .execute();

      // Create slots with different statuses
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      await db.insert(consultationSlotsTable)
        .values([
          {
            instructor_id: instructor[0].id,
            start_time: tomorrow,
            end_time: new Date(tomorrow.getTime() + 60 * 60 * 1000),
            status: 'available'
          },
          {
            instructor_id: instructor[0].id,
            start_time: dayAfter,
            end_time: new Date(dayAfter.getTime() + 60 * 60 * 1000),
            status: 'booked',
            student_id: student[0].id,
            notes: 'Test consultation'
          }
        ])
        .execute();

      const result = await getConsultationSlotsByInstructor(instructor[0].id);

      expect(result).toHaveLength(2);
      
      // Check both statuses are included
      const statuses = result.map(slot => slot.status);
      expect(statuses).toContain('available');
      expect(statuses).toContain('booked');

      // Verify all slots belong to the instructor
      result.forEach(slot => {
        expect(slot.instructor_id).toEqual(instructor[0].id);
        expect(slot.start_time).toBeInstanceOf(Date);
        expect(slot.end_time).toBeInstanceOf(Date);
      });

      // Check booked slot has student details
      const bookedSlot = result.find(slot => slot.status === 'booked');
      expect(bookedSlot?.student_id).toEqual(student[0].id);
      expect(bookedSlot?.notes).toEqual('Test consultation');
    });

    it('should return empty array when instructor has no slots', async () => {
      // Create test instructor
      const instructor = await db.insert(usersTable)
        .values({
          email: 'instructor@test.com',
          password_hash: 'hashed_password',
          first_name: 'John',
          last_name: 'Instructor',
          role: 'instructor'
        })
        .returning()
        .execute();

      const result = await getConsultationSlotsByInstructor(instructor[0].id);

      expect(result).toHaveLength(0);
    });
  });

  describe('getConsultationSlotsByStudent', () => {
    it('should return only booked slots for a specific student', async () => {
      // Create test users
      const instructor = await db.insert(usersTable)
        .values({
          email: 'instructor@test.com',
          password_hash: 'hashed_password',
          first_name: 'John',
          last_name: 'Instructor',
          role: 'instructor'
        })
        .returning()
        .execute();

      const student = await db.insert(usersTable)
        .values({
          email: 'student@test.com',
          password_hash: 'hashed_password',
          first_name: 'Jane',
          last_name: 'Student',
          role: 'student'
        })
        .returning()
        .execute();

      // Create slots with different statuses and students
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      await db.insert(consultationSlotsTable)
        .values([
          {
            instructor_id: instructor[0].id,
            start_time: tomorrow,
            end_time: new Date(tomorrow.getTime() + 60 * 60 * 1000),
            status: 'booked',
            student_id: student[0].id,
            notes: 'Student consultation'
          },
          {
            instructor_id: instructor[0].id,
            start_time: dayAfter,
            end_time: new Date(dayAfter.getTime() + 60 * 60 * 1000),
            status: 'available'
          }
        ])
        .execute();

      const result = await getConsultationSlotsByStudent(student[0].id);

      expect(result).toHaveLength(1);
      expect(result[0].status).toEqual('booked');
      expect(result[0].student_id).toEqual(student[0].id);
      expect(result[0].notes).toEqual('Student consultation');
      expect(result[0].start_time).toBeInstanceOf(Date);
      expect(result[0].end_time).toBeInstanceOf(Date);
    });

    it('should return empty array when student has no booked slots', async () => {
      // Create test student
      const student = await db.insert(usersTable)
        .values({
          email: 'student@test.com',
          password_hash: 'hashed_password',
          first_name: 'Jane',
          last_name: 'Student',
          role: 'student'
        })
        .returning()
        .execute();

      const result = await getConsultationSlotsByStudent(student[0].id);

      expect(result).toHaveLength(0);
    });

    it('should not return slots booked by other students', async () => {
      // Create test users
      const instructor = await db.insert(usersTable)
        .values({
          email: 'instructor@test.com',
          password_hash: 'hashed_password',
          first_name: 'John',
          last_name: 'Instructor',
          role: 'instructor'
        })
        .returning()
        .execute();

      const student1 = await db.insert(usersTable)
        .values({
          email: 'student1@test.com',
          password_hash: 'hashed_password',
          first_name: 'Jane',
          last_name: 'Student1',
          role: 'student'
        })
        .returning()
        .execute();

      const student2 = await db.insert(usersTable)
        .values({
          email: 'student2@test.com',
          password_hash: 'hashed_password',
          first_name: 'Bob',
          last_name: 'Student2',
          role: 'student'
        })
        .returning()
        .execute();

      // Create slot booked by student2
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await db.insert(consultationSlotsTable)
        .values({
          instructor_id: instructor[0].id,
          start_time: tomorrow,
          end_time: new Date(tomorrow.getTime() + 60 * 60 * 1000),
          status: 'booked',
          student_id: student2[0].id,
          notes: 'Other student consultation'
        })
        .execute();

      const result = await getConsultationSlotsByStudent(student1[0].id);

      expect(result).toHaveLength(0);
    });
  });
});