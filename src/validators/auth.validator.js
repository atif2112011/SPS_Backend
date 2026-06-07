import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(64, 'New password too long'),
});

export { loginSchema, changePasswordSchema };
export default { loginSchema, changePasswordSchema };
