import {test, expect, Page} from '@playwright/test';
import {chartSelectors} from './selectors';

const categoryIds = {
    "main": 1,
    "transport": 1238034679,
    "living": 1698513113,
    "supply": 1497325786,
    "refund": 224064077
};

// the top of each link, which is where it attaches to the node it comes from
async function linkTops(page: Page): Promise<Array<string>> {
    const tops: Array<string> = [];
    for (const categoryId of [categoryIds.transport, categoryIds.living, categoryIds.supply, categoryIds.refund]) {
        const box = await page.getByTestId(`chart-link-${categoryId}`).boundingBox();
        tops.push(`${categoryId}:${Math.round(box?.y ?? -1)}`);
    }

    return tops;
}

async function nodeBox(page: Page, categoryId: number): Promise<{x: number, y: number, width: number, height: number}> {
    const box = await page.getByTestId(`chart-node-${categoryId}`).boundingBox();
    if (box === null) {
        throw new Error('node ' + categoryId + ' is not rendered');
    }

    return box;
}

async function dragNode(page: Page, categoryId: number, distance: number): Promise<void> {
    const box = await nodeBox(page, categoryId);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + distance, {steps: 10});
    await page.mouse.up();
}

async function sortBy(page: Page, sortKey: string): Promise<void> {
    await page.locator('[x-data="sorter"] button').click();
    await page.locator(`[data-sort-key="${sortKey}"]`).click();
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('node can be dragged along the y axis', async ({ page }) => {
    const before = await nodeBox(page, categoryIds.transport);

    await dragNode(page, categoryIds.transport, 120);

    const after = await nodeBox(page, categoryIds.transport);
    expect(after.y).toBeCloseTo(before.y + 120, 0);
    expect(after.x).toBeCloseTo(before.x, 0); // the x position encodes the category level and must not change
});

test('dragged node keeps its position after a reload', async ({ page }) => {
    const before = await nodeBox(page, categoryIds.transport);

    await dragNode(page, categoryIds.transport, 100);
    await page.reload();

    const after = await nodeBox(page, categoryIds.transport);
    expect(after.y).toBeCloseTo(before.y + 100, 0);
});

test('dragged node is reset by a double click', async ({ page }) => {
    const before = await nodeBox(page, categoryIds.transport);

    await dragNode(page, categoryIds.transport, 80);
    expect((await nodeBox(page, categoryIds.transport)).y).toBeCloseTo(before.y + 80, 0);

    await page.getByTestId(`chart-node-${categoryIds.transport}`).dblclick();
    expect((await nodeBox(page, categoryIds.transport)).y).toBeCloseTo(before.y, 0);

    await page.reload();
    expect((await nodeBox(page, categoryIds.transport)).y).toBeCloseTo(before.y, 0);
});

test('node cannot be dragged out of the chart', async ({ page }) => {
    const chart = await page.locator(chartSelectors.container).boundingBox();
    if (chart === null) {
        throw new Error('chart is not rendered');
    }

    await dragNode(page, categoryIds.supply, -2000);

    const top = await nodeBox(page, categoryIds.supply);
    expect(top.y).toBeGreaterThanOrEqual(chart.y);

    await dragNode(page, categoryIds.supply, 2000);

    const bottom = await nodeBox(page, categoryIds.supply);
    expect(bottom.y + bottom.height).toBeLessThanOrEqual(chart.y + chart.height);
});

test('links stay stacked along a dragged node after a reload', async ({ page }) => {
    await dragNode(page, categoryIds.main, 40);

    const dragged = await linkTops(page);
    expect(new Set(dragged).size).toBeGreaterThan(1); // guards against all links collapsing to one edge

    await page.reload();

    // the reload used to leave the node without its links, stacking them all at its top edge
    expect(await linkTops(page)).toEqual(dragged);
});

test('a drag released outside the chart does not continue', async ({ page }) => {
    const box = await nodeBox(page, categoryIds.transport);

    // leaving in one jump means the chart never sees a move, so the drag cannot capture the pointer
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(5, 5);
    await page.mouse.up();

    const released = await nodeBox(page, categoryIds.transport);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 150); // back in, no button held
    expect((await nodeBox(page, categoryIds.transport)).y).toBeCloseTo(released.y, 0);
});

test('resetting the categories puts the dragged nodes back', async ({ page }) => {
    const before = await nodeBox(page, categoryIds.transport);

    await dragNode(page, categoryIds.transport, 70);
    await page.getByRole('button', { name: 'Kategorien anpassen' }).click();
    await page.getByRole('button', { name: 'Zurücksetzen' }).click();

    expect((await nodeBox(page, categoryIds.transport)).y).toBeCloseTo(before.y, 0);
});

test('dragged node keeps its position when the chart is rebuilt', async ({ page }) => {
    const before = await nodeBox(page, categoryIds.transport);

    await dragNode(page, categoryIds.transport, 90);
    await page.getByTestId(`chart-link-${categoryIds.supply}`).click(); // excluding a category rebuilds the chart

    await expect(page.getByTestId(`chart-node-${categoryIds.supply}`)).toHaveCount(0);
    expect((await nodeBox(page, categoryIds.transport)).y).toBeCloseTo(before.y + 90, 0);
});

test('sorting keeps a dragged node in place and reorders the rest', async ({ page }) => {
    const livingBefore = await nodeBox(page, categoryIds.living);

    await dragNode(page, categoryIds.transport, 100);
    const dragged = await nodeBox(page, categoryIds.transport);

    await sortBy(page, 'custom.real'); // Betrag

    // a manually placed node wins over the automatic order, the rest still follows the sort
    expect((await nodeBox(page, categoryIds.transport)).y).toBeCloseTo(dragged.y, 0);
    expect((await nodeBox(page, categoryIds.living)).y).not.toBeCloseTo(livingBefore.y, 0);
    expect(new Set(await linkTops(page)).size).toBeGreaterThan(1); // the links must not collapse onto one edge
});

test('dragging a node leaves its value and the other nodes untouched', async ({ page }) => {
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);
    const valueBefore = await mainNode.getAttribute('data-value');
    const mainBefore = await nodeBox(page, categoryIds.main);

    await dragNode(page, categoryIds.transport, 60);

    expect(await mainNode.getAttribute('data-value')).toBe(valueBefore);
    expect((await nodeBox(page, categoryIds.main)).y).toBeCloseTo(mainBefore.y, 0);
});
