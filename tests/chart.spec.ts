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
    "transportCarInsurance": 398.25,
    "leisureStreaming": 14.99,
    "healthSport": 38.80,
    "supplyInternet": 49.85
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

test('take screenshot', async ({ page }) => {
    await page.evaluate(() => document.querySelectorAll('header').forEach(header => header.remove()));
    await page.locator('#chart-container').screenshot({ path: 'tmp/sample.png' }); // take a screenshot for README file
});

test('has valid initial state', async ({ page }) => {
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);

    await expect(page.getByRole('heading', { name: 'Cashflows' })).toBeVisible();
    await expect(page.locator('#transaction-count')).toHaveText('19 Transaktionen');
    await expect(page.getByRole('alert')).toHaveCount(0);

    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main);
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

    // no empty category names
    await expect(page.locator('table#category-config [data-category-id="0"]')).toHaveCount(0);

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

    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main + defaultNodeValue.healthSport + defaultNodeValue.leisureStreaming + defaultNodeValue.supplyInternet);
});

test('show monthly values', async ({ page }) => {
    const showMonthlyInput = page.getByRole('switch', {name: 'pro Monat'});
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);
    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main);

    expect(await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').min))).toBeCloseTo(defaultNodeValue.leisureStreaming); // streaming node determines min
    expect(await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').max))).toBeCloseTo(defaultNodeValue.transport); // transport node determines max non-outlier

    expect(await showChartTooltip(categoryIds.transport, page)).toContain('18%');

    await showMonthlyInput.check();
    await expect(showMonthlyInput).toBeChecked();

    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main / 2.03333);

    // assert threshold values remain unscaled
    expect(await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').min))).toBeCloseTo(defaultNodeValue.leisureStreaming);
    expect(await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('input#threshold').max))).toBeCloseTo(defaultNodeValue.transport);

    expect(await showChartTooltip(categoryIds.transport, page)).toContain('18%');

    await showMonthlyInput.uncheck();
    await expect(showMonthlyInput).not.toBeChecked();

    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main);
});

test('hide and re-add category', async({ page }) => {
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);
    const configButton = page.getByRole('button', { name: 'Kategorien anpassen' });
    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main);

    const linkTransport = page.getByTestId(`chart-link-${categoryIds.transport}`);
    await linkTransport.click();
    await expect(linkTransport).toBeHidden();

    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main + defaultNodeValue.transport);

    const configRowLocator = async (categoryId: number) => page.locator(`table#category-config [data-category-id="${categoryId}"]`);
    await configButton.click();
    const checkboxTransport = (await configRowLocator(categoryIds.transport)).getByRole('checkbox', { name: "aktiv"});
    expect(await checkboxTransport.isChecked()).toBeFalsy();
    await checkboxTransport.check();
    await page.getByRole('button', { name: 'Anwenden' }).click();

    await expect(linkTransport).toBeHidden();  // link is still hidden because sub categories are also hidden

    await configButton.click();
    const checkboxTransportCar= (await configRowLocator(categoryIds.transportCar)).getByRole('checkbox', { name: "aktiv"});
    expect(await checkboxTransportCar.isChecked()).toBeFalsy();
    await checkboxTransportCar.check();
    const rowTransportCarInsurance= await configRowLocator(categoryIds.transportCarInsurance);
    expect(await rowTransportCarInsurance.getByRole('checkbox', { name: ""}).isChecked()).toBeFalsy();
    await rowTransportCarInsurance.locator('.category-name').click(); // simulate click on row
    await page.getByRole('button', { name: 'Anwenden' }).click();

    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main + defaultNodeValue.transport - defaultNodeValue.transportCarInsurance);
});