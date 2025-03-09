import {test, expect, Page} from '@playwright/test';
import {NodeValidator} from "../src/validators";
import {SankeyChart, SankeyNode} from "../src/sankey";

const mainNodeId: number = 1;

declare global {
    interface Window {
        chart: SankeyChart;
    }
}

async function getChartNodeLabel(nodeId: number, page: Page): Promise<string> {
    return page.getByTestId(`chart-node-label-${nodeId}`).textContent();
}

async function getSaldo(page: Page): Promise<number> {
    const mainNode = await page.getByTestId(`chart-node-${mainNodeId}`);
    const value = await mainNode.getAttribute('data-value');

    if (! value) {
        throw new Error('missing or incorrect main node');
    }

    return Number(value);
}

async function setSliderValue(selector: string, value: number, page: Page): Promise<void> {
    await page.evaluate(({selector, value}) => {
        const slider = document.querySelector(selector) as HTMLInputElement;
        if (! slider) {
            return;
        }

        slider.value = String(value);
        slider.dispatchEvent(new Event('input', {bubbles: true}));
        slider.dispatchEvent(new Event('change', {bubbles: true}));
    }, {selector, value});
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('has valid initial state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Cashflows' })).toBeVisible();

    await expect(page.locator('#transaction-count')).toHaveText('22 Transaktionen');

    await expect(getSaldo(page)).resolves.toBeCloseTo(4127.71);
});

test('take screenshot', async ({ page }) => {
    await page.evaluate(() => document.querySelectorAll('header').forEach(header => header.remove()));
    await page.locator('#chart-container').screenshot({ path: 'tmp/sample.png' }); // take a screenshot for README file
});

test('has configurable options', async ({ page }) => {
    const configMenu = page.locator('#offcanvasConfig');
    const configButton = page.getByRole('button', { name: 'Kategorien anpassen' });

    await expect(configMenu).toBeHidden();
    await expect(configButton).toBeVisible();
    await expect(configButton).toBeEnabled();

    const mainNodeConfig = page.locator('table#category-config [data-category-id="' + mainNodeId + '"]');
    await expect(mainNodeConfig).toHaveCount(0);

    const applyButton = page.getByRole('button', { name: 'Anwenden' });

    await configButton.click();
    await expect(configMenu).toBeVisible();

    // verify apply without changes does nothing
    await expect(getSaldo(page)).resolves.toBeCloseTo(4127.71);
    await applyButton.click();
    await expect(getSaldo(page)).resolves.toBeCloseTo(4127.71);

    const nodeIdLiving = 9;
    const link = page.getByTestId('chart-link-25');
    await expect(link).toBeVisible();
    await configButton.click();
    await setSliderValue('input#threshold', 50, page);
    await page.locator('table#category-config [data-category-id="' + nodeIdLiving + '"] input[name="budget"]').fill('100');
    await applyButton.click();
    await expect(link).toBeHidden();

    expect(await getChartNodeLabel(nodeIdLiving, page)).toContain(NodeValidator.warningSign);

    await expect(getSaldo(page)).resolves.toBeCloseTo(4177.56);
});

test('show monthly values', async ({ page }) => {
    await expect(getSaldo(page)).resolves.toBeCloseTo(4127.71);

    const nodeIdTransport = 16;
    const nodeLabel = page.getByTestId(`chart-node-label-${nodeIdTransport}`);
    await expect(nodeLabel).toContainText('18%');

    const scalingValue = await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#is-show-monthly').value));
    await expect(scalingValue).toBeCloseTo(2.03, 2);
    await page.locator('input#is-show-monthly').check();

    expect(await getChartNodeLabel(nodeIdTransport, page)).toContain('18%');

    await expect(getSaldo(page)).resolves.toBeCloseTo(2030.02);
});