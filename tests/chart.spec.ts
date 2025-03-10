import {test, expect, Page, Locator} from '@playwright/test';
import {NodeValidator} from "../src/validators";
import {SankeyChart} from "../src/sankey";

const categoryIds = {
    "main": 1,
    "transport": 1238034679,
    "transportCar": 1475507816,
    "transportCarInsurance": 892808123,
    "living": 1698513113,
    "supply": 1497325786
};
const defaultNodeValue = {
    "main": 4127.71,
    "transport": 490.90,
    "transportCarInsurance": 398.25
};

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

async function showChartTooltip(nodeId: number, page: Page): Promise<string> {
    page.getByTestId(`chart-link-${nodeId}`).hover();
    const tooltip = await page.waitForSelector('.highcharts-tooltip .badge');

    return tooltip.textContent();
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('has valid initial state', async ({ page }) => {
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);

    await expect(page.getByRole('heading', { name: 'Cashflows' })).toBeVisible();
    await expect(page.locator('#transaction-count')).toHaveText('19 Transaktionen');

    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main);
});

test('take screenshot', async ({ page }) => {
    await page.evaluate(() => document.querySelectorAll('header').forEach(header => header.remove()));
    await page.locator('#chart-container').screenshot({ path: 'tmp/sample.png' }); // take a screenshot for README file
});

test('has configurable options', async ({ page }) => {
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);
    const configMenu = page.locator('#offcanvasConfig');
    const configButton = page.getByRole('button', { name: 'Kategorien anpassen' });

    await expect(configMenu).toBeHidden();
    await expect(configButton).toBeVisible();
    await expect(configButton).toBeEnabled();

    const mainNodeConfig = page.locator('table#category-config [data-category-id="' + categoryIds.main + '"]');
    await expect(mainNodeConfig).toHaveCount(0);

    const applyButton = page.getByRole('button', { name: 'Anwenden' });

    await configButton.click();
    await expect(configMenu).toBeVisible();

    // assert apply without changes does nothing
    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main);
    await applyButton.click();
    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main);

    const link = page.getByTestId(`chart-link-${categoryIds.supply}`); // Versorgung
    await expect(link).toBeVisible();
    await configButton.click();
    await setSliderValue('input#threshold', 50, page);
    await page.locator('table#category-config [data-category-id="' + categoryIds.living + '"] input[name="budget"]').fill('100');
    await applyButton.click();
    await expect(link).toBeHidden();

    await expect(page.getByTestId(`chart-node-label-${categoryIds.living}`)).toContainText(NodeValidator.warningSign);

    expect(await getNodeValue(mainNode)).toBeCloseTo(4177.56);
});

test('show monthly values', async ({ page }) => {
    const showMonthlyInput = page.locator('input#is-show-monthly');
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);
    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main);

    expect(await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').min))).toBeCloseTo(14.99);
    expect(await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').max))).toBeCloseTo(490.90);

    expect(await showChartTooltip(categoryIds.transport, page)).toContain('18%');

    expect(await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#is-show-monthly').value))).toBeCloseTo(2.03);
    await showMonthlyInput.check();

    expect(await getNodeValue(mainNode)).toBeCloseTo(2030.02);

    // assert threshold values remain unscaled
    expect(await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').min))).toBeCloseTo(14.99);
    expect(await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').max))).toBeCloseTo(490.90);

    expect(await showChartTooltip(categoryIds.transport, page)).toContain('18%');

    await showMonthlyInput.uncheck();

    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main);
});

test('hide and re-add category', async({ page }) => {
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);
    const configButton = page.getByRole('button', { name: 'Kategorien anpassen' });
    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main);

    const link = page.getByTestId(`chart-link-${categoryIds.transport}`);
    await link.click();
    await expect(link).toBeHidden();

    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main + defaultNodeValue.transport);

    await configButton.click();
    const checkboxLiving = page.locator('table#category-config [data-category-id="' + categoryIds.transport + '"] input[name="category-is-active"]');
    expect(await checkboxLiving.isChecked()).toBeFalsy();
    await checkboxLiving.check();
    await page.getByRole('button', { name: 'Anwenden' }).click();

    await expect(link).toBeHidden(); // link is still hidden because sub categories are also hidden

    await configButton.click();
    const checkboxTransportCar= page.locator('table#category-config [data-category-id="' + categoryIds.transportCar + '"] input[name="category-is-active"]');
    expect(await checkboxTransportCar.isChecked()).toBeFalsy();
    await checkboxTransportCar.check();
    const checkboxTransportCarInsurance= page.locator('table#category-config [data-category-id="' + categoryIds.transportCarInsurance + '"] input[name="category-is-active"]');
    expect(await checkboxTransportCarInsurance.isChecked()).toBeFalsy();
    await checkboxTransportCarInsurance.check();
    await page.getByRole('button', { name: 'Anwenden' }).click();

    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main + defaultNodeValue.transport - defaultNodeValue.transportCarInsurance);
});