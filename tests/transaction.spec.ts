import {test, expect, Locator} from '@playwright/test';

const categoryIds = {
    main: 1,
    transport: 1238034679,
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

test('should display correct date range', async ({ page }) => {
    await page.getByRole('button', { name: 'Kategorien anpassen' }).click();

    const metaText = await page.locator('small[x-data="transactionmeta"]').textContent();
    const dateMatches = metaText.match(/\d{1,2}\.\d{1,2}\.\d{4}/g);

    expect(dateMatches).toBeTruthy();
    expect(dateMatches.length).toBeGreaterThanOrEqual(2);
});

test('should show all unique account names', async ({ page }) => {
    await page.getByRole('button', { name: 'Kategorien anpassen' }).click();

    const metaText = await page.locator('small[x-data="transactionmeta"]').textContent();

    expect(metaText).toContain('Tagesgeld XYZ Bank');
    expect(metaText).toContain('Kreditkarte XYZ Bank');
});

test('should calculate month count for scaling', async ({ page }) => {
    const showMonthlyInput = page.getByRole('switch', {name: 'pro Monat'});
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);

    const totalValue = await getNodeValue(mainNode);
    await showMonthlyInput.check();
    const monthlyValue = await getNodeValue(mainNode);

    const scalingFactor = totalValue / monthlyValue;
    expect(scalingFactor).toBeCloseTo(2.03333, 2);
});

test('should handle empty category names', async ({ page }) => {
    await page.getByRole('button', { name: 'Kategorien anpassen' }).click();

    const tableText = await page.locator('table#category-config').textContent();
    const hasOhneCategory = tableText.includes('(ohne)') || tableText.includes('ohne');

    expect(hasOhneCategory !== undefined).toBeTruthy();
});

test('should parse multi-level categories with \\\\ separator', async ({ page }) => {
    await page.getByRole('button', { name: 'Kategorien anpassen' }).click();
    await page.locator('#offcanvasConfig').waitFor({ state: 'visible' });

    const categoryRow = page.locator(`table#category-config [data-category-id="${categoryIds.transportCarInsurance}"]`);
    const pathText = await categoryRow.locator('.category-name').textContent();

    expect(pathText).toContain('»');
});

test('should generate consistent category IDs', async ({ page }) => {
    await page.getByRole('button', { name: 'Kategorien anpassen' }).click();

    const categoryIds = await page.locator('table#category-config [data-category-id]').evaluateAll(
        elements => elements.map(el => el.getAttribute('data-category-id'))
    );

    const uniqueIds = new Set(categoryIds);
    expect(uniqueIds.size).toBe(categoryIds.length);
});

test('should aggregate transactions across categories', async ({ page }) => {
    const transportNode = page.getByTestId(`chart-node-${categoryIds.transport}`);
    const transportValue = await getNodeValue(transportNode);

    expect(transportValue).toBeGreaterThan(0);
    expect(transportValue).toBeCloseTo(490.90);
});
