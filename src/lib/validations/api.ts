import { z } from 'zod';

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address'),
  bio: z.string().trim().max(500).optional(),
});

export type ProfileUpdatePayload = z.infer<typeof profileUpdateSchema>;

export const coreTeamApplySchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  collegeEmail: z.string().trim().email('Invalid email address').refine(
    (val) => val.endsWith('@glbajajgroup.org'),
    { message: 'Email must end with @glbajajgroup.org' }
  ),
  whatsapp: z.string().trim().regex(/^\d{10}$/, 'Invalid contact number (10 digits required)'),
  year: z.string().trim().min(1, 'Year is required'),
  branch: z.string().trim().min(1, 'Branch is required'),
  section: z.string().trim().min(1, 'Section is required'),
  role: z.string().trim().min(1, 'Role is required'),
  skills: z.string().trim().min(1, 'Skills are required'),
  comms: z.string().trim().min(1, 'Communication preference is required'),
  campusExp: z.string().trim().min(1, 'Campus experience is required'),
  campusExpDetails: z.string().trim().optional(),
  links: z.string().trim().optional(),
  commitHours: z.string().trim().min(1, 'Commitment hours is required'),
  attendCampus: z.string().trim().min(1, 'Campus attendance is required'),
  assessmentOk: z.string().trim().min(1, 'Assessment acceptance is required'),
  whyJoin: z.string().trim().min(1, 'Statement of purpose is required'),
  anythingElse: z.string().trim().optional(),
  declaration: z.string().trim().optional(),
  declarationAccepted: z.boolean().optional(),
  declarationSelected: z.array(z.string()).optional(),
  submittedAt: z.string().trim().optional(),
  userAgent: z.string().trim().optional(),
});

export type CoreTeamApplyPayload = z.infer<typeof coreTeamApplySchema>;
