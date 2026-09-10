import {test, expect, Page, Locator} from '@playwright/test';

const categoryIds = {
    "main": 1,
    "transport": 1238034679,
    "transportCar": 1475507816,
    "transportCarInsurance": 892808123,
    "living": 1698513113,
    "supply": 1497325786,
    "income": 161527383,
    "refund": 224064077,
    "onlinehandel": 1908223369
};
const defaultNodeValue = {
    "main": 4327.71,
    "transport": 490.90,
    "transportCarInsurance": 398.25,
    "leisureStreaming": 14.99,
    "healthSport": 38.80,
    "supplyInternet": 49.85,
    "income": 3999.95,
    "refund": 1198.45,
    "onlinehandel": 200.00
};

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

test('no console errors during page load', async ({ page }) => {
  const errors = [];

  page.on('pageerror', error => {
    errors.push(error.message);
  });

  await page.goto('/');

  expect(errors).toEqual([]);
});

test('take screenshot', async ({ page }) => {
    await page.evaluate(() => document.querySelectorAll('header').forEach(header => header.remove()));
    await page.locator('#chart-container').screenshot({ path: 'sample.png' }); // take a screenshot for README file
});

test('has valid initial state', async ({ page }) => {
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);

    await expect(page.getByRole('heading', { name: 'Cashflows' })).toBeVisible();
    await expect(page.locator('#transaction-count')).toHaveText('21 Transaktionen');
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

    const thresholdOutput = page.locator('output[for="threshold"]');
    await expect(thresholdOutput).toBeHidden(); // no cutoff active by default

    await configButton.click();
    // the slider is inverted (right = more detail), so position min + max - 50 equals a threshold of 50
    await setSliderValue('input#threshold', defaultNodeValue.leisureStreaming + defaultNodeValue.transport - 50, page);
    await expect(thresholdOutput).toHaveText(/≥ 50\s€/);
    await page.locator('table#category-config [data-category-id="' + categoryIds.living + '"] input[name="budget"]').fill('100');
    await applyButton.click();
    await expect(link).toBeHidden();

    await expect(page.getByTestId(`chart-node-label-${categoryIds.living}`)).toContainText('⚠️');

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

    // the displayed threshold cutoff follows the scaling toggle (50 € / 2.03333 months ≈ 25 €)
    const thresholdOutput = page.locator('output[for="threshold"]');
    await setSliderValue('input#threshold', defaultNodeValue.leisureStreaming + defaultNodeValue.transport - 50, page);
    await expect(thresholdOutput).toHaveText(/≥ 50\s€/);
    await showMonthlyInput.check();
    await expect(thresholdOutput).toHaveText(/≥ 25\s€/);
});

test('saldo becomes negative when expenses exceed income', async({ page }) => {
    const mainNode = page.getByTestId(`chart-node-${categoryIds.main}`);
    const mainNodeLabel = page.getByTestId(`chart-node-label-${categoryIds.main}`);
    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main);

    // remove the two biggest income categories so that the remaining income no longer covers the expenses
    const linkRefund = page.getByTestId(`chart-link-${categoryIds.refund}`);
    await linkRefund.click();
    await expect(linkRefund).toBeHidden();
    expect(await getNodeValue(mainNode)).toBeCloseTo(defaultNodeValue.main - defaultNodeValue.refund);

    const linkIncome = page.getByTestId(`chart-link-${categoryIds.income}`);
    await linkIncome.click();
    await expect(linkIncome).toBeHidden();

    const saldo = await getNodeValue(mainNode);
    expect(saldo).toBeCloseTo(defaultNodeValue.main - defaultNodeValue.income - defaultNodeValue.refund);
    expect(saldo).toBeLessThan(0);

    // the negative saldo is rendered as a negative amount in the warning color
    await expect(mainNodeLabel).toContainText('-870,69');
    await expect(mainNodeLabel.locator('tspan[style]').first()).toHaveCSS('fill', 'rgb(255, 107, 74)'); // #ff6b4a
});

test('sums income and expense transactions within the same category', async({ page }) => {
    // the Onlinehandel category contains a +320.00 income and a -120.00 expense transaction
    const node = page.getByTestId(`chart-node-${categoryIds.onlinehandel}`);
    expect(await getNodeValue(node)).toBeCloseTo(defaultNodeValue.onlinehandel);

    // the netted positive value is rendered on the income side of the chart
    await page.getByTestId(`chart-link-${categoryIds.onlinehandel}`).hover();
    await expect(page.locator('.highcharts-tooltip')).toContainText('Onlinehandel → Saldo');
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

test('category color swatches show the default chart colors', async({ page }) => {
    await page.getByRole('button', { name: 'Kategorien anpassen' }).click();

    const colorValues = await page.locator('table#category-config input[name="category-color"]')
        .evaluateAll((inputs: Array<HTMLInputElement>) => inputs.map(input => input.value));

    expect(colorValues.length).toBeGreaterThan(0);
    colorValues.forEach(value => expect(value).toMatch(/^#[0-9a-f]{6}$/));
    expect(colorValues).not.toContain('#000000'); // black indicates a value the color input could not parse (e.g. an unresolved light-dark() expression)
});