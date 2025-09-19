import { db } from '../db';
import { lessonProgressTable, lessonsTable, enrollmentsTable } from '../db/schema';
import { type MarkLessonCompleteInput, type LessonProgress } from '../schema';
import { eq, and, count } from 'drizzle-orm';

export const markLessonComplete = async (input: MarkLessonCompleteInput): Promise<LessonProgress> => {
  try {
    // Verify lesson exists
    const lessonExists = await db.select({ id: lessonsTable.id })
      .from(lessonsTable)
      .where(eq(lessonsTable.id, input.lesson_id))
      .execute();

    if (lessonExists.length === 0) {
      throw new Error('Lesson not found');
    }

    // Check if lesson progress already exists
    const existingProgress = await db.select()
      .from(lessonProgressTable)
      .where(
        and(
          eq(lessonProgressTable.student_id, input.student_id),
          eq(lessonProgressTable.lesson_id, input.lesson_id)
        )
      )
      .execute();

    let lessonProgress: LessonProgress;

    if (existingProgress.length > 0) {
      // Update existing progress record
      const updateResult = await db.update(lessonProgressTable)
        .set({
          is_completed: true,
          completed_at: new Date()
        })
        .where(
          and(
            eq(lessonProgressTable.student_id, input.student_id),
            eq(lessonProgressTable.lesson_id, input.lesson_id)
          )
        )
        .returning()
        .execute();

      lessonProgress = updateResult[0];
    } else {
      // Create new progress record
      const insertResult = await db.insert(lessonProgressTable)
        .values({
          student_id: input.student_id,
          lesson_id: input.lesson_id,
          is_completed: true,
          completed_at: new Date()
        })
        .returning()
        .execute();

      lessonProgress = insertResult[0];
    }

    // Update course progress percentage
    await updateCourseProgress(input.student_id, input.lesson_id);

    return lessonProgress;
  } catch (error) {
    console.error('Marking lesson complete failed:', error);
    throw error;
  }
};

async function updateCourseProgress(studentId: number, lessonId: number): Promise<void> {
  // Get the course_id for this lesson
  const lesson = await db.select({ course_id: lessonsTable.course_id })
    .from(lessonsTable)
    .where(eq(lessonsTable.id, lessonId))
    .execute();

  if (lesson.length === 0) {
    throw new Error('Lesson not found');
  }

  const courseId = lesson[0].course_id;

  // Count total lessons in the course
  const totalLessonsResult = await db.select({ count: count() })
    .from(lessonsTable)
    .where(eq(lessonsTable.course_id, courseId))
    .execute();

  const totalLessons = totalLessonsResult[0].count;

  // Count completed lessons for this student in this course
  const completedLessonsResult = await db.select({ count: count() })
    .from(lessonProgressTable)
    .innerJoin(lessonsTable, eq(lessonProgressTable.lesson_id, lessonsTable.id))
    .where(
      and(
        eq(lessonProgressTable.student_id, studentId),
        eq(lessonsTable.course_id, courseId),
        eq(lessonProgressTable.is_completed, true)
      )
    )
    .execute();

  const completedLessons = completedLessonsResult[0].count;

  // Calculate progress percentage
  const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  // Update enrollment progress
  await db.update(enrollmentsTable)
    .set({
      progress_percentage: progressPercentage,
      ...(progressPercentage === 100 && { 
        completed_at: new Date(),
        status: 'completed' as const
      })
    })
    .where(
      and(
        eq(enrollmentsTable.student_id, studentId),
        eq(enrollmentsTable.course_id, courseId)
      )
    )
    .execute();
}