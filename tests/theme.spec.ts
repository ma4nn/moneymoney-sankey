import {test, expect} from '@playwright/test';
import {chartSelectors} from './selectors';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('theme can be toggled and is persisted', async({ page }) => {
    const html = page.locator('html');
    const themeToggle = page.locator('.theme-toggle');

    await expect(html).toHaveAttribute('data-bs-theme', 'light'); // Playwright emulates a light color scheme by default

    // the toggle must occupy its own line above the footer text
    const toggleBox = await themeToggle.boundingBox();
    const footerTextBox = await page.locator('footer small').boundingBox();
    expect(footerTextBox.y).toBeGreaterThanOrEqual(toggleBox.y + toggleBox.height);

    await themeToggle.hover(); // unselected schemes are only revealed on hover
    await page.locator('label[for="theme-dark"]').click();

    await expect(html).toHaveAttribute('data-bs-theme', 'dark');
    await expect(page.locator(`#chart-container ${chartSelectors.container}`)).toHaveCSS('color-scheme', 'dark'); // chart must follow the selected theme
    await expect(page.getByTestId('chart-node-1')).toHaveCSS('fill', 'rgb(179, 179, 179)'); // main node uses its dark color variant
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

    await page.reload();
    await expect(html).toHaveAttribute('data-bs-theme', 'dark');

    // the persisted scheme must be reflected by the radio group, collapsed to only the active icon
    await page.mouse.move(0, 0); // move away from the toggle so it collapses
    await expect(page.locator('#theme-dark')).toBeChecked();
    // asserted via the computed style instead of toBeVisible(): playwright's webkit build keeps a stale zero-size
    // layout box for the label alpine reveals after load and reports it as hidden (real safari lays it out correctly)
    await expect(page.locator('label[for="theme-dark"]')).toHaveCSS('display', 'inline-block');
    await expect(page.locator('label[for="theme-light"]')).toBeHidden();

    // an explicitly selected theme must not be overwritten by system preference changes
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html).toHaveAttribute('data-bs-theme', 'dark');

    await themeToggle.hover();
    await page.locator('label[for="theme-light"]').click();
    await expect(html).toHaveAttribute('data-bs-theme', 'light');
    await expect(page.getByTestId('chart-node-1')).toHaveCSS('fill', 'rgb(75, 75, 75)');

    // selecting "system" removes the persisted preference and applies the current system scheme
    await themeToggle.hover();
    await page.locator('label[for="theme-system"]').click();
    await expect(html).toHaveAttribute('data-bs-theme', 'light');
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
});

test('theme can be selected with the keyboard', async({ page }) => {
    await page.locator('#theme-system').focus(); // the checked radio is the group's tab stop
    await expect(page.locator('label[for="theme-light"]')).toBeVisible(); // focus expands the collapsed group

    await page.keyboard.press('ArrowRight'); // native radio group navigation selects the next scheme
    await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
    await expect(page.locator('#theme-dark')).toBeChecked();
});

test('invalid persisted theme falls back to the system preference', async({ page }) => {
    await page.evaluate(() => localStorage.setItem('theme', 'invalid-value'));
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();

    await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
    await expect(page.locator('#theme-system')).toBeChecked();
});

test('theme follows the system preference by default', async({ page }) => {
    const html = page.locator('html');

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await expect(html).toHaveAttribute('data-bs-theme', 'dark');

    // a change of the system preference must be applied without reloading
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html).toHaveAttribute('data-bs-theme', 'light');
});
