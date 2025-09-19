import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { consultationSlotsTable, usersTable } from '../db/schema';
import { type CreateConsultationSlotInput } from '../schema';
import { createConsultationSlot } from '../handlers/create_consultation_slot';
import { eq } from 'drizzle-orm';

describe('createConsultationSlot', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create an instructor
  const createInstructor = async () => {
    const result = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Doe',
        role: 'instructor'
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create a student
  const createStudent = async () => {
    const result = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hashed_password',
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'student'
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should create a consultation slot successfully', async () => {
    const instructor = await createInstructor();
    
    const startTime = new Date('2024-01-15T10:00:00Z');
    const endTime = new Date('2024-01-15T11:00:00Z');

    const testInput: CreateConsultationSlotInput = {
      instructor_id: instructor.id,
      start_time: startTime,
      end_time: endTime
    };

    const result = await createConsultationSlot(testInput);

    // Basic field validation
    expect(result.instructor_id).toEqual(instructor.id);
    expect(result.start_time).toEqual(startTime);
    expect(result.end_time).toEqual(endTime);
    expect(result.status).toEqual('available');
    expect(result.student_id).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save consultation slot to database', async () => {
    const instructor = await createInstructor();
    
    const startTime = new Date('2024-01-15T14:00:00Z');
    const endTime = new Date('2024-01-15T15:30:00Z');

    const testInput: CreateConsultationSlotInput = {
      instructor_id: instructor.id,
      start_time: startTime,
      end_time: endTime
    };

    const result = await createConsultationSlot(testInput);

    // Query the database to verify the slot was saved
    const slots = await db.select()
      .from(consultationSlotsTable)
      .where(eq(consultationSlotsTable.id, result.id))
      .execute();

    expect(slots).toHaveLength(1);
    expect(slots[0].instructor_id).toEqual(instructor.id);
    expect(slots[0].start_time).toEqual(startTime);
    expect(slots[0].end_time).toEqual(endTime);
    expect(slots[0].status).toEqual('available');
    expect(slots[0].student_id).toBeNull();
    expect(slots[0].notes).toBeNull();
  });

  it('should throw error when instructor does not exist', async () => {
    const nonExistentInstructorId = 9999;

    const testInput: CreateConsultationSlotInput = {
      instructor_id: nonExistentInstructorId,
      start_time: new Date('2024-01-15T10:00:00Z'),
      end_time: new Date('2024-01-15T11:00:00Z')
    };

    await expect(createConsultationSlot(testInput))
      .rejects
      .toThrow(/instructor.*not found/i);
  });

  it('should throw error when user is not an instructor', async () => {
    const student = await createStudent();

    const testInput: CreateConsultationSlotInput = {
      instructor_id: student.id,
      start_time: new Date('2024-01-15T10:00:00Z'),
      end_time: new Date('2024-01-15T11:00:00Z')
    };

    await expect(createConsultationSlot(testInput))
      .rejects
      .toThrow(/not an instructor/i);
  });

  it('should throw error when start time is after end time', async () => {
    const instructor = await createInstructor();

    const testInput: CreateConsultationSlotInput = {
      instructor_id: instructor.id,
      start_time: new Date('2024-01-15T11:00:00Z'),
      end_time: new Date('2024-01-15T10:00:00Z') // End before start
    };

    await expect(createConsultationSlot(testInput))
      .rejects
      .toThrow(/start time must be before end time/i);
  });

  it('should throw error when start time equals end time', async () => {
    const instructor = await createInstructor();
    
    const sameTime = new Date('2024-01-15T10:00:00Z');

    const testInput: CreateConsultationSlotInput = {
      instructor_id: instructor.id,
      start_time: sameTime,
      end_time: sameTime
    };

    await expect(createConsultationSlot(testInput))
      .rejects
      .toThrow(/start time must be before end time/i);
  });

  it('should handle different time zones correctly', async () => {
    const instructor = await createInstructor();

    const testInput: CreateConsultationSlotInput = {
      instructor_id: instructor.id,
      start_time: new Date('2024-02-20T08:00:00-05:00'), // EST
      end_time: new Date('2024-02-20T09:30:00-05:00')    // EST
    };

    const result = await createConsultationSlot(testInput);

    expect(result.start_time).toEqual(testInput.start_time);
    expect(result.end_time).toEqual(testInput.end_time);

    // Verify in database
    const slots = await db.select()
      .from(consultationSlotsTable)
      .where(eq(consultationSlotsTable.id, result.id))
      .execute();

    expect(slots[0].start_time).toEqual(testInput.start_time);
    expect(slots[0].end_time).toEqual(testInput.end_time);
  });

  it('should allow multiple slots for same instructor', async () => {
    const instructor = await createInstructor();

    const slot1Input: CreateConsultationSlotInput = {
      instructor_id: instructor.id,
      start_time: new Date('2024-01-15T10:00:00Z'),
      end_time: new Date('2024-01-15T11:00:00Z')
    };

    const slot2Input: CreateConsultationSlotInput = {
      instructor_id: instructor.id,
      start_time: new Date('2024-01-15T14:00:00Z'),
      end_time: new Date('2024-01-15T15:00:00Z')
    };

    const result1 = await createConsultationSlot(slot1Input);
    const result2 = await createConsultationSlot(slot2Input);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.instructor_id).toEqual(instructor.id);
    expect(result2.instructor_id).toEqual(instructor.id);

    // Verify both slots exist in database
    const allSlots = await db.select()
      .from(consultationSlotsTable)
      .where(eq(consultationSlotsTable.instructor_id, instructor.id))
      .execute();

    expect(allSlots).toHaveLength(2);
  });
});