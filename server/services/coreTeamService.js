import { supabaseRequest, HAS_SUPABASE } from '../storage/supabaseClient.js';
import { readContent, writeContent } from '../storage/contentFileStore.js';
import { sanitizeCoreTeamMemberRecord } from '../utils/sanitize.js';
import crypto from 'crypto';

export const coreTeamService = {
  async listMembers() {
    if (HAS_SUPABASE) {
      const rows = await supabaseRequest('core_team_members?select=*&order=created_at.asc');
      return rows.map(r => sanitizeCoreTeamMemberRecord({
        id: r.id, name: r.name, role: r.role, year: r.year,
        branch: r.branch, section: r.section, email: r.email,
        whatsapp: r.whatsapp, linkedin: r.linkedin, instagram: r.instagram,
        photoUrl: r.photo_url, createdAt: r.created_at
      }));
    }
    const content = await readContent();
    return (content.coreTeam || []).map((m) => sanitizeCoreTeamMemberRecord(m));
  },

  async addMember(member) {
    if (HAS_SUPABASE) {
      const [row] = await supabaseRequest('core_team_members', {
        method: 'POST',
        body: [{
          name: member.name, role: member.role, year: member.year,
          branch: member.branch, section: member.section, email: member.email,
          whatsapp: member.whatsapp, linkedin: member.linkedin, instagram: member.instagram, photo_url: member.photoUrl
        }],
      });
      return sanitizeCoreTeamMemberRecord({
        id: row.id, name: row.name, role: row.role, year: row.year,
        branch: row.branch, section: row.section, email: row.email,
        whatsapp: row.whatsapp, linkedin: row.linkedin, instagram: row.instagram,
        photoUrl: row.photo_url, createdAt: row.created_at
      });
    }

    const content = await readContent();
    content.coreTeam = content.coreTeam || [];
    const newMember = { ...member, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    content.coreTeam.push(newMember);
    await writeContent(content);
    return sanitizeCoreTeamMemberRecord(newMember);
  },

  async deleteMember(id) {
    if (HAS_SUPABASE) {
      const rows = await supabaseRequest(`core_team_members?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return Array.isArray(rows) && rows.length > 0;
    }
    const content = await readContent();
    content.coreTeam = content.coreTeam || [];
    const before = content.coreTeam.length;
    content.coreTeam = content.coreTeam.filter(m => String(m.id) !== String(id));
    if (content.coreTeam.length === before) return false;
    await writeContent(content);
    return true;
  },
};
import { coreTeamRepository } from '../repositories/coreTeamRepository.js';
import { manageActivityGateSchema } from '../validators/coreTeamSchemas.js';

const fallbackMembers = [
  { name: 'Ayush Sharma', email: 'ayush.sharmaa@hotmail.com', phone: '8923995135' },
  { name: 'Tanishk Bansal', email: 'tb1093612@gmail.com', phone: '8534998412' },
  { name: 'Tushar Goswami', email: 'tushh45@gmail.com', phone: '7253948594' },
  { name: 'Swayam Dwivedi', email: 'swayamdwivedi88@gmail.com', phone: '7307391343' },
  { name: 'Aryan Singh', email: 'aryan.singh2025@glbajajgroup.org', phone: '8423067765' },
  { name: 'Vartika Sharma', email: 'vartika.sharma2025@glbajajgroup.org', phone: '9458030331' },
  { name: 'Vikas Kumar Sharma', email: 'vks184953@gmail.com', phone: '7983419487' },
];

function normalizePhone(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

export const coreTeamService = {
  async listMembers() {
    return coreTeamRepository.listMembers();
  },

  async addMember(input) {
    const member = manageActivityGateSchema.parse({
      ...input,
      // repurpose schema fields: name/email/phone are validated there
      password: undefined,
    });
    return coreTeamRepository.addMember(member);
  },

  async deleteMember(id) {
    return coreTeamRepository.deleteMember(id);
  },

  async assertCanManageActivityEvent(body) {
    const gate = manageActivityGateSchema.parse(body);
    const expectedPassword = process.env.ADMIN_EVENT_PASSWORD || 'Admin@123';
    if (String(gate.password || '') !== expectedPassword) {
      throw new Error('Unauthorized. Core team details or password did not match.');
    }

    const name = String(gate.name || '').trim().toLowerCase();
    const email = String(gate.email || '').trim().toLowerCase();
    const phone = normalizePhone(gate.phone);

    // Prefer DB if configured; fallback to hardcoded list.
    const dbAllowed = await coreTeamRepository.isMember({ name, email, phone }).catch(() => false);
    if (dbAllowed) return true;

    const allowed = fallbackMembers.some((m) =>
      m.name.toLowerCase() === name &&
      m.email.toLowerCase() === email &&
      normalizePhone(m.phone) === phone
    );

    if (!allowed) throw new Error('Unauthorized. Core team details or password did not match.');
    return true;
  },
};

