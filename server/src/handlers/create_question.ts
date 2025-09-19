import { db } from '../db';
import { questionsTable, testsTable } from '../db/schema';
import { type CreateQuestionInput, type Question } from '../schema';
import { eq } from 'drizzle-orm';

export async function createQuestion(input: CreateQuestionInput): Promise<Question> {
  try {
    // Verify that the test exists
    const test = await db.select()
      .from(testsTable)
      .where(eq(testsTable.id, input.test_id))
      .limit(1)
      .execute();

    if (test.length === 0) {
      throw new Error(`Test with id ${input.test_id} not found`);
    }

    // Insert question record
    const result = await db.insert(questionsTable)
      .values({
        test_id: input.test_id,
        question_text: input.question_text,
        question_type: input.question_type,
        options: input.options, // JSONB field - can handle null or array directly
        correct_answer: input.correct_answer,
        points: input.points,
        order_index: input.order_index
      })
      .returning()
      .execute();

    const question = result[0];
    return {
      id: question.id,
      test_id: question.test_id,
      question_text: question.question_text,
      question_type: question.question_type,
      options: question.options as string[] | null, // Cast JSONB back to expected type
      correct_answer: question.correct_answer,
      points: question.points,
      order_index: question.order_index,
      created_at: question.created_at
    };
  } catch (error) {
    console.error('Question creation failed:', error);
    throw error;
  }
}