const { google } = require('googleapis');
const { z } = require('zod');

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

function normalizePrivateKey(k) {
  return k.includes('\\n') ? k.replace(/\\n/g, '\n') : k;
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const raw = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

const applySchema = z.object({
  fullName: z.string().trim().min(1, 'fullName is required'),
  collegeEmail: z.string().trim().email('Invalid email format').refine(
    (email) => email.toLowerCase().endsWith('@glbajajgroup.org'),
    { message: 'Email must end with @glbajajgroup.org.' }
  ),
  whatsapp: z.string().trim().regex(/^\d{10}$/, 'Invalid contact number (10 digits required).'),
  year: z.string().trim().min(1, 'year is required'),
  branch: z.string().trim().min(1, 'branch is required'),
  section: z.string().trim().min(1, 'section is required'),
  role: z.string().trim().min(1, 'role is required'),
  skills: z.string().trim().min(1, 'skills are required'),
  comms: z.string().trim().min(1, 'comms is required'),
  campusExp: z.string().trim().min(1, 'campusExp is required'),
  campusExpDetails: z.string().trim().optional().default(''),
  links: z.string().trim().optional().default(''),
  commitHours: z.string().trim().min(1, 'commitHours is required'),
  attendCampus: z.string().trim().min(1, 'attendCampus is required'),
  assessmentOk: z.string().trim().min(1, 'assessmentOk is required'),
  whyJoin: z.string().trim().min(1, 'whyJoin is required'),
  anythingElse: z.string().trim().optional().default(''),
  interests: z.array(z.string()).optional(),
  declaration: z.string().trim().optional().default(''),
  declarationAccepted: z.boolean().optional(),
  declarationSelected: z.array(z.string()).optional(),
  submittedAt: z.string().trim().optional().default(''),
  userAgent: z.string().trim().optional().default(''),
}).refine((data) => {
  if (data.declarationAccepted !== undefined) {
    if (!data.declarationAccepted) return false;
    if (Array.isArray(data.declarationSelected) && data.declarationSelected.includes('disagree')) {
      return false;
    }
  } else {
    if (data.declaration === 'I do not agree to the above declaration.') return false;
  }
  return true;
}, {
  message: 'Declaration not accepted.',
  path: ['declaration'],
});

async function appendToSheet(payload) {
  const clientEmail = requiredEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = normalizePrivateKey(requiredEnv('GOOGLE_PRIVATE_KEY'));
  const spreadsheetId = requiredEnv('GOOGLE_SHEET_ID');
  const sheetName = process.env.GOOGLE_SHEET_TAB_NAME || 'Responses';

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const now = new Date().toISOString();
  const interests = Array.isArray(payload.interests) ? payload.interests.join(', ') : '';

  const row = [
    now,
    payload.fullName || '',
    payload.collegeEmail || '',
    payload.whatsapp || '',
    payload.year || '',
    payload.branch || '',
    payload.section || '',
    payload.role || '',
    interests,
    payload.skills || '',
    payload.comms || '',
    payload.campusExp || '',
    payload.campusExpDetails || '',
    payload.links || '',
    payload.commitHours || '',
    payload.attendCampus || '',
    payload.assessmentOk || '',
    payload.whyJoin || '',
    payload.anythingElse || '',
    Array.isArray(payload.declarationSelected)
      ? payload.declarationSelected.join(', ')
      : (payload.declaration || ''),
    payload.submittedAt || '',
    payload.userAgent || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = await readJson(req);

    const result = applySchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.errors;
      const firstError = errors[0];
      let msg = firstError.message;
      if (firstError.code === 'invalid_type' || firstError.code === 'too_small') {
        msg = `Missing required field: ${firstError.path.join('.')}`;
      }
      if (firstError.path.includes('declaration')) {
        msg = 'Declaration not accepted.';
      }
      return res.status(400).json({ error: msg, details: errors });
    }

    const validatedData = result.data;
    await appendToSheet(validatedData);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'Server error' });
  }
};
