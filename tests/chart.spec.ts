import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('has valid Saldo', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Cashflows' })).toBeVisible();

  const chart = await page.evaluateHandle('window.chart');
  const chartData = await page.evaluate(chart => chart.series[0], chart);

  expect(chartData.nodes[2].dataLabels[0].textStr).toEqual('Saldo: <strong style="color:#14c57e"><strong>€602.30</strong></strong>');
});
