import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { consultationSlotsTable, usersTable } from '../db/schema';
import { type BookConsultationInput } from '../schema';
import { bookConsultation } from '../handlers/book_consultation';
import { eq } from 'drizzle-orm';

describe('bookConsultation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let instructorId: number;
  let studentId: number;
  let slotId: number;

  beforeEach(async () => {
    // Create instructor
    const instructor = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor'
      })
      .returning()
      .execute();
    instructorId = instructor[0].id;

    // Create student
    const student = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hashedpassword',
        first_name: 'Jane',
        last_name: 'Student',
        role: 'student'
      })
      .returning()
      .execute();
    studentId = student[0].id;

    // Create available consultation slot
    const slot = await db.insert(consultationSlotsTable)
      .values({
        instructor_id: instructorId,
        start_time: new Date('2024-12-20T10:00:00Z'),
        end_time: new Date('2024-12-20T11:00:00Z'),
        status: 'available'
      })
      .returning()
      .execute();
    slotId = slot[0].id;
  });

  const testInput: BookConsultationInput = {
    slot_id: 0, // Will be set in tests
    student_id: 0, // Will be set in tests
    notes: 'Looking forward to discussing my progress'
  };

  it('should book an available consultation slot', async () => {
    const input = {
      ...testInput,
      slot_id: slotId,
      student_id: studentId
    };

    const result = await bookConsultation(input);

    // Verify return values
    expect(result.id).toEqual(slotId);
    expect(result.instructor_id).toEqual(instructorId);
    expect(result.status).toEqual('booked');
    expect(result.student_id).toEqual(studentId);
    expect(result.notes).toEqual('Looking forward to discussing my progress');
    expect(result.start_time).toBeInstanceOf(Date);
    expect(result.end_time).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update slot in database with booking details', async () => {
    const input = {
      ...testInput,
      slot_id: slotId,
      student_id: studentId
    };

    await bookConsultation(input);

    // Query database to verify update
    const slots = await db.select()
      .from(consultationSlotsTable)
      .where(eq(consultationSlotsTable.id, slotId))
      .execute();

    expect(slots).toHaveLength(1);
    const bookedSlot = slots[0];
    expect(bookedSlot.status).toEqual('booked');
    expect(bookedSlot.student_id).toEqual(studentId);
    expect(bookedSlot.notes).toEqual('Looking forward to discussing my progress');
    expect(bookedSlot.updated_at).toBeInstanceOf(Date);
  });

  it('should handle null notes', async () => {
    const input = {
      slot_id: slotId,
      student_id: studentId,
      notes: null
    };

    const result = await bookConsultation(input);

    expect(result.notes).toBeNull();
    expect(result.status).toEqual('booked');
    expect(result.student_id).toEqual(studentId);
  });

  it('should throw error when student does not exist', async () => {
    const input = {
      ...testInput,
      slot_id: slotId,
      student_id: 99999 // Non-existent student
    };

    await expect(bookConsultation(input)).rejects.toThrow(/student not found or invalid role/i);
  });

  it('should throw error when student has instructor role', async () => {
    const input = {
      ...testInput,
      slot_id: slotId,
      student_id: instructorId // Using instructor ID instead of student
    };

    await expect(bookConsultation(input)).rejects.toThrow(/student not found or invalid role/i);
  });

  it('should throw error when consultation slot does not exist', async () => {
    const input = {
      ...testInput,
      slot_id: 99999, // Non-existent slot
      student_id: studentId
    };

    await expect(bookConsultation(input)).rejects.toThrow(/consultation slot not found or not available/i);
  });

  it('should throw error when consultation slot is already booked', async () => {
    // First, book the slot
    const firstInput = {
      ...testInput,
      slot_id: slotId,
      student_id: studentId
    };
    await bookConsultation(firstInput);

    // Create another student
    const anotherStudent = await db.insert(usersTable)
      .values({
        email: 'another@test.com',
        password_hash: 'hashedpassword',
        first_name: 'Another',
        last_name: 'Student',
        role: 'student'
      })
      .returning()
      .execute();

    // Try to book the same slot again
    const secondInput = {
      ...testInput,
      slot_id: slotId,
      student_id: anotherStudent[0].id
    };

    await expect(bookConsultation(secondInput)).rejects.toThrow(/consultation slot not found or not available/i);
  });

  it('should throw error when slot status is not available', async () => {
    // Update slot to completed status
    await db.update(consultationSlotsTable)
      .set({ status: 'completed' })
      .where(eq(consultationSlotsTable.id, slotId))
      .execute();

    const input = {
      ...testInput,
      slot_id: slotId,
      student_id: studentId
    };

    await expect(bookConsultation(input)).rejects.toThrow(/consultation slot not found or not available/i);
  });

  it('should preserve original slot times and instructor', async () => {
    const originalStartTime = new Date('2024-12-20T10:00:00Z');
    const originalEndTime = new Date('2024-12-20T11:00:00Z');

    const input = {
      ...testInput,
      slot_id: slotId,
      student_id: studentId
    };

    const result = await bookConsultation(input);

    expect(result.instructor_id).toEqual(instructorId);
    expect(result.start_time).toEqual(originalStartTime);
    expect(result.end_time).toEqual(originalEndTime);
  });
});