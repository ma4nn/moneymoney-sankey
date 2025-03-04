import {test, expect, Page} from '@playwright/test';
import * as Highcharts from 'highcharts';

async function getChartNodeById(nodeId: number, page: Page): Promise<Highcharts.SeriesSankeyNodesOptionsObject> {
  const chart = await page.evaluateHandle('window.chart');
  const chartData = await page.evaluate(chart => (chart as Highcharts.Chart).series[0], chart) as unknown as Highcharts.SeriesSankeyOptions;

  return new Promise(resolve => {
    resolve(chartData.nodes.find(node => node.id === String(nodeId)))
  });
}

async function validateSaldo(saldo: string = '€4,127.71', page: Page) {
  const mainNode = await getChartNodeById(1, page);
  expect(mainNode.dataLabels[0].textStr).toEqual('Saldo: <strong style="color:#14c57e"><strong>' + saldo + '</strong></strong>');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('has valid initial state', async ({ page }) => {
  await page.locator('#chart-container').screenshot({ path: 'tmp/sample.png' }); // take a screenshot for README file
  await expect(page.getByRole('heading', { name: 'Cashflows' })).toBeVisible();

  await expect(page.locator('#transaction-count')).toHaveText('22 Transaktionen');

  await validateSaldo('€4,127.71', page);
});

test('has configurable options', async ({ page }) => {
  const configMenu = page.locator('#offcanvasConfig');
  const configButton = page.getByRole('button', { name: 'Chart anpassen' });

  await expect(configMenu).toBeHidden();
  await expect(configButton).toBeVisible();
  await expect(configButton).toBeEnabled();

  const applyButton = page.getByRole('button', { name: 'Anwenden' });

  await configButton.click();
  await expect(configMenu).toBeVisible();

  // verify apply without changes does nothing
  await validateSaldo('€4,127.71', page);
  await applyButton.click();
  await validateSaldo('€4,127.71', page);

  const node = page.getByTestId('chart-node-25');
  await expect(node).toBeVisible();
  await configButton.click();
  await page.locator('form #threshold').fill('50');
  await applyButton.click();
  await expect(node).toBeHidden();

  await validateSaldo('€4,177.56', page);
});