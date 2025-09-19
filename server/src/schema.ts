import { z } from 'zod';

// User role enum
export const userRoleSchema = z.enum(['student', 'instructor']);
export type UserRole = z.infer<typeof userRoleSchema>;

// User authentication schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// User registration input
export const registerUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: userRoleSchema
});

export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;

// User login input
export const loginUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginUserInput = z.infer<typeof loginUserInputSchema>;

// Course schemas
export const courseStatusSchema = z.enum(['draft', 'published', 'archived']);
export type CourseStatus = z.infer<typeof courseStatusSchema>;

export const courseSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  instructor_id: z.number(),
  status: courseStatusSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Course = z.infer<typeof courseSchema>;

// Course creation input
export const createCourseInputSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  instructor_id: z.number()
});

export type CreateCourseInput = z.infer<typeof createCourseInputSchema>;

// Course update input
export const updateCourseInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: courseStatusSchema.optional()
});

export type UpdateCourseInput = z.infer<typeof updateCourseInputSchema>;

// Lesson schemas
export const lessonTypeSchema = z.enum(['video', 'text', 'document', 'mixed']);
export type LessonType = z.infer<typeof lessonTypeSchema>;

export const lessonSchema = z.object({
  id: z.number(),
  course_id: z.number(),
  title: z.string(),
  content: z.string().nullable(),
  lesson_type: lessonTypeSchema,
  order_index: z.number().int(),
  video_url: z.string().nullable(),
  document_url: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Lesson = z.infer<typeof lessonSchema>;

// Lesson creation input
export const createLessonInputSchema = z.object({
  course_id: z.number(),
  title: z.string().min(1),
  content: z.string().nullable(),
  lesson_type: lessonTypeSchema,
  order_index: z.number().int(),
  video_url: z.string().nullable(),
  document_url: z.string().nullable()
});

export type CreateLessonInput = z.infer<typeof createLessonInputSchema>;

// Enrollment schemas
export const enrollmentStatusSchema = z.enum(['active', 'completed', 'dropped']);
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

export const enrollmentSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  course_id: z.number(),
  status: enrollmentStatusSchema,
  progress_percentage: z.number().min(0).max(100),
  enrolled_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable()
});

export type Enrollment = z.infer<typeof enrollmentSchema>;

