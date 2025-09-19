import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import all schemas
import {
  registerUserInputSchema,
  loginUserInputSchema,
  createCourseInputSchema,
  updateCourseInputSchema,
  createLessonInputSchema,
  createEnrollmentInputSchema,
  createTestInputSchema,
  createQuestionInputSchema,
  createTestAttemptInputSchema,
  submitTestAttemptInputSchema,
  createDigitalResourceInputSchema,
  createConsultationSlotInputSchema,
  bookConsultationInputSchema,
  markLessonCompleteInputSchema
} from './schema';

// Import all handlers
import { registerUser } from './handlers/register_user';
import { loginUser } from './handlers/login_user';
import { createCourse } from './handlers/create_course';
import { updateCourse } from './handlers/update_course';
import { getCourses, getCoursesByInstructor, getCourseById } from './handlers/get_courses';
import { createLesson } from './handlers/create_lesson';
import { getLessonsByCourse, getLessonById } from './handlers/get_lessons';
import { createEnrollment } from './handlers/create_enrollment';
import { getEnrollmentsByStudent, getEnrollmentsByCourse, checkEnrollment } from './handlers/get_enrollments';
import { createTest } from './handlers/create_test';
import { getTestsByCourse, getTestById, getPublishedTestsByCourse } from './handlers/get_tests';
import { createQuestion } from './handlers/create_question';
import { getQuestionsByTest } from './handlers/get_questions';
import { createTestAttempt } from './handlers/create_test_attempt';
import { submitTestAttempt } from './handlers/submit_test_attempt';
import { getTestAttemptsByStudent, getTestAttemptById, getTestAttemptsByTest } from './handlers/get_test_attempts';
import { createDigitalResource } from './handlers/create_digital_resource';
import { getDigitalResourcesByCourse, getGlobalDigitalResources, getDigitalResourceById } from './handlers/get_digital_resources';
import { createConsultationSlot } from './handlers/create_consultation_slot';
import { bookConsultation } from './handlers/book_consultation';
import { getAvailableConsultationSlots, getConsultationSlotsByInstructor, getConsultationSlotsByStudent } from './handlers/get_consultation_slots';
import { markLessonComplete } from './handlers/mark_lesson_complete';
import { getLessonProgressByStudent, getLessonProgressByLesson } from './handlers/get_lesson_progress';
import { getStudentDashboard } from './handlers/get_student_dashboard';
import { getInstructorDashboard } from './handlers/get_instructor_dashboard';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User authentication routes
  registerUser: publicProcedure
    .input(registerUserInputSchema)
    .mutation(({ input }) => registerUser(input)),

  loginUser: publicProcedure
    .input(loginUserInputSchema)
    .mutation(({ input }) => loginUser(input)),

  // Course management routes
  createCourse: publicProcedure
    .input(createCourseInputSchema)
    .mutation(({ input }) => createCourse(input)),

  updateCourse: publicProcedure
    .input(updateCourseInputSchema)
    .mutation(({ input }) => updateCourse(input)),

  getCourses: publicProcedure
    .query(() => getCourses()),

  getCoursesByInstructor: publicProcedure
    .input(z.object({ instructorId: z.number() }))
    .query(({ input }) => getCoursesByInstructor(input.instructorId)),

  getCourseById: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(({ input }) => getCourseById(input.courseId)),

  // Lesson management routes
  createLesson: publicProcedure
    .input(createLessonInputSchema)
    .mutation(({ input }) => createLesson(input)),

  getLessonsByCourse: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(({ input }) => getLessonsByCourse(input.courseId)),

  getLessonById: publicProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(({ input }) => getLessonById(input.lessonId)),

  // Enrollment routes
  createEnrollment: publicProcedure
    .input(createEnrollmentInputSchema)
    .mutation(({ input }) => createEnrollment(input)),

  getEnrollmentsByStudent: publicProcedure
    .input(z.object({ studentId: z.number() }))
    .query(({ input }) => getEnrollmentsByStudent(input.studentId)),

  getEnrollmentsByCourse: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(({ input }) => getEnrollmentsByCourse(input.courseId)),

  checkEnrollment: publicProcedure
    .input(z.object({ studentId: z.number(), courseId: z.number() }))
    .query(({ input }) => checkEnrollment(input.studentId, input.courseId)),

  // Test management routes
  createTest: publicProcedure
    .input(createTestInputSchema)
    .mutation(({ input }) => createTest(input)),

  getTestsByCourse: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(({ input }) => getTestsByCourse(input.courseId)),

  getTestById: publicProcedure
    .input(z.object({ testId: z.number() }))
    .query(({ input }) => getTestById(input.testId)),

  getPublishedTestsByCourse: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(({ input }) => getPublishedTestsByCourse(input.courseId)),

  // Question management routes
  createQuestion: publicProcedure
    .input(createQuestionInputSchema)
    .mutation(({ input }) => createQuestion(input)),

  getQuestionsByTest: publicProcedure
    .input(z.object({ testId: z.number() }))
    .query(({ input }) => getQuestionsByTest(input.testId)),

  // Test attempt routes
  createTestAttempt: publicProcedure
    .input(createTestAttemptInputSchema)
    .mutation(({ input }) => createTestAttempt(input)),

  submitTestAttempt: publicProcedure
    .input(submitTestAttemptInputSchema)
    .mutation(({ input }) => submitTestAttempt(input)),

  getTestAttemptsByStudent: publicProcedure
    .input(z.object({ studentId: z.number(), testId: z.number() }))
    .query(({ input }) => getTestAttemptsByStudent(input.studentId, input.testId)),

  getTestAttemptById: publicProcedure
    .input(z.object({ attemptId: z.number() }))
    .query(({ input }) => getTestAttemptById(input.attemptId)),

  getTestAttemptsByTest: publicProcedure
    .input(z.object({ testId: z.number() }))
    .query(({ input }) => getTestAttemptsByTest(input.testId)),

  // Digital resource routes
  createDigitalResource: publicProcedure
    .input(createDigitalResourceInputSchema)
    .mutation(({ input }) => createDigitalResource(input)),

  getDigitalResourcesByCourse: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(({ input }) => getDigitalResourcesByCourse(input.courseId)),

  getGlobalDigitalResources: publicProcedure
    .query(() => getGlobalDigitalResources()),

  getDigitalResourceById: publicProcedure
    .input(z.object({ resourceId: z.number() }))
    .query(({ input }) => getDigitalResourceById(input.resourceId)),

  // Consultation routes
  createConsultationSlot: publicProcedure
    .input(createConsultationSlotInputSchema)
    .mutation(({ input }) => createConsultationSlot(input)),

  bookConsultation: publicProcedure
    .input(bookConsultationInputSchema)
    .mutation(({ input }) => bookConsultation(input)),

  getAvailableConsultationSlots: publicProcedure
    .input(z.object({ instructorId: z.number().optional() }))
    .query(({ input }) => getAvailableConsultationSlots(input.instructorId)),

  getConsultationSlotsByInstructor: publicProcedure
    .input(z.object({ instructorId: z.number() }))
    .query(({ input }) => getConsultationSlotsByInstructor(input.instructorId)),

  getConsultationSlotsByStudent: publicProcedure
    .input(z.object({ studentId: z.number() }))
    .query(({ input }) => getConsultationSlotsByStudent(input.studentId)),

  // Progress tracking routes
  markLessonComplete: publicProcedure
    .input(markLessonCompleteInputSchema)
    .mutation(({ input }) => markLessonComplete(input)),

  getLessonProgressByStudent: publicProcedure
    .input(z.object({ studentId: z.number(), courseId: z.number().optional() }))
    .query(({ input }) => getLessonProgressByStudent(input.studentId, input.courseId)),

  getLessonProgressByLesson: publicProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(({ input }) => getLessonProgressByLesson(input.lessonId)),

  // Dashboard routes
  getStudentDashboard: publicProcedure
    .input(z.object({ studentId: z.number() }))
    .query(({ input }) => getStudentDashboard(input.studentId)),

  getInstructorDashboard: publicProcedure
    .input(z.object({ instructorId: z.number() }))
    .query(({ input }) => getInstructorDashboard(input.instructorId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();