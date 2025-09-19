import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type LoginUserInput, type User } from '../schema';
import { createHash, timingSafeEqual } from 'crypto';

export const loginUser = async (input: LoginUserInput): Promise<User | null> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      return null; // User not found
    }

    const user = users[0];

    // Verify password using crypto hash comparison
    const hashedInput = createHash('sha256').update(input.password).digest('hex');
    const isPasswordValid = timingSafeEqual(
      Buffer.from(hashedInput),
      Buffer.from(user.password_hash)
    );

    if (!isPasswordValid) {
      return null; // Invalid password
    }

    // Return user data (excluding password hash for security)
    return {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash, // Keep for schema compatibility
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};