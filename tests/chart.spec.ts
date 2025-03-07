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
    await page.waitForFunction(() => window.chart !== undefined);

    const nodeLabel = await page.evaluate((id: number) => {
        return window.chart.getNodeById(id).label;
    }, nodeId);

    return new Promise(resolve => resolve(nodeLabel));
}

async function validateSaldo(saldo: string = '€4,127.71', page: Page) {
    const mainNodeLabel = await getChartNodeLabel(mainNodeId, page);
    expect(mainNodeLabel).toEqual('Saldo: <strong style="color:#14c57e"><strong>' + saldo + '</strong></strong>');
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

    await validateSaldo('€4,127.71', page);
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
    await validateSaldo('€4,127.71', page);
    await applyButton.click();
    await validateSaldo('€4,127.71', page);

    const nodeIdLiving = 9;
    const node = page.getByTestId('chart-node-25');
    await expect(node).toBeVisible();
    await configButton.click();
    await setSliderValue('input#threshold', 50, page);
    await page.locator('table#category-config [data-category-id="' + nodeIdLiving + '"] input[name="budget"]').fill('100');
    await applyButton.click();
    await expect(node).toBeHidden();

    expect(await getChartNodeLabel(nodeIdLiving, page)).toContain(NodeValidator.warningSign);

    await validateSaldo('€4,177.56', page);
});