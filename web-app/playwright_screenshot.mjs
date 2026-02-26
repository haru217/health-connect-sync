import { chromium } from 'playwright';

(async () => {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    console.log('Navigating to localhost...');
    await page.goto('http://localhost:5173/');

    // Try to find the 'コンディション' tab/button
    console.log('Waiting for "コンディション" tab...');
    try {
        await page.waitForSelector('text="コンディション"', { timeout: 5000 });
        await page.click('text="コンディション"');
        console.log('Clicked "コンディション" tab.');
    } catch (e) {
        console.log('Could not find or click "コンディション", proceeding anyway.');
    }

    // Wait a bit for the graph to render/animate
    console.log('Waiting for render...');
    await page.waitForTimeout(3000);

    const artifactPath = 'C:\\Users\\senta\\.gemini\\antigravity\\brain\\c5e1f688-81d5-442e-813e-fb974e5559f0\\health_screen.png';
    console.log(`Saving screenshot to ${artifactPath}`);
    await page.screenshot({ path: artifactPath, fullPage: true });

    await browser.close();
    console.log('Done.');
})();
