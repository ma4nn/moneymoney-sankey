import {test, expect} from '@playwright/test';
import {NodeValidator} from "../src/validators";

const categoryIds = {
    living: 1698513113,
    transport: 1238034679,
};

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('should show warning icon when budget exceeded', async ({ page }) => {
    await page.getByRole('button', { name: 'Kategorien anpassen' }).click();
    await page.locator(`table#category-config [data-category-id="${categoryIds.living}"] input[name="budget"]`).fill('100');
    await page.getByRole('button', { name: 'Anwenden' }).click();

    await expect(page.getByTestId(`chart-node-label-${categoryIds.living}`)).toContainText(NodeValidator.warningSign);
});

test('should display budget warning in German', async ({ page }) => {
    await page.getByRole('button', { name: 'Kategorien anpassen' }).click();
    await page.locator(`table#category-config [data-category-id="${categoryIds.living}"] input[name="budget"]`).fill('50');
    await page.getByRole('button', { name: 'Anwenden' }).click();

    const livingNode = page.getByTestId(`chart-node-${categoryIds.living}`);
    await livingNode.hover();
    await page.waitForSelector('.highcharts-tooltip');

    const tooltip = await page.locator('.highcharts-tooltip').innerHTML();
    expect(tooltip).toContain('Budget');
    expect(tooltip).toContain('überschritten');
    expect(tooltip).toContain(NodeValidator.warningSign);
});

test('should not show warnings without budgets', async ({ page }) => {
    const transportNode = page.getByTestId(`chart-node-${categoryIds.transport}`);
    await transportNode.hover();
    await page.waitForSelector('.highcharts-tooltip');

    const tooltip = await page.locator('.highcharts-tooltip').innerHTML();
    expect(tooltip).not.toContain(NodeValidator.warningSign);
    expect(tooltip).not.toContain('überschritten');
});

test('should show correct overage amount', async ({ page }) => {
    await page.getByRole('button', { name: 'Kategorien anpassen' }).click();
    await page.locator(`table#category-config [data-category-id="${categoryIds.living}"] input[name="budget"]`).fill('100');
    await page.getByRole('button', { name: 'Anwenden' }).click();

    const livingNode = page.getByTestId(`chart-node-${categoryIds.living}`);
    await livingNode.hover();
    await page.waitForSelector('.highcharts-tooltip');

    const tooltip = await page.locator('.highcharts-tooltip').textContent();
    expect(tooltip).toMatch(/Budget um.*überschritten/);
    expect(tooltip).toMatch(/\d+[,.]?\d*/);
});
