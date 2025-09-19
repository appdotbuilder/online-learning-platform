import { db } from '../db';
import { questionsTable } from '../db/schema';
import { type Question } from '../schema';
import { eq, asc } from 'drizzle-orm';

export async function getQuestionsByTest(testId: number): Promise<Question[]> {
  try {
    const results = await db.select()
      .from(questionsTable)
      .where(eq(questionsTable.test_id, testId))
      .orderBy(asc(questionsTable.order_index))
      .execute();

    // Convert the results to match the Question schema
    return results.map(question => ({
      ...question,
      // Parse JSON options field if it exists
      options: question.options as string[] | null
    }));
  } catch (error) {
    console.error('Failed to get questions by test:', error);
    throw error;
  }
}