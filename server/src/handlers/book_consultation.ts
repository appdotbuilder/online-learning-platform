import { db } from '../db';
import { consultationSlotsTable, usersTable } from '../db/schema';
import { type BookConsultationInput, type ConsultationSlot } from '../schema';
import { eq, and } from 'drizzle-orm';

export const bookConsultation = async (input: BookConsultationInput): Promise<ConsultationSlot> => {
  try {
    // Verify the student exists and has student role
    const student = await db.select()
      .from(usersTable)
      .where(and(
        eq(usersTable.id, input.student_id),
        eq(usersTable.role, 'student')
      ))
      .execute();

    if (student.length === 0) {
      throw new Error('Student not found or invalid role');
    }

    // Verify the consultation slot exists and is available
    const slot = await db.select()
      .from(consultationSlotsTable)
      .where(and(
        eq(consultationSlotsTable.id, input.slot_id),
        eq(consultationSlotsTable.status, 'available')
      ))
      .execute();

    if (slot.length === 0) {
      throw new Error('Consultation slot not found or not available');
    }

    // Update the slot to booked status with student assignment
    const result = await db.update(consultationSlotsTable)
      .set({
        status: 'booked',
        student_id: input.student_id,
        notes: input.notes,
        updated_at: new Date()
      })
      .where(eq(consultationSlotsTable.id, input.slot_id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Consultation booking failed:', error);
    throw error;
  }
};