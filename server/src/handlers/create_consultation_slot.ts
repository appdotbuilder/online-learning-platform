import { db } from '../db';
import { consultationSlotsTable, usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type CreateConsultationSlotInput, type ConsultationSlot } from '../schema';

export const createConsultationSlot = async (input: CreateConsultationSlotInput): Promise<ConsultationSlot> => {
  try {
    // Verify that the instructor exists and is actually an instructor
    const instructor = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.instructor_id))
      .execute();

    if (instructor.length === 0) {
      throw new Error(`Instructor with id ${input.instructor_id} not found`);
    }

    if (instructor[0].role !== 'instructor') {
      throw new Error(`User ${input.instructor_id} is not an instructor`);
    }

    // Validate time slot logic
    if (input.start_time >= input.end_time) {
      throw new Error('Start time must be before end time');
    }

    // Insert consultation slot record
    const result = await db.insert(consultationSlotsTable)
      .values({
        instructor_id: input.instructor_id,
        start_time: input.start_time,
        end_time: input.end_time,
        status: 'available' // Default status
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Consultation slot creation failed:', error);
    throw error;
  }
};