// Enrollment creation input
export const createEnrollmentInputSchema = z.object({
  student_id: z.number(),
  course_id: z.number()
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentInputSchema>;

// Test schemas
export const testSchema = z.object({
  id: z.number(),
  course_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  time_limit_minutes: z.number().int().nullable(),
  max_attempts: z.number().int(),
  passing_score: z.number().min(0).max(100),
  is_published: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Test = z.infer<typeof testSchema>;

// Test creation input
export const createTestInputSchema = z.object({
  course_id: z.number(),
  title: z.string().min(1),
  description: z.string().nullable(),
  time_limit_minutes: z.number().int().nullable(),
  max_attempts: z.number().int().positive(),
  passing_score: z.number().min(0).max(100)
});

export type CreateTestInput = z.infer<typeof createTestInputSchema>;

// Question schemas
export const questionTypeSchema = z.enum(['multiple_choice', 'true_false', 'short_answer']);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const questionSchema = z.object({
  id: z.number(),
  test_id: z.number(),
  question_text: z.string(),
  question_type: questionTypeSchema,
  options: z.array(z.string()).nullable(), // JSON array for multiple choice options
  correct_answer: z.string(),
  points: z.number().int().positive(),
  order_index: z.number().int(),
  created_at: z.coerce.date()
});

export type Question = z.infer<typeof questionSchema>;

// Question creation input
export const createQuestionInputSchema = z.object({
  test_id: z.number(),
  question_text: z.string().min(1),
  question_type: questionTypeSchema,
  options: z.array(z.string()).nullable(),
  correct_answer: z.string(),
  points: z.number().int().positive(),
  order_index: z.number().int()
});

export type CreateQuestionInput = z.infer<typeof createQuestionInputSchema>;

// Test attempt schemas
export const testAttemptSchema = z.object({
  id: z.number(),
  test_id: z.number(),
  student_id: z.number(),
  score: z.number().min(0).max(100).nullable(),
  answers: z.record(z.string(), z.string()), // question_id -> answer mapping
  started_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable(),
  is_passed: z.boolean().nullable()
});

export type TestAttempt = z.infer<typeof testAttemptSchema>;

// Test attempt creation input
export const createTestAttemptInputSchema = z.object({
  test_id: z.number(),
  student_id: z.number()
});

export type CreateTestAttemptInput = z.infer<typeof createTestAttemptInputSchema>;

// Submit test attempt input
export const submitTestAttemptInputSchema = z.object({
  attempt_id: z.number(),
  answers: z.record(z.string(), z.string())
});

export type SubmitTestAttemptInput = z.infer<typeof submitTestAttemptInputSchema>;

// Digital resource schemas
export const resourceTypeSchema = z.enum(['pdf', 'document', 'checklist', 'template', 'other']);
export type ResourceType = z.infer<typeof resourceTypeSchema>;

export const digitalResourceSchema = z.object({
  id: z.number(),
  course_id: z.number().nullable(), // Can be course-specific or global
  title: z.string(),
  description: z.string().nullable(),
  file_url: z.string(),
  file_size_bytes: z.number().int(),
  resource_type: resourceTypeSchema,
  is_downloadable: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type DigitalResource = z.infer<typeof digitalResourceSchema>;

// Digital resource creation input
export const createDigitalResourceInputSchema = z.object({
  course_id: z.number().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  file_url: z.string(),
  file_size_bytes: z.number().int().positive(),
  resource_type: resourceTypeSchema,
  is_downloadable: z.boolean().default(true)
});

export type CreateDigitalResourceInput = z.infer<typeof createDigitalResourceInputSchema>;

// Consultation schemas
export const consultationStatusSchema = z.enum(['available', 'booked', 'completed', 'cancelled']);
export type ConsultationStatus = z.infer<typeof consultationStatusSchema>;

export const consultationSlotSchema = z.object({
  id: z.number(),
  instructor_id: z.number(),
  start_time: z.coerce.date(),
  end_time: z.coerce.date(),
  status: consultationStatusSchema,
  student_id: z.number().nullable(),
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ConsultationSlot = z.infer<typeof consultationSlotSchema>;

// Consultation slot creation input
export const createConsultationSlotInputSchema = z.object({
  instructor_id: z.number(),
  start_time: z.coerce.date(),
  end_time: z.coerce.date()
});

export type CreateConsultationSlotInput = z.infer<typeof createConsultationSlotInputSchema>;

// Book consultation input
export const bookConsultationInputSchema = z.object({
  slot_id: z.number(),
  student_id: z.number(),
  notes: z.string().nullable()
});

export type BookConsultationInput = z.infer<typeof bookConsultationInputSchema>;

// Progress tracking schemas
export const lessonProgressSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  lesson_id: z.number(),
  is_completed: z.boolean(),
  completed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type LessonProgress = z.infer<typeof lessonProgressSchema>;

// Mark lesson as completed input
export const markLessonCompleteInputSchema = z.object({
  student_id: z.number(),
  lesson_id: z.number()
});

export type MarkLessonCompleteInput = z.infer<typeof markLessonCompleteInputSchema>;

// Dashboard data schemas
export const studentDashboardSchema = z.object({
  enrolled_courses: z.array(courseSchema),
  recent_progress: z.array(lessonProgressSchema),
  upcoming_consultations: z.array(consultationSlotSchema),
  available_resources: z.array(digitalResourceSchema)
});

export type StudentDashboard = z.infer<typeof studentDashboardSchema>;

export const instructorDashboardSchema = z.object({
  created_courses: z.array(courseSchema),
  upcoming_consultations: z.array(consultationSlotSchema),
  student_progress_overview: z.array(z.object({
    course_id: z.number(),
    course_title: z.string(),
    total_students: z.number(),
    average_progress: z.number()
  }))
});

export type InstructorDashboard = z.infer<typeof instructorDashboardSchema>;