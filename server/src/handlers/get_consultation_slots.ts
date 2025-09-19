import { db } from '../db';
import { consultationSlotsTable } from '../db/schema';
import { type ConsultationSlot } from '../schema';
import { eq, and } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export async function getAvailableConsultationSlots(instructorId?: number): Promise<ConsultationSlot[]> {
  try {
    const conditions: SQL<unknown>[] = [
      eq(consultationSlotsTable.status, 'available')
    ];

    if (instructorId !== undefined) {
      conditions.push(eq(consultationSlotsTable.instructor_id, instructorId));
    }

    const results = await db.select()
      .from(consultationSlotsTable)
      .where(and(...conditions))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch available consultation slots:', error);
    throw error;
  }
}

export async function getConsultationSlotsByInstructor(instructorId: number): Promise<ConsultationSlot[]> {
  try {
    const results = await db.select()
      .from(consultationSlotsTable)
      .where(eq(consultationSlotsTable.instructor_id, instructorId))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch consultation slots for instructor:', error);
    throw error;
  }
}

export async function getConsultationSlotsByStudent(studentId: number): Promise<ConsultationSlot[]> {
  try {
    const results = await db.select()
      .from(consultationSlotsTable)
      .where(
        and(
          eq(consultationSlotsTable.student_id, studentId),
          eq(consultationSlotsTable.status, 'booked')
        )
      )
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch consultation slots for student:', error);
    throw error;
  }
}