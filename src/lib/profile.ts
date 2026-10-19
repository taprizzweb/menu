/** Contact helpers for the public menu. Pure functions so they can be unit-tested; nothing here talks to a server. */

/** Keeps digits only; a 10-digit Indian mobile number gets the 91 country code. Returns '' when it is not a plausible number. */
export function normalizePhone(input: string): string {
  const d = input.replace(/\D/g, '').replace(/^00/, '');
  const full = d.length === 10 ? `91${d}` : d.length === 11 && d.startsWith('0') ? `91${d.slice(1)}` : d;
  return /^[0-9]{10,15}$/.test(full) ? full : '';
}

/** https://wa.me link with a correctly encoded pre-filled message. Opening it does not prove anything was sent. */
export function whatsappLink(number: string, message?: string): string {
  const q = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${number}${q}`;
}

export const telLink = (number: string): string => `tel:+${number}`;

export function mapsLink(name: string, address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`;
}

/** Instagram profile URL from "@name", "name" or a full link; '' when it cannot be made safe. */
export function normalizeInstagram(input: string): string {
  const v = input.trim();
  if (!v) return '';
  if (/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._/-]+$/.test(v)) return v;
  const handle = v.replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}` : '';
}
