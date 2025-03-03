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
  await page.locator('#chart-container').screenshot({ path: 'tmp/sample.png' }); // take a screenshot for readme file

  await expect(page.locator('#transactionCount')).toHaveText('7 Transaktionen');
});

test('can view options', async ({ page }) => {
  const config = page.locator('#accordionConfig #collapseOne');
  const select = page.getByRole('button', { name: 'Chart anpassen' });

  await expect(config).toBeHidden();
  await expect(select).toBeVisible();
  await expect(select).toBeEnabled();

  await select.click();
  await expect(config).toBeVisible();
});