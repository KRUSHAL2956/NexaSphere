import { z } from 'zod';

const pushSubscriptionKeys = z.object({
  p256dh: z.string().min(1, 'p256dh key is required'),
  auth: z.string().min(1, 'auth key is required'),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url('endpoint must be a valid URL').max(500),
  expirationTime: z.union([z.null(), z.number()]).optional(),
  keys: pushSubscriptionKeys,
});

export function normalizeSubscription(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid subscription payload');
  }
  const { subscription } = body;
  if (!subscription) {
    throw new Error('Missing subscription field');
  }
  return pushSubscriptionSchema.parse(subscription);
}
