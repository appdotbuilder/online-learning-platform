import { db } from '../db';
import { digitalResourcesTable } from '../db/schema';
import { type DigitalResource } from '../schema';
import { eq, isNull } from 'drizzle-orm';

export async function getDigitalResourcesByCourse(courseId: number): Promise<DigitalResource[]> {
  try {
    const results = await db.select()
      .from(digitalResourcesTable)
      .where(eq(digitalResourcesTable.course_id, courseId))
      .execute();

    return results.map(resource => ({
      ...resource,
      file_size_bytes: resource.file_size_bytes // Integer column - no conversion needed
    }));
  } catch (error) {
    console.error('Failed to fetch digital resources by course:', error);
    throw error;
  }
}

export async function getGlobalDigitalResources(): Promise<DigitalResource[]> {
  try {
    const results = await db.select()
      .from(digitalResourcesTable)
      .where(isNull(digitalResourcesTable.course_id))
      .execute();

    return results.map(resource => ({
      ...resource,
      file_size_bytes: resource.file_size_bytes // Integer column - no conversion needed
    }));
  } catch (error) {
    console.error('Failed to fetch global digital resources:', error);
    throw error;
  }
}

export async function getDigitalResourceById(resourceId: number): Promise<DigitalResource | null> {
  try {
    const results = await db.select()
      .from(digitalResourcesTable)
      .where(eq(digitalResourcesTable.id, resourceId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const resource = results[0];
    return {
      ...resource,
      file_size_bytes: resource.file_size_bytes // Integer column - no conversion needed
    };
  } catch (error) {
    console.error('Failed to fetch digital resource by ID:', error);
    throw error;
  }
}