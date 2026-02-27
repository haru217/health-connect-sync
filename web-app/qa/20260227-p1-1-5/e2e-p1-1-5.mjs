import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:5173'
const outDir = path.resolve('qa/20260227-p1-1-5')

const screenFlow = [
  { label: 'ホーム', file: 'home.png' },
  { label: 'コンディション', file: 'condition-composition.png' },
  { label: 'アクティビティ', file: 'exercise.png' },
  { label: '食事', file: 'meal.png' },
  { label: 'プロフィール', file: 'profile.png' },
]

const conditionInnerTabs = [
  { label: '体組成', file: 'condition-composition-inner.png' },
  { label: 'バイタル', file: 'condition-vital-inner.png' },
  { label: '睡眠', file: 'condition-sleep-inner.png' },
]

function uniqueBy(items, keyFn) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const key = keyFn(item)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(item)
  }
  return out
}

async function clickBottomTab(page, label) {
  const locator = page.locator('.bottom-nav .nav-item', { hasText: label }).first()
  await locator.waitFor({ state: 'visible', timeout: 10000 })
  await locator.click()
}

async function clickConditionInnerTab(page, label) {
  const locator = page.locator('.inner-tab', { hasText: label }).first()
  await locator.waitFor({ state: 'visible', timeout: 10000 })
  await locator.click()
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  const consoleMessages = []
  const requestFailures = []
  const apiResponses = []

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
    })
  })

  page.on('requestfailed', (req) => {
    requestFailures.push({
      method: req.method(),
      url: req.url(),
      error: req.failure()?.errorText ?? 'request_failed',
    })
  })

  page.on('response', (res) => {
    const url = res.url()
    if (!url.includes('/api/')) {
      return
    }
    apiResponses.push({
      method: res.request().method(),
      url,
      status: res.status(),
      ok: res.ok(),
    })
  })

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1800)

  for (const screen of screenFlow) {
    await clickBottomTab(page, screen.label)
    await page.waitForTimeout(1600)
    await page.screenshot({ path: path.join(outDir, screen.file), fullPage: true })
  }

  await clickBottomTab(page, 'コンディション')
  await page.waitForTimeout(1200)
  for (const tab of conditionInnerTabs) {
    await clickConditionInnerTab(page, tab.label)
    await page.waitForTimeout(1400)
    await page.screenshot({ path: path.join(outDir, tab.file), fullPage: true })
  }

  await browser.close()

  const errorMessages = consoleMessages.filter((item) => item.type === 'error')
  const warnMessages = consoleMessages.filter((item) => item.type === 'warning')
  const failedApiResponses = apiResponses.filter((item) => item.status >= 400)
  const uniqueFailedApiResponses = uniqueBy(failedApiResponses, (item) => `${item.method} ${item.url} ${item.status}`)
  const uniqueRequestFailures = uniqueBy(requestFailures, (item) => `${item.method} ${item.url} ${item.error}`)

  fs.writeFileSync(path.join(outDir, 'console-messages.json'), JSON.stringify(consoleMessages, null, 2), 'utf8')
  fs.writeFileSync(path.join(outDir, 'api-responses.json'), JSON.stringify(apiResponses, null, 2), 'utf8')
  fs.writeFileSync(path.join(outDir, 'request-failures.json'), JSON.stringify(requestFailures, null, 2), 'utf8')

  const summary = {
    checkedAt: new Date().toISOString(),
    baseUrl,
    screenshots: [
      ...screenFlow.map((item) => item.file),
      ...conditionInnerTabs.map((item) => item.file),
    ],
    console: {
      total: consoleMessages.length,
      errors: errorMessages.length,
      warnings: warnMessages.length,
    },
    network: {
      apiTotal: apiResponses.length,
      apiFailed: uniqueFailedApiResponses.length,
      requestFailed: uniqueRequestFailures.length,
    },
    failedApiSamples: uniqueFailedApiResponses.slice(0, 20),
    requestFailureSamples: uniqueRequestFailures.slice(0, 20),
  }

  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
