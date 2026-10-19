import { describe, expect, it } from 'vitest';
import { mapsLink, normalizeInstagram, normalizePhone, telLink, whatsappLink } from '@/lib/profile';
import { profileSave } from '@/lib/schemas/dash';

describe('contact helpers', () => {
  it('normalises phone numbers to digits with the India code', () => {
    expect(normalizePhone('98765 43210')).toBe('919876543210');
    expect(normalizePhone('+91 98765-43210')).toBe('919876543210');
    expect(normalizePhone('09876543210')).toBe('919876543210');
    expect(normalizePhone('+1 (415) 555-0100')).toBe('14155550100');
    expect(normalizePhone('12345')).toBe('');
    expect(normalizePhone('abc')).toBe('');
  });
  it('builds correctly encoded WhatsApp, tel and maps links', () => {
    expect(whatsappLink('919876543210', 'Hello Café & Bar, is "this" open?')).toBe('https://wa.me/919876543210?text=Hello%20Caf%C3%A9%20%26%20Bar%2C%20is%20%22this%22%20open%3F');
    expect(whatsappLink('919876543210')).toBe('https://wa.me/919876543210');
    expect(telLink('919876543210')).toBe('tel:+919876543210');
    expect(mapsLink('Tattoo Cafe', 'MI Road, Jaipur')).toBe('https://www.google.com/maps/search/?api=1&query=Tattoo%20Cafe%20MI%20Road%2C%20Jaipur');
  });
  it('accepts only real Instagram profiles', () => {
    expect(normalizeInstagram('@tattoo.cafe')).toBe('https://www.instagram.com/tattoo.cafe');
    expect(normalizeInstagram('https://www.instagram.com/tattoo.cafe/')).toBe('https://www.instagram.com/tattoo.cafe/');
    expect(normalizeInstagram('https://evil.example/instagram.com/x')).toBe('');
    expect(normalizeInstagram('javascript:alert(1)')).toBe('');
    expect(normalizeInstagram('')).toBe('');
  });
});

describe('profile schema', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  it('cleans numbers and refuses bad input', () => {
    const ok = profileSave.parse({ tagline: ' Best chai ', phone: '98765 43210', whatsapp: '', instagram_url: '@x', logo_path: `${uuid}/${uuid}.webp` });
    expect(ok).toMatchObject({ tagline: 'Best chai', phone: '919876543210', whatsapp: '', instagram_url: 'https://www.instagram.com/x', banner_path: '' });
    expect(profileSave.safeParse({ phone: '123' }).success).toBe(false);
    expect(profileSave.safeParse({ logo_path: '../../etc/passwd' }).success).toBe(false);
    expect(profileSave.safeParse({ instagram_url: 'https://evil.example' }).success).toBe(false);
    expect(profileSave.safeParse({ unknown: 'x' }).success).toBe(false);
  });
});
