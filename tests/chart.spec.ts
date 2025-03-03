import { test, expect } from '@playwright/test';
import * as Highcharts from 'highcharts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('has valid Saldo', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Cashflows' })).toBeVisible();

  const chart = await page.evaluateHandle('window.chart');
  const chartData = await page.evaluate(chart => (chart as Highcharts.Chart).series[0], chart) as unknown as Highcharts.SeriesSankeyOptions;

  expect(chartData.nodes[2].dataLabels[0].textStr).toEqual('Saldo: <strong style="color:#14c57e"><strong>€602.30</strong></strong>');
});

test('has correct metadata', async ({ page }) => {
  await page.locator('#chart-container').screenshot({ path: 'tmp/sample.png' }); // take a screenshot for README file

  await expect(page.locator('#transactionCount')).toHaveText('7 Transaktionen');
});

test('threshold can be configured', async ({ page }) => {
  const configMenu = page.locator('#offcanvasConfig');
  const button = page.getByRole('button', { name: 'Chart anpassen' });

  await expect(configMenu).toBeHidden();
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();

  await button.click();
  await expect(configMenu).toBeVisible();

  const node = page.getByTestId('chart-node-3');
  await expect(node).toBeVisible();
  const thresholdInput = page.locator('form #threshold');
  await thresholdInput.fill('140');
  await page.getByRole('button', { name: 'Anwenden' }).click();
  await expect(node).toBeHidden();
});