import {test, expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';

test('formats all amounts in the account currency', async ({ page }) => {
    // regenerate the test export with a non-EUR account to ensure no formatting falls back to the EUR default
    const html = execFileSync('lua', ['./tests/sankey_test.lua'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, SANKEY_TEST_CURRENCY: 'USD' },
    });

    await page.route('**/usd-export.html', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/usd-export.html');

    // only the single USD transaction matches the USD account, all others are skipped
    const mainNodeLabel = page.getByTestId('chart-node-label-1');
    await expect(mainNodeLabel).toContainText(/698,75\s\$/);
    await expect(mainNodeLabel).not.toContainText('€');
});
