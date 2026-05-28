const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/[&<>"'`]/g, (character) => HTML_ESCAPE_MAP[character])
    .trim();
}

function sanitizeText(value, max = 4000) {
  return escapeHtml(
    String(value ?? "")
      .trim()
      .slice(0, max)
  );
}

function sanitizeNullableText(value, max = 4000) {
  const text = String(value ?? "")
    .trim()
    .slice(0, max);
  return text ? escapeHtml(text) : null;
}

function sanitizeTextArray(values, max = 40) {
  if (!Array.isArray(values)) {
    return String(values || "")
      .split(",")
      .map((entry) => sanitizeText(entry, max))
      .filter(Boolean)
      .slice(0, 12);
  }

  return values
    .map((entry) => sanitizeText(entry, max))
    .filter(Boolean)
    .slice(0, 12);
}

export function sanitizeEventRecord(event = {}) {
  return {
    ...event,
    name: sanitizeText(event.name, 120),
    shortName: sanitizeText(event.shortName || event.name, 60),
    date: sanitizeText(event.date, 80),
    description: sanitizeText(event.description, 1200),
    icon: sanitizeText(event.icon || "Pin", 32),
    tags: sanitizeTextArray(event.tags, 40),
  };
}

export function sanitizeActivityEventRecord(event = {}) {
  const { createdBy, ...rest } = event;
  return {
    ...rest,
    name: sanitizeText(event.name, 120),
    date: sanitizeText(event.date, 80),
    tagline: sanitizeNullableText(event.tagline, 240),
    description: sanitizeText(event.description, 1200),
  };
}

export function sanitizeCoreTeamMemberRecord(member = {}) {
  return {
    ...member,
    name: sanitizeText(member.name, 100),
    role: sanitizeText(member.role, 100),
    year: sanitizeText(member.year, 20),
    branch: sanitizeText(member.branch, 100),
    section: sanitizeText(member.section, 12),
    email: sanitizeText(member.email, 140),
    whatsapp: sanitizeText(member.whatsapp, 40),
    linkedin: sanitizeNullableText(member.linkedin, 255),
    instagram: sanitizeNullableText(member.instagram, 255),
    photoUrl: sanitizeNullableText(member.photoUrl, 500),
  };
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

// Existing exports unchanged
function toSafeString(value, max = 4000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function validateSection(value) {
  // Section codes are typically short alphanumeric identifiers up to 12 chars
  const cleaned = toSafeString(value, 12);
  // Allow letters, numbers, hyphens, underscores
  return cleaned.replace(/[^a-zA-Z0-9\-_]/g, "");
}

function validateWhatsApp(value) {
  // Normalizes to digits only; can be empty string if not provided
  return normalizePhone(value);
}

export {
  escapeHtml,
  sanitizeNullableText,
  sanitizeText,
  sanitizeTextArray,
  normalizePhone,
  toSafeString,
  validateSection,
  validateWhatsApp,
};
