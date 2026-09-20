import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  clientType: z.enum(['web', 'mobile']).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20).optional(),
  clientType: z.enum(['web', 'mobile']).optional(),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(20).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(5, 'New password must be at least 5 characters')
    .max(64, 'New password too long')
    .regex(/\d/, 'New password must contain at least one number'),
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from the current password',
  path: ['newPassword'],
});

export { loginSchema, refreshSchema, logoutSchema, changePasswordSchema };
export default { loginSchema, refreshSchema, logoutSchema, changePasswordSchema };
