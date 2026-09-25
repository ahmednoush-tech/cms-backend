/**
 * Builds a wa.me link that opens WhatsApp with a pre-filled
 * message — the staff member still taps send themselves. This is
 * NOT an API integration: nothing is sent automatically, and no
 * message history is recorded back into this system. That
 * deliberate limitation is what keeps this 100% within WhatsApp's
 * terms of service for a regular WhatsApp Business app account (no
 * official Business API/Cloud API is connected here).
 *
 * PHONE NORMALIZATION IS A HEURISTIC, NOT A GUARANTEE: this system
 * stores phone numbers as free text with no separate country-code
 * field, so a Saudi local format is assumed by default (see
 * below). A number already given with a country code (with or
 * without a leading +) is used as-is.
 */
export function buildWhatsAppLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;

  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 8) return null; // too short to plausibly be a real phone number

  let normalized: string;
  if (phone.trim().startsWith('+')) {
    normalized = digitsOnly;
  } else if (digitsOnly.startsWith('966')) {
    normalized = digitsOnly;
  } else if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    // Saudi local mobile format (e.g. 0501234567) — the ASSUMED
    // default for this deployment. Strip the leading 0, prepend
    // the Saudi country code 966.
    normalized = `966${digitsOnly.slice(1)}`;
  } else {
    // Already looks like it has some other country code, or an
    // unrecognized shape — pass through digits as-is rather than
    // guess further.
    normalized = digitsOnly;
  }

  const base = `https://wa.me/${normalized}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
