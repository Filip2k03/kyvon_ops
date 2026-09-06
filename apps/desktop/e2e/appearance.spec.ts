import { expect, test } from '@playwright/test';

/**
 * The display panel, exercised the way someone would actually use it.
 *
 * Unit tests cover the token mapping; these check the parts only a real
 * browser can answer — that the preference reaches the document, survives a
 * reload, and is reachable without a mouse.
 */

test.describe('display settings', () => {
  test('a preference reaches the document and survives a reload', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Display settings' }).click();
    const panel = page.getByRole('dialog', { name: 'Display settings' });
    await expect(panel).toBeVisible();

    // Exact: "Large" is also a prefix of "Largest".
    await panel.getByRole('radio', { name: 'Large', exact: true }).click();
    await panel.getByRole('radio', { name: 'High' }).click();

    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-contrast', 'high');
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--kyvon-text-scale').trim(),
        ),
      )
      .toBe('1.15');

    // The point of storing it: a reader should not re-choose on every visit.
    await page.reload();
    await expect(root).toHaveAttribute('data-contrast', 'high');
  });

  test('reduced motion actually zeroes transition duration', async ({ page }) => {
    // Enforced in one CSS rule rather than per component — a single missed
    // transition is what makes someone who needs this stop trusting it.
    await page.goto('/');
    await page.getByRole('button', { name: 'Display settings' }).click();
    await page
      .getByRole('dialog', { name: 'Display settings' })
      .getByRole('radio', { name: 'Reduced' })
      .click();

    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    const duration = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.transition = 'opacity 400ms';
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).transitionDuration;
      probe.remove();
      return value;
    });
    expect(parseFloat(duration)).toBeLessThan(0.01);
  });

  test('the panel is operable and dismissible from the keyboard', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Display settings' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Display settings' })).toBeVisible();

    // Escape must both close it and hand focus back, or a keyboard user is
    // stranded at the end of the document.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Display settings' })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('reset returns to the system defaults', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Display settings' }).click();
    const panel = page.getByRole('dialog', { name: 'Display settings' });

    await panel.getByRole('radio', { name: 'Largest' }).click();
    await panel.getByRole('button', { name: /reset to system defaults/i }).click();

    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--kyvon-text-scale').trim(),
        ),
      )
      .toBe('1');
  });

  test('every control clears a 44px touch target', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Display settings' }).click();
    const panel = page.getByRole('dialog', { name: 'Display settings' });

    for (const control of await panel.getByRole('radio').all()) {
      const box = await control.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
