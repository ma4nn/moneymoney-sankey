import {test, expect, Page, Locator} from '@playwright/test';
import {NodeValidator} from "../src/validators";
import {SankeyChart, SankeyNode} from "../src/sankey";

const mainNodeId: number = 1;

declare global {
    interface Window {
        chart: SankeyChart;
    }
}

async function getNodeValue(node: Locator): Promise<number> {
    const value = await node.getAttribute('data-value');
    if (! value) {
        throw new Error('missing or incorrect node');
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
    const mainNode = page.getByTestId(`chart-node-${mainNodeId}`);

    await expect(page.getByRole('heading', { name: 'Cashflows' })).toBeVisible();
    await expect(page.locator('#transaction-count')).toHaveText('22 Transaktionen');

    await expect(getNodeValue(mainNode)).resolves.toBeCloseTo(4127.71);
});

test('take screenshot', async ({ page }) => {
    await page.evaluate(() => document.querySelectorAll('header').forEach(header => header.remove()));
    await page.locator('#chart-container').screenshot({ path: 'tmp/sample.png' }); // take a screenshot for README file
});

test('has configurable options', async ({ page }) => {
    const mainNode = page.getByTestId(`chart-node-${mainNodeId}`);
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

    // assert apply without changes does nothing
    await expect(getNodeValue(mainNode)).resolves.toBeCloseTo(4127.71);
    await applyButton.click();
    await expect(getNodeValue(mainNode)).resolves.toBeCloseTo(4127.71);

    const nodeIdLiving = 9;
    const link = page.getByTestId('chart-link-25');
    await expect(link).toBeVisible();
    await configButton.click();
    await setSliderValue('input#threshold', 50, page);
    await page.locator('table#category-config [data-category-id="' + nodeIdLiving + '"] input[name="budget"]').fill('100');
    await applyButton.click();
    await expect(link).toBeHidden();

    await expect(page.getByTestId(`chart-node-label-${nodeIdLiving}`)).toContainText(NodeValidator.warningSign);

    await expect(getNodeValue(mainNode)).resolves.toBeCloseTo(4177.56);
});

test('show monthly values', async ({ page }) => {
    const mainNode = page.getByTestId(`chart-node-${mainNodeId}`);
    await expect(getNodeValue(mainNode)).resolves.toBeCloseTo(4127.71);

    await expect(page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').min))).resolves.toBeCloseTo(14.99);
    await expect(page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').max))).resolves.toBeCloseTo(490.90);

    const nodeIdTransport = 16;
    await expect(page.getByTestId(`chart-node-label-${nodeIdTransport}`)).toContainText('18%');

    const scalingValue = await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#is-show-monthly').value));
    await expect(scalingValue).toBeCloseTo(2.03, 2);
    await page.locator('input#is-show-monthly').check();

    await expect(getNodeValue(mainNode)).resolves.toBeCloseTo(2030.02);

    // assert threshold values remain unscaled
    await expect(page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').min))).resolves.toBeCloseTo(14.99);
    await expect(page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').max))).resolves.toBeCloseTo(490.90);

    await expect(page.getByTestId(`chart-node-label-${nodeIdTransport}`)).toContainText('18%');
});