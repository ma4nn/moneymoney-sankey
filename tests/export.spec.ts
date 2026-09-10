import {test, expect} from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('sankeymatic export requires confirmation of external data transfer', async({ page }) => {
    // tests must never contact the real external site, so answer any sankeymatic.com request with a local stub
    await page.context().route('https://sankeymatic.com/**', route => route.fulfill({ contentType: 'text/html', body: '<!DOCTYPE html><title>SankeyMATIC stub</title>' }));

    const actionsButton = page.getByRole('button', { name: 'Aktionen' });
    const sankeymaticLink = page.getByRole('link', { name: 'in SankeyMATIC öffnen' });

    await actionsButton.click();
    await expect(sankeymaticLink).toHaveAttribute('href', /^https:\/\/sankeymatic\.com\/build\/\?i=/);

    // declining the dialog must not open the external site
    let dialogMessage = '';
    page.once('dialog', dialog => {
        dialogMessage = dialog.message();
        dialog.dismiss();
    });
    await sankeymaticLink.click();
    expect(dialogMessage).toContain('externen Anbieter');
    expect(await page.context().waitForEvent('page', { timeout: 1000 }).catch(() => null)).toBeNull();

    // accepting the dialog opens the chart in a new tab (served by the stub above)
    await actionsButton.click();
    page.once('dialog', dialog => dialog.accept());
    const popupPromise = page.waitForEvent('popup');
    await sankeymaticLink.click();
    await (await popupPromise).waitForURL(/^https:\/\/sankeymatic\.com\/build\//);
});
