import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput } from '../schema';
import { loginUser } from '../handlers/login_user';
import { createHash } from 'crypto';

// Test user data
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'student' as const
};

const instructorUser = {
  email: 'instructor@example.com',
  password: 'instructor123',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'instructor' as const
};

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should authenticate user with correct credentials', async () => {
    // Create test user
    const passwordHash = createHash('sha256').update(testUser.password).digest('hex');
    await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: passwordHash,
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        role: testUser.role
      })
      .execute();

    const loginInput: LoginUserInput = {
      email: testUser.email,
      password: testUser.password
    };

    const result = await loginUser(loginInput);

    expect(result).not.toBeNull();
    expect(result!.email).toBe(testUser.email);
    expect(result!.first_name).toBe(testUser.first_name);
    expect(result!.last_name).toBe(testUser.last_name);
    expect(result!.role).toBe(testUser.role);
    expect(result!.id).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.password_hash).toBeDefined();
  });

  it('should authenticate instructor with correct credentials', async () => {
    // Create instructor user
    const passwordHash = createHash('sha256').update(instructorUser.password).digest('hex');
    await db.insert(usersTable)
      .values({
        email: instructorUser.email,
        password_hash: passwordHash,
        first_name: instructorUser.first_name,
        last_name: instructorUser.last_name,
        role: instructorUser.role
      })
      .execute();

    const loginInput: LoginUserInput = {
      email: instructorUser.email,
      password: instructorUser.password
    };

    const result = await loginUser(loginInput);

    expect(result).not.toBeNull();
    expect(result!.email).toBe(instructorUser.email);
    expect(result!.role).toBe('instructor');
    expect(result!.first_name).toBe(instructorUser.first_name);
    expect(result!.last_name).toBe(instructorUser.last_name);
  });

  it('should return null for non-existent user', async () => {
    const loginInput: LoginUserInput = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    const result = await loginUser(loginInput);

    expect(result).toBeNull();
  });

  it('should return null for incorrect password', async () => {
    // Create test user
    const passwordHash = createHash('sha256').update(testUser.password).digest('hex');
    await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: passwordHash,
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        role: testUser.role
      })
      .execute();

    const loginInput: LoginUserInput = {
      email: testUser.email,
      password: 'wrongpassword'
    };

    const result = await loginUser(loginInput);

    expect(result).toBeNull();
  });

  it('should return null for empty password', async () => {
    // Create test user
    const passwordHash = createHash('sha256').update(testUser.password).digest('hex');
    await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: passwordHash,
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        role: testUser.role
      })
      .execute();

    const loginInput: LoginUserInput = {
      email: testUser.email,
      password: ''
    };

    const result = await loginUser(loginInput);

    expect(result).toBeNull();
  });

  it('should handle case-sensitive email matching', async () => {
    // Create test user with lowercase email
    const passwordHash = createHash('sha256').update(testUser.password).digest('hex');
    await db.insert(usersTable)
      .values({
        email: testUser.email.toLowerCase(),
        password_hash: passwordHash,
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        role: testUser.role
      })
      .execute();

    const loginInput: LoginUserInput = {
      email: testUser.email.toUpperCase(),
      password: testUser.password
    };

    const result = await loginUser(loginInput);

    // Should return null because emails don't match exactly
    expect(result).toBeNull();
  });

  it('should return user with all required fields', async () => {
    // Create test user
    const passwordHash = createHash('sha256').update(testUser.password).digest('hex');
    const insertResult = await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: passwordHash,
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        role: testUser.role
      })
      .returning()
      .execute();

    const createdUser = insertResult[0];

    const loginInput: LoginUserInput = {
      email: testUser.email,
      password: testUser.password
    };

    const result = await loginUser(loginInput);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(createdUser.id);
    expect(result!.email).toBe(createdUser.email);
    expect(result!.first_name).toBe(createdUser.first_name);
    expect(result!.last_name).toBe(createdUser.last_name);
    expect(result!.role).toBe(createdUser.role);
    expect(result!.password_hash).toBe(createdUser.password_hash);
    expect(result!.created_at).toEqual(createdUser.created_at);
    expect(result!.updated_at).toEqual(createdUser.updated_at);
  });

  it('should handle multiple users with different credentials', async () => {
    // Create multiple users
    const password1Hash = createHash('sha256').update(testUser.password).digest('hex');
    const password2Hash = createHash('sha256').update(instructorUser.password).digest('hex');

    await db.insert(usersTable)
      .values([
        {
          email: testUser.email,
          password_hash: password1Hash,
          first_name: testUser.first_name,
          last_name: testUser.last_name,
          role: testUser.role
        },
        {
          email: instructorUser.email,
          password_hash: password2Hash,
          first_name: instructorUser.first_name,
          last_name: instructorUser.last_name,
          role: instructorUser.role
        }
      ])
      .execute();

    // Test first user login
    const result1 = await loginUser({
      email: testUser.email,
      password: testUser.password
    });

    expect(result1).not.toBeNull();
    expect(result1!.email).toBe(testUser.email);
    expect(result1!.role).toBe('student');

    // Test second user login
    const result2 = await loginUser({
      email: instructorUser.email,
      password: instructorUser.password
    });

    expect(result2).not.toBeNull();
    expect(result2!.email).toBe(instructorUser.email);
    expect(result2!.role).toBe('instructor');

    // Test cross-credentials (should fail)
    const result3 = await loginUser({
      email: testUser.email,
      password: instructorUser.password
    });

    expect(result3).toBeNull();
  });
});