import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// @axe-core/playwright ships its own copy of Playwright's types; the runtime object is the same.
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]['page'];
import { newTable, ordersOf, q, sessionOf, staff } from './helpers';

const SHOTS = 'test-results/shots';
const KITCHEN = 'kitchen@spice-garden.demo';
const WAITER = 'waiter@spice-garden.demo';
const OWNER = 'owner@spice-garden.demo';

async function open(page: Page, t: { slug: string; token: string }) {
  await page.goto(`/${t.slug}?k=${t.token}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}
const card = (page: Page, name: string) => page.locator('li', { has: page.getByRole('heading', { name, level: 3 }) });
const add = (page: Page, name: string) => page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
const more = (page: Page, name: string) => page.getByRole('button', { name: `Add one more ${name}` }).click();
const dialog = (page: Page) => page.getByRole('dialog');
// each sheet has a header (X) and a footer Close button; both do the same thing
const closeSheet = (page: Page) => dialog(page).getByRole('button', { name: 'Close', exact: true }).last().click();
const alertWith = (page: Page, text: string) => page.getByRole('alert').filter({ hasText: text });

async function placeOrderFromCart(page: Page) {
  await page.getByRole('button', { name: /View cart/ }).click();
  await dialog(page).getByRole('button', { name: 'Place order' }).click();
}

test.describe('guest journey', () => {
  test('scan → order → live status → call waiter → ask bill → paid → thank-you → review', async ({ page, context }, info) => {
    const t = await newTable();
    await open(page, t);
    await expect(page.getByText(`Table ${t.label}`)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-1-menu.png` });

    // sold-out dishes are greyed and cannot be added
    const sold = card(page, 'Chana Masala');
    await expect(sold).toContainText('Sold out');
    await expect(sold.getByRole('button')).toHaveCount(0);

    await add(page, 'Paneer Tikka');
    await more(page, 'Paneer Tikka');
    await add(page, 'Sweet Lassi');
    await expect(page.getByRole('button', { name: /View cart/ })).toContainText('₹650');

    await page.getByRole('button', { name: /View cart/ }).click();
    await dialog(page).getByLabel('Note for the kitchen').fill('Less spicy please');
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-2-cart.png` });
    await dialog(page).getByRole('button', { name: 'Place order' }).click();

    // status screen: not accepted yet
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
    await expect(page.getByText('Waiting for the team to accept')).toBeVisible();
    await expect(page.getByText('2 ×')).toBeVisible();
    const orders = await ordersOf(t.id);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ total_paise: 65000, note: 'Less spicy please', status: 'placed' });
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-3-status-placed.png` });

    // staff accept → the guest's screen follows (polled every 4 s)
    const id = orders[0]!.id;
    await staff(KITCHEN, 'staff_set_order_status', { p_order_id: id, p_new: 'preparing' });
    await expect(page.locator('[aria-current="step"]')).toContainText('Preparing');
    await expect(page.getByText('Waiting for the team to accept')).toHaveCount(0);
    await staff(KITCHEN, 'staff_set_order_status', { p_order_id: id, p_new: 'ready' });
    await expect(page.locator('[aria-current="step"]')).toContainText('Ready');
    await staff(WAITER, 'staff_set_order_status', { p_order_id: id, p_new: 'served' });
    await expect(page.locator('[aria-current="step"]')).toContainText('Served');
    await expect(page.getByText('Table total').locator('..')).toContainText('₹650');
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-4-status-served.png` });

    // call waiter
    await page.getByRole('button', { name: 'Call waiter' }).click();
    await dialog(page).getByRole('button', { name: 'Water' }).click();
    await expect(dialog(page)).toContainText('Waiter is on the way');
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-5-waiter.png` });
    await closeSheet(page);
    const reqs = await q<{ type: string; reason: string; status: string }>(`select type, reason, status from public.service_requests where table_id = $1`, [t.id]);
    expect(reqs).toEqual([{ type: 'waiter', reason: 'water', status: 'open' }]);

    // ask for the bill, then change the payment method while it is open
    await page.getByRole('button', { name: 'Ask for bill' }).click();
    await dialog(page).getByRole('button', { name: 'UPI' }).click();
    await expect(dialog(page)).toContainText('The bill is on its way');
    await expect(dialog(page)).toContainText('Paying by UPI');
    await dialog(page).getByRole('button', { name: 'Change payment method' }).click();
    await dialog(page).getByRole('button', { name: 'Card' }).click();
    await expect(dialog(page)).toContainText('Paying by Card', { timeout: 1500 }); // shown at once, not after the next 4-5 s refresh
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-6-bill.png` });
    await closeSheet(page);
    const bill = await q<{ pay_mode: string; n: number }>(`select pay_mode, count(*) over ()::int n from public.service_requests where table_id = $1 and type = 'bill' and status = 'open'`, [t.id]);
    expect(bill).toEqual([{ pay_mode: 'card', n: 1 }]);
    await expect(page.getByText('Waiter is on the way · The bill is on its way')).toBeVisible();

    // staff mark the table paid → thank-you with total and the review button
    const sid = (await sessionOf(t.id))!;
    await staff(WAITER, 'staff_close_session', { p_session_id: sid, p_force: false });
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
    await expect(page.getByText('Total: ₹650')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-7-thanks.png` });

    const rate = page.getByRole('link', { name: 'Rate us on Google' });
    await expect(rate).toHaveAttribute('href', '/api/guest/review');
    // opens in a new tab, without giving the review site access to our page
    await expect(rate).toHaveAttribute('target', '_blank');
    await expect(rate).toHaveAttribute('rel', /noopener/);
    // The sandbox has no internet, so follow the redirect by hand: the server must answer 302 to the review link.
    const res = await context.request.get('/api/guest/review', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toMatch(/^https:\/\/search\.google\.com\/local\/writereview\?placeid=/);
    const clicks = await q<{ n: number }>(`select count(*)::int n from public.review_clicks where session_id = $1`, [sid]);
    expect(clicks[0]!.n).toBe(1);
  });

  test('the guest can reorder after paying: a new scan starts a fresh table session', async ({ page }) => {
    const t = await newTable();
    await open(page, t);
    await add(page, 'Masala Chai');
    await placeOrderFromCart(page);
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
    const sid = (await sessionOf(t.id))!;
    await staff(OWNER, 'staff_close_session', { p_session_id: sid, p_force: true, p_reason: 'e2e' });
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to menu' }).click();
    await add(page, 'Masala Chai');
    await placeOrderFromCart(page);
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
    await expect(page.getByText('Thank you!')).toHaveCount(0);
    expect(await sessionOf(t.id)).not.toBe(sid);
  });
});

