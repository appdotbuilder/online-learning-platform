import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  integer, 
  boolean,
  real,
  pgEnum,
  jsonb
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['student', 'instructor']);
export const courseStatusEnum = pgEnum('course_status', ['draft', 'published', 'archived']);
export const lessonTypeEnum = pgEnum('lesson_type', ['video', 'text', 'document', 'mixed']);
export const enrollmentStatusEnum = pgEnum('enrollment_status', ['active', 'completed', 'dropped']);
export const questionTypeEnum = pgEnum('question_type', ['multiple_choice', 'true_false', 'short_answer']);
export const resourceTypeEnum = pgEnum('resource_type', ['pdf', 'document', 'checklist', 'template', 'other']);
export const consultationStatusEnum = pgEnum('consultation_status', ['available', 'booked', 'completed', 'cancelled']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Courses table
export const coursesTable = pgTable('courses', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  instructor_id: integer('instructor_id').notNull().references(() => usersTable.id),
  status: courseStatusEnum('status').notNull().default('draft'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Lessons table
export const lessonsTable = pgTable('lessons', {
  id: serial('id').primaryKey(),
  course_id: integer('course_id').notNull().references(() => coursesTable.id),
  title: text('title').notNull(),
  content: text('content'), // Nullable
  lesson_type: lessonTypeEnum('lesson_type').notNull(),
  order_index: integer('order_index').notNull(),
  video_url: text('video_url'), // Nullable
  document_url: text('document_url'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Enrollments table
export const enrollmentsTable = pgTable('enrollments', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull().references(() => usersTable.id),
  course_id: integer('course_id').notNull().references(() => coursesTable.id),
  status: enrollmentStatusEnum('status').notNull().default('active'),
  progress_percentage: real('progress_percentage').notNull().default(0),
  enrolled_at: timestamp('enrolled_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'), // Nullable
});

// Tests table
export const testsTable = pgTable('tests', {
  id: serial('id').primaryKey(),
  course_id: integer('course_id').notNull().references(() => coursesTable.id),
  title: text('title').notNull(),
  description: text('description'), // Nullable
  time_limit_minutes: integer('time_limit_minutes'), // Nullable
  max_attempts: integer('max_attempts').notNull().default(3),
  passing_score: real('passing_score').notNull().default(70),
  is_published: boolean('is_published').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Questions table
export const questionsTable = pgTable('questions', {
  id: serial('id').primaryKey(),
  test_id: integer('test_id').notNull().references(() => testsTable.id),
  question_text: text('question_text').notNull(),
  question_type: questionTypeEnum('question_type').notNull(),
  options: jsonb('options'), // Nullable - JSON array for multiple choice options
  correct_answer: text('correct_answer').notNull(),
  points: integer('points').notNull().default(1),
  order_index: integer('order_index').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Test attempts table
export const testAttemptsTable = pgTable('test_attempts', {
  id: serial('id').primaryKey(),
  test_id: integer('test_id').notNull().references(() => testsTable.id),
  student_id: integer('student_id').notNull().references(() => usersTable.id),
  score: real('score'), // Nullable until completed
  answers: jsonb('answers').notNull(), // JSON object: question_id -> answer mapping
  started_at: timestamp('started_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'), // Nullable
  is_passed: boolean('is_passed'), // Nullable until graded
});

// Digital resources table
export const digitalResourcesTable = pgTable('digital_resources', {
  id: serial('id').primaryKey(),
  course_id: integer('course_id').references(() => coursesTable.id), // Nullable - can be global
  title: text('title').notNull(),
  description: text('description'), // Nullable
  file_url: text('file_url').notNull(),
  file_size_bytes: integer('file_size_bytes').notNull(),
  resource_type: resourceTypeEnum('resource_type').notNull(),
  is_downloadable: boolean('is_downloadable').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Consultation slots table
export const consultationSlotsTable = pgTable('consultation_slots', {
  id: serial('id').primaryKey(),
  instructor_id: integer('instructor_id').notNull().references(() => usersTable.id),
  start_time: timestamp('start_time').notNull(),
  end_time: timestamp('end_time').notNull(),
  status: consultationStatusEnum('status').notNull().default('available'),
  student_id: integer('student_id').references(() => usersTable.id), // Nullable
  notes: text('notes'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Lesson progress table
export const lessonProgressTable = pgTable('lesson_progress', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull().references(() => usersTable.id),
  lesson_id: integer('lesson_id').notNull().references(() => lessonsTable.id),
  is_completed: boolean('is_completed').notNull().default(false),
  completed_at: timestamp('completed_at'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  instructedCourses: many(coursesTable),
  enrollments: many(enrollmentsTable),
  testAttempts: many(testAttemptsTable),
  consultationSlots: many(consultationSlotsTable),
  lessonProgress: many(lessonProgressTable),
}));

export const coursesRelations = relations(coursesTable, ({ one, many }) => ({
  instructor: one(usersTable, {
    fields: [coursesTable.instructor_id],
    references: [usersTable.id],
  }),
  lessons: many(lessonsTable),
  enrollments: many(enrollmentsTable),
  tests: many(testsTable),
  digitalResources: many(digitalResourcesTable),
}));

export const lessonsRelations = relations(lessonsTable, ({ one, many }) => ({
  course: one(coursesTable, {
    fields: [lessonsTable.course_id],
    references: [coursesTable.id],
  }),
  progress: many(lessonProgressTable),
}));

export const enrollmentsRelations = relations(enrollmentsTable, ({ one }) => ({
  student: one(usersTable, {
    fields: [enrollmentsTable.student_id],
    references: [usersTable.id],
  }),
  course: one(coursesTable, {
    fields: [enrollmentsTable.course_id],
    references: [coursesTable.id],
  }),
}));

export const testsRelations = relations(testsTable, ({ one, many }) => ({
  course: one(coursesTable, {
    fields: [testsTable.course_id],
    references: [coursesTable.id],
  }),
  questions: many(questionsTable),
  attempts: many(testAttemptsTable),
}));

export const questionsRelations = relations(questionsTable, ({ one }) => ({
  test: one(testsTable, {
    fields: [questionsTable.test_id],
    references: [testsTable.id],
  }),
}));

export const testAttemptsRelations = relations(testAttemptsTable, ({ one }) => ({
  test: one(testsTable, {
    fields: [testAttemptsTable.test_id],
    references: [testsTable.id],
  }),
  student: one(usersTable, {
    fields: [testAttemptsTable.student_id],
    references: [usersTable.id],
  }),
}));

export const digitalResourcesRelations = relations(digitalResourcesTable, ({ one }) => ({
  course: one(coursesTable, {
    fields: [digitalResourcesTable.course_id],
    references: [coursesTable.id],
  }),
}));

export const consultationSlotsRelations = relations(consultationSlotsTable, ({ one }) => ({
  instructor: one(usersTable, {
    fields: [consultationSlotsTable.instructor_id],
    references: [usersTable.id],
  }),
  student: one(usersTable, {
    fields: [consultationSlotsTable.student_id],
    references: [usersTable.id],
  }),
}));

export const lessonProgressRelations = relations(lessonProgressTable, ({ one }) => ({
  student: one(usersTable, {
    fields: [lessonProgressTable.student_id],
    references: [usersTable.id],
  }),
  lesson: one(lessonsTable, {
    fields: [lessonProgressTable.lesson_id],
    references: [lessonsTable.id],
  }),
}));

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  courses: coursesTable,
  lessons: lessonsTable,
  enrollments: enrollmentsTable,
  tests: testsTable,
  questions: questionsTable,
  testAttempts: testAttemptsTable,
  digitalResources: digitalResourcesTable,
  consultationSlots: consultationSlotsTable,
  lessonProgress: lessonProgressTable,
};

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Course = typeof coursesTable.$inferSelect;
export type NewCourse = typeof coursesTable.$inferInsert;

export type Lesson = typeof lessonsTable.$inferSelect;
export type NewLesson = typeof lessonsTable.$inferInsert;

export type Enrollment = typeof enrollmentsTable.$inferSelect;
export type NewEnrollment = typeof enrollmentsTable.$inferInsert;

export type Test = typeof testsTable.$inferSelect;
export type NewTest = typeof testsTable.$inferInsert;

export type Question = typeof questionsTable.$inferSelect;
export type NewQuestion = typeof questionsTable.$inferInsert;

export type TestAttempt = typeof testAttemptsTable.$inferSelect;
export type NewTestAttempt = typeof testAttemptsTable.$inferInsert;

export type DigitalResource = typeof digitalResourcesTable.$inferSelect;
export type NewDigitalResource = typeof digitalResourcesTable.$inferInsert;

export type ConsultationSlot = typeof consultationSlotsTable.$inferSelect;
export type NewConsultationSlot = typeof consultationSlotsTable.$inferInsert;

export type LessonProgress = typeof lessonProgressTable.$inferSelect;
export type NewLessonProgress = typeof lessonProgressTable.$inferInsert;