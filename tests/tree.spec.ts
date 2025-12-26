import {test, expect, Locator} from '@playwright/test';

const categoryIds = {
    main: 1,
    transport: 1238034679,
    transportCar: 1475507816,
    transportCarInsurance: 892808123,
};

async function getNodeValue(node: Locator): Promise<number> {
    const value = await node.getAttribute('data-value');
    if (!value) throw new Error('missing or incorrect node');
    return Number(value);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('should exclude category and all children when clicked', async ({ page }) => {
    const transportLink = page.getByTestId(`chart-link-${categoryIds.transport}`);
    const transportCarLink = page.getByTestId(`chart-link-${categoryIds.transportCar}`);
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);

    const initialValue = await getNodeValue(mainNode);

    await expect(transportLink).toBeVisible();
    await expect(transportCarLink).toBeVisible();

    await transportLink.click();

    await expect(transportLink).toBeHidden();
    await expect(transportCarLink).toBeHidden();
    expect(await getNodeValue(mainNode)).toBeGreaterThan(initialValue);
});

test('should recalculate parent totals after exclusion', async ({ page }) => {
    const transportLink = page.getByTestId(`chart-link-${categoryIds.transport}`);
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);

    const initialValue = await getNodeValue(mainNode);
    await transportLink.click();

    const newValue = await getNodeValue(mainNode);
    expect(newValue).not.toEqual(initialValue);
    expect(newValue).toBeCloseTo(4127.71 + 490.90);
});

test('should handle deep category nesting (3+ levels)', async ({ page }) => {
    await expect(page.getByTestId(`chart-link-${categoryIds.transportCarInsurance}`)).toBeVisible();

    await page.getByRole('button', { name: 'Kategorien anpassen' }).click();

    const categoryRow = page.locator(`table#category-config [data-category-id="${categoryIds.transportCarInsurance}"]`);
    await expect(categoryRow).toBeVisible();

    const categoryPath = await categoryRow.locator('.category-name').textContent();
    expect(categoryPath).toContain('»');
});
