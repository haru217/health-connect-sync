import { chromium } from 'playwright';

(async () => {
    console.log('Launching browser...');
    // set to headless to avoid opening actual windows which might fail on Windows without display server
    const browser = await chromium.launch({ headless: true });
    // Or if they need a certain size:
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    console.log('Navigating to dashboard...');
    await page.goto('file:///c:/Users/senta/health-connect-sync/ops/CEO_DASHBOARD.html');

    console.log('Waiting for render...');
    await page.waitForTimeout(2000); // 2 seconds to allow any JS to run

    const artifactPath = 'C:\\Users\\senta\\.gemini\\antigravity\\brain\\db7dc610-1d14-4324-a6b5-5eaf7fb7fef8\\dashboard_restored.png';
    console.log(`Saving screenshot to ${artifactPath}`);
    await page.screenshot({ path: artifactPath, fullPage: true });

    await browser.close();
    console.log('Done.');
})();
