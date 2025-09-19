import { db } from '../db';
import { digitalResourcesTable, coursesTable } from '../db/schema';
import { type CreateDigitalResourceInput, type DigitalResource } from '../schema';
import { eq } from 'drizzle-orm';

export const createDigitalResource = async (input: CreateDigitalResourceInput): Promise<DigitalResource> => {
  try {
    // If course_id is provided, verify the course exists
    if (input.course_id !== null) {
      const course = await db.select()
        .from(coursesTable)
        .where(eq(coursesTable.id, input.course_id))
        .execute();

      if (course.length === 0) {
        throw new Error(`Course with id ${input.course_id} not found`);
      }
    }

    // Insert digital resource record
    const result = await db.insert(digitalResourcesTable)
      .values({
        course_id: input.course_id,
        title: input.title,
        description: input.description,
        file_url: input.file_url,
        file_size_bytes: input.file_size_bytes,
        resource_type: input.resource_type,
        is_downloadable: input.is_downloadable
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Digital resource creation failed:', error);
    throw error;
  }
};