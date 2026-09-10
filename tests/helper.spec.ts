import {test, expect} from '@playwright/test';
import {chartSelectors} from './selectors';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('should format currency amounts in tooltips', async ({ page }) => {
    const mainNode = page.getByTestId('chart-node-1');
    await mainNode.hover();
    await page.waitForSelector(chartSelectors.tooltip);

    const tooltip = await page.locator(chartSelectors.tooltip).innerHTML();

    expect(tooltip).toContain(chartSelectors.strongTextClass);
    expect(tooltip).toContain('€');
});

test('should show colored values (green for positive)', async ({ page }) => {
    const mainNode = page.getByTestId('chart-node-1');
    await mainNode.hover();
    await page.waitForSelector(chartSelectors.tooltip);

    const tooltip = await page.locator(chartSelectors.tooltip).innerHTML();
    expect(tooltip).toContain('rgb(20, 197, 126)'); // Green: #14c57e
});

test('should display percentage badges', async ({ page }) => {
    await page.getByTestId('chart-link-1238034679').hover();
    await page.waitForSelector(chartSelectors.tooltip);

    const tooltip = await page.locator(chartSelectors.tooltip).textContent();
    expect(tooltip).toMatch(/\d+%/);
});