test.describe('menu behaviour', () => {
  test('cart survives a refresh; search and filters work; categories scroll', async ({ page }) => {
    const t = await newTable();
    await open(page, t);
    await add(page, 'Butter Naan');
    await page.reload();
    await expect(page.getByRole('button', { name: /View cart/ })).toContainText('₹60');

    await page.getByLabel('Search the menu').fill('biryani');
    await expect(card(page, 'Veg Biryani')).toBeVisible();
    await expect(card(page, 'Chicken Biryani')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Paneer Tikka', level: 3 })).toHaveCount(0);
    await page.getByLabel('Search the menu').fill('');

    await page.getByRole('button', { name: 'Veg', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Chicken Tikka', level: 3 })).toHaveCount(0);
    await expect(card(page, 'Jain Dal Tadka')).toBeVisible(); // Jain is vegetarian
    await page.getByRole('button', { name: 'Jain', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Paneer Tikka', level: 3 })).toHaveCount(0);
    await expect(card(page, 'Jain Mix Veg')).toBeVisible();
    await page.getByRole('button', { name: 'Veg', exact: true }).click();
    await page.getByRole('button', { name: 'Jain', exact: true }).click();

    await page.getByRole('button', { name: 'Bestsellers' }).click();
    await expect(card(page, 'Paneer Tikka')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hara Bhara Kebab', level: 3 })).toHaveCount(0);
    await page.getByRole('button', { name: 'Bestsellers' }).click();

    await page.getByRole('navigation', { name: 'Menu categories' }).getByRole('button', { name: 'Beverages' }).click();
    await expect(page.getByRole('heading', { name: 'Beverages', level: 2 })).toBeInViewport();
    await expect(page.getByRole('navigation', { name: 'Menu categories' }).getByRole('button', { name: 'Beverages' })).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('friendly states', () => {
  test('invalid, rotated and missing QR codes cannot order', async ({ page }) => {
    const t = await newTable();
    await page.goto(`/${t.slug}?k=${'f'.repeat(64)}`);
    await expect(alertWith(page, 'This QR is no longer valid')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Add / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Call waiter' })).toHaveCount(0);
    await page.goto(`/${t.slug}?k=not-a-token`);
    await expect(alertWith(page, 'This QR is no longer valid')).toBeVisible();
    await page.goto(`/${t.slug}`);
    await expect(page.getByRole('status').first()).toContainText('Scan your table QR to order');
    await expect(page.getByRole('heading', { name: 'Paneer Tikka', level: 3 })).toBeVisible(); // menu still readable
    // rotating the QR kills the printed one
    await staff(OWNER, 'mgr_rotate_table_token', { p_table_id: t.id });
    await page.goto(`/${t.slug}?k=${t.token}`);
    await expect(alertWith(page, 'This QR is no longer valid')).toBeVisible();
  });

  test('suspended restaurant shows a clear message and takes no orders', async ({ page }) => {
    const t = await newTable('cafe-aroma');
    await q(`update public.restaurants set status = 'suspended' where slug = 'cafe-aroma'`);
    try {
      await page.goto(`/${t.slug}?k=${t.token}`);
      await expect(page.getByRole('heading', { name: 'Ordering is paused' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Add / })).toHaveCount(0);
    } finally {
      await q(`update public.restaurants set status = 'active' where slug = 'cafe-aroma'`);
    }
  });

  test('unknown restaurant gives a 404 page', async ({ page }) => {
    const res = await page.goto('/no-such-place');
    expect(res?.status()).toBe(404);
    await expect(page.getByText('We could not find this restaurant')).toBeVisible();
  });

  test('privacy notice is readable', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy notice' })).toBeVisible();
    await expect(page.getByText('We do not ask for your name')).toBeVisible();
  });
});

test.describe('reliability', () => {
  test('offline: the order fails politely, the cart is kept, and the retry creates exactly one order', async ({ page, context }) => {
    const t = await newTable();
    await open(page, t);
    await add(page, 'Masala Chai');
    await page.getByRole('button', { name: /View cart/ }).click();
    await context.setOffline(true);
    await expect(page.getByText("You're offline", { exact: false }).first()).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Place order' }).click();
    await expect(dialog(page).getByRole('alert')).toContainText('No connection. Your cart is saved.');
    expect(await ordersOf(t.id)).toHaveLength(0);
    await context.setOffline(false);
    await dialog(page).getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
    expect(await ordersOf(t.id)).toHaveLength(1);
  });

  test('double-tapping Place order never creates two orders', async ({ page }) => {
    const t = await newTable();
    await open(page, t);
    await add(page, 'Masala Chai');
    await page.getByRole('button', { name: /View cart/ }).click();
    await dialog(page).getByRole('button', { name: 'Place order' }).dblclick();
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
    expect(await ordersOf(t.id)).toHaveLength(1);
  });

  test('a dish that sold out while the guest was choosing is explained and removed', async ({ page }) => {
    const t = await newTable();
    await open(page, t);
    await add(page, 'Paneer Tikka');
    await add(page, 'Sweet Lassi');
    const [item] = await q<{ id: string }>(`select i.id from public.items i join public.restaurants r on r.id = i.restaurant_id where r.slug = 'spice-garden' and i.name_en = 'Paneer Tikka'`);
    await staff(KITCHEN, 'staff_set_item_availability', { p_item_ids: [item!.id], p_available: false });
    try {
      await page.getByRole('button', { name: /View cart/ }).click();
      await dialog(page).getByRole('button', { name: 'Place order' }).click();
      await expect(dialog(page).getByRole('alert')).toContainText('just sold out');
      expect(await ordersOf(t.id)).toHaveLength(0);
      // the menu refreshed: the sold-out dish left the cart, the other one stayed
      await expect(dialog(page).getByText('Paneer Tikka')).toHaveCount(0);
      await expect(dialog(page).getByText('Sweet Lassi')).toBeVisible();
      await expect(dialog(page)).toContainText('We updated your cart');
    } finally {
      await staff(KITCHEN, 'staff_set_item_availability', { p_item_ids: [item!.id], p_available: true });
    }
  });
});

test.describe('security on the real server', () => {
  test('API refuses cross-site posts, prices from the client, and bad content types', async ({ page, request }) => {
    const t = await newTable();
    const body = { slug: t.slug, token: t.token, idempotency_key: 'e2e-key-0001-abcd', items: [{ item_id: '00000000-0000-4000-8000-000000000000', qty: 1 }] };
    // no Origin header at all (what a cross-site form post or a script sends) -> refused
    expect((await request.post('/api/guest/order', { data: body })).status()).toBe(403);
    const base = page.context().request;
    const evil = await base.post('/api/guest/order', { data: body, headers: { origin: 'https://evil.example' } });
    expect(evil.status()).toBe(403);
    expect(((await evil.json()) as { error: { key: string } }).error.key).toBe('origin_not_allowed');
    const origin = new URL(page.url() === 'about:blank' ? (process.env.E2E_BASE_URL ?? 'http://localhost:3100') : page.url()).origin;
    const tamper = await base.post('/api/guest/order', { data: { ...body, total_paise: 1 }, headers: { origin } });
    expect(tamper.status()).toBe(400);
    const form = await base.post('/api/guest/order', { form: { a: '1' }, headers: { origin } });
    expect(form.status()).toBe(415);
    expect((await base.get('/api/guest/status?slug=spice-garden')).status()).toBe(401);
    expect(await ordersOf(t.id)).toHaveLength(0);
  });

  test('security headers and nonce are present on guest pages', async ({ page }) => {
    const t = await newTable();
    const res = await page.goto(`/${t.slug}?k=${t.token}`);
    const h = res!.headers();
    expect(h['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['cache-control'] ?? '').not.toContain('public');
  });

  test('no console errors or CSP violations while using the page', async ({ page }) => {
    const bad: string[] = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) bad.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => bad.push(`pageerror: ${e.message}`));
    const t = await newTable();
    await open(page, t);
    await add(page, 'Masala Chai');
    await placeOrderFromCart(page);
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
    await page.getByRole('button', { name: 'Call waiter' }).click();
    await dialog(page).getByRole('button', { name: 'Water' }).click();
    await expect(dialog(page)).toContainText('Waiter is on the way');
    expect(bad).toEqual([]);
  });
});

test.describe('dish details', () => {
  test('a dish with a photo opens a details sheet with the full description and an Add button; favourites show bestsellers', async ({ page }) => {
    const t = await newTable();
    const [it] = await q<{ id: string; rid: string; name_en: string }>(`select i.id, i.restaurant_id rid, i.name_en from public.items i join public.restaurants r on r.id = i.restaurant_id where r.slug = 'spice-garden' and i.is_available and i.name_en = 'Paneer Tikka'`);
    const path = `${it!.rid}/00000000-0000-4000-8000-0000000000aa.webp`;
    await q(`update public.items set image_path = $2 where id = $1`, [it!.id, path]);
    try {
      await open(page, t);
      await expect(page.getByRole('heading', { name: 'Our favourites' })).toBeVisible();
      await page.getByRole('button', { name: 'View Paneer Tikka' }).last().click();
      await expect(dialog(page).getByRole('button', { name: 'Add Paneer Tikka', exact: true })).toBeVisible();
      await dialog(page).getByRole('button', { name: 'Add Paneer Tikka', exact: true }).click();
      await expect(dialog(page).getByRole('button', { name: 'Add one more Paneer Tikka' })).toBeVisible();
      await dialog(page).getByRole('button', { name: 'Close', exact: true }).click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: /View cart/ })).toContainText('₹280');
      await page.getByLabel('Search the menu').fill('tikka');
      await expect(page.getByRole('heading', { name: 'Our favourites' })).toHaveCount(0); // favourites only while browsing
    } finally {
      await q(`update public.items set image_path = null where id = $1`, [it!.id]);
    }
  });
});

test.describe('accessibility (axe, WCAG 2 A/AA)', () => {
  const scan = async (page: Page, label: string) => {
    // Sheets fade in over 220 ms; scanning mid-fade measures colours against the dimmed backdrop and reports false contrast failures.
    await page.waitForTimeout(400);
    const r = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const summary = r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    expect(summary, `${label}: ${summary.join('\n')}`).toEqual([]);
  };
  test('menu, cart, help sheets, status, thank-you and state pages have no violations', async ({ page }) => {
    const t = await newTable();
    await open(page, t);
    await scan(page, 'menu');
    await add(page, 'Paneer Tikka');
    await page.getByRole('button', { name: /View cart/ }).click();
    await scan(page, 'cart');
    await dialog(page).getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
    await scan(page, 'status');
    await page.getByRole('button', { name: 'Call waiter' }).click();
    await scan(page, 'waiter sheet');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Ask for bill' }).click();
    await scan(page, 'bill sheet');
    await page.keyboard.press('Escape');
    await staff(OWNER, 'staff_close_session', { p_session_id: (await sessionOf(t.id))!, p_force: true, p_reason: 'a11y' });
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
    await scan(page, 'thank you');
    await page.goto(`/${t.slug}?k=${'f'.repeat(64)}`);
    await scan(page, 'invalid qr');
    await page.goto('/privacy');
    await scan(page, 'privacy');
  });

  test('sheets are keyboard operable: Escape closes and focus returns to the opener', async ({ page }) => {
    const t = await newTable();
    await open(page, t);
    const opener = page.getByRole('button', { name: 'Call waiter' });
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('every interactive control is at least 44px tall', async ({ page }) => {
    const t = await newTable();
    await open(page, t);
    await add(page, 'Paneer Tikka');
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out;
    });
    expect(small).toEqual([]);
  });
});
