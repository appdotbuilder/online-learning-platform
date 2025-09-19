import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput } from '../schema';
import { registerUser } from '../handlers/register_user';
import { eq } from 'drizzle-orm';

// Test input data
const testStudentInput: RegisterUserInput = {
  email: 'student@test.com',
  password: 'securepassword123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'student'
};

const testInstructorInput: RegisterUserInput = {
  email: 'instructor@test.com',
  password: 'teacherpass456',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'instructor'
};

const testUppercaseEmailInput: RegisterUserInput = {
  email: 'ADMIN@EXAMPLE.COM',
  password: 'adminpass789',
  first_name: 'Admin',
  last_name: 'User',
  role: 'instructor'
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new student user', async () => {
    const result = await registerUser(testStudentInput);

    // Validate returned user data
    expect(result.email).toEqual('student@test.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('student');
    expect(result.id).toBeDefined();
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual(testStudentInput.password);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should register a new instructor user', async () => {
    const result = await registerUser(testInstructorInput);

    // Validate returned user data
    expect(result.email).toEqual('instructor@test.com');
    expect(result.first_name).toEqual('Jane');
    expect(result.last_name).toEqual('Smith');
    expect(result.role).toEqual('instructor');
    expect(result.id).toBeDefined();
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual(testInstructorInput.password);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await registerUser(testStudentInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    expect(savedUser.email).toEqual('student@test.com');
    expect(savedUser.first_name).toEqual('John');
    expect(savedUser.last_name).toEqual('Doe');
    expect(savedUser.role).toEqual('student');
    expect(savedUser.password_hash).toBeDefined();
    expect(savedUser.password_hash).not.toEqual(testStudentInput.password);
    expect(savedUser.created_at).toBeInstanceOf(Date);
    expect(savedUser.updated_at).toBeInstanceOf(Date);
  });

  it('should hash the password properly', async () => {
    const result = await registerUser(testStudentInput);

    // Verify password was hashed
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual(testStudentInput.password);
    expect(result.password_hash.length).toBeGreaterThan(20); // Hashed passwords are typically longer

    // Verify the hashed password can be verified using Bun's password.verify
    const isValid = await Bun.password.verify(testStudentInput.password, result.password_hash);
    expect(isValid).toBe(true);

    // Verify wrong password fails verification
    const isInvalid = await Bun.password.verify('wrongpassword', result.password_hash);
    expect(isInvalid).toBe(false);
  });

  it('should reject duplicate email addresses', async () => {
    // Register first user
    await registerUser(testStudentInput);

    // Try to register another user with same email
    const duplicateInput: RegisterUserInput = {
      ...testStudentInput,
      first_name: 'Different',
      last_name: 'Person'
    };

    await expect(registerUser(duplicateInput)).rejects.toThrow(/already exists/i);
  });

  it('should normalize email to lowercase and reject duplicate case-insensitive emails', async () => {
    // Register first user
    const result1 = await registerUser(testStudentInput);
    
    // Verify email was normalized to lowercase
    expect(result1.email).toEqual('student@test.com');

    // Try to register with different case email - should be rejected
    const differentCaseInput: RegisterUserInput = {
      ...testStudentInput,
      email: 'STUDENT@TEST.COM',
      first_name: 'Different',
      last_name: 'Person'
    };

    await expect(registerUser(differentCaseInput)).rejects.toThrow(/already exists/i);
  });

  it('should normalize uppercase email input to lowercase', async () => {
    const result = await registerUser(testUppercaseEmailInput);

    // Verify email was normalized to lowercase
    expect(result.email).toEqual('admin@example.com');
    expect(result.first_name).toEqual('Admin');
    expect(result.last_name).toEqual('User');
    expect(result.role).toEqual('instructor');
  });

  it('should handle multiple users with different emails', async () => {
    // Register student
    const student = await registerUser(testStudentInput);
    
    // Register instructor  
    const instructor = await registerUser(testInstructorInput);

    // Verify both users exist in database
    const allUsers = await db.select()
      .from(usersTable)
      .execute();

    expect(allUsers).toHaveLength(2);
    
    const userEmails = allUsers.map(u => u.email).sort();
    expect(userEmails).toEqual(['instructor@test.com', 'student@test.com']);
    
    // Verify they have different IDs
    expect(student.id).not.toEqual(instructor.id);
  });

  it('should set timestamps correctly', async () => {
    const beforeRegistration = new Date();
    
    const result = await registerUser(testStudentInput);
    
    const afterRegistration = new Date();

    // Verify timestamps are within reasonable range
    expect(result.created_at >= beforeRegistration).toBe(true);
    expect(result.created_at <= afterRegistration).toBe(true);
    expect(result.updated_at >= beforeRegistration).toBe(true);
    expect(result.updated_at <= afterRegistration).toBe(true);
    
    // For new records, created_at and updated_at should be very close
    const timeDiff = Math.abs(result.updated_at.getTime() - result.created_at.getTime());
    expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
  });
});