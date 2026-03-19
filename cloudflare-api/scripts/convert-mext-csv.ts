import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { parse as parseCsv } from 'csv-parse/sync'
import iconv from 'iconv-lite'
import * as XLSX from 'xlsx'

const MEXT_PAGE_URL = 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html'
const DEFAULT_MAIN_SOURCE = 'https://www.mext.go.jp/content/20230428-mxt_kagsei-mext_00001_012.xlsx'
const DEFAULT_FATTY_SOURCE = 'https://www.mext.go.jp/content/20230428-mxt_kagsei-mext_00001_032.xlsx'
const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), 'seed', 'food_master_seed.sql')
const SODIUM_PER_SALT_G = 393.4
const INSERT_BATCH_SIZE = 50

const MICRO_KEYS = [
  'saturated_fat_g',
  'omega3_mg',
  'omega6_mg',
  'trans_fat_g',
  'sugar_g',
  'fiber_g',
  'vitamin_a_ug',
  'vitamin_d_ug',
  'vitamin_e_mg',
  'vitamin_k_ug',
  'vitamin_b1_mg',
  'vitamin_b2_mg',
  'vitamin_b6_mg',
  'vitamin_b12_ug',
  'vitamin_c_mg',
  'niacin_mg',
  'folate_ug',
  'pantothenic_acid_mg',
  'biotin_ug',
  'sodium_mg',
  'potassium_mg',
  'calcium_mg',
  'magnesium_mg',
  'phosphorus_mg',
  'iron_mg',
  'zinc_mg',
  'copper_mg',
  'manganese_mg',
  'selenium_ug',
  'chromium_ug',
  'molybdenum_ug',
  'iodine_ug',
  'cholesterol_mg',
  'purine_mg',
  'caffeine_mg',
  'alcohol_g',
] as const

type MicroKey = (typeof MICRO_KEYS)[number]
type MicrosPayload = Record<MicroKey, number | null>

interface CliOptions {
  inspect: boolean
  inspectBook: number | null
  inspectSheet: string | null
  inspectRows: number
  mainSource: string | null
  fattySource: string | null
  outputPath: string
}

interface FoodMasterRecord {
  foodCode: string
  foodGroupCode: string
  foodGroup: string
  rawName: string
  name: string
  nameKana: string | null
  amount: string
  amountG: number
  per100gKcal: number | null
  per100gProteinG: number | null
  per100gFatG: number | null
  per100gCarbsG: number | null
  per100gMicros: MicrosPayload
}

interface ServingRule {
  id: string
  pattern: RegExp
  amount: string
  grams: number
  aliases?: string[]
}

interface AliasRule {
  pattern: RegExp
  aliases: string[]
}

interface SourcePayload {
  label: string
  source: string
  rows: string[][]
}

const GROUP_NAME_OVERRIDES: Record<string, string> = {
  '01': '穀類',
  '02': 'いも及びでん粉類',
  '03': '砂糖及び甘味類',
  '04': '豆類',
  '05': '種実類',
  '06': '野菜類',
  '07': '果実類',
  '08': 'きのこ類',
  '09': '藻類',
  '10': '魚介類',
  '11': '肉類',
  '12': '卵類',
  '13': '乳類',
  '14': '油脂類',
  '15': '菓子類',
  '16': 'し好飲料類',
  '17': '調味料及び香辛料類',
  '18': '調理済み流通食品類',
}

const SERVING_RULES: ServingRule[] = [
  { id: 'white-rice', pattern: /(?=.*精白米)(?=.*めし)/u, amount: '1杯', grams: 150, aliases: ['白米', 'ごはん', 'ご飯', 'ライス'] },
  { id: 'brown-rice', pattern: /(?=.*玄米)(?=.*めし)/u, amount: '1杯', grams: 150, aliases: ['玄米ごはん'] },
  { id: 'mochi-rice-meal', pattern: /(?=.*もち米)(?=.*めし)/u, amount: '1杯', grams: 150, aliases: ['もち米ごはん'] },
  { id: 'mixed-rice', pattern: /麦ごはん|雑穀ごはん/u, amount: '1杯', grams: 150, aliases: ['雑穀米'] },
  { id: 'rice-ball', pattern: /おにぎり/u, amount: '1個', grams: 110, aliases: ['おむすび'] },
  { id: 'rice-porridge', pattern: /かゆ|粥/u, amount: '1杯', grams: 250 },
  { id: 'toast', pattern: /食パン/u, amount: '1枚', grams: 60, aliases: ['トースト'] },
  { id: 'roll-bread', pattern: /ロールパン/u, amount: '1個', grams: 30 },
  { id: 'baguette', pattern: /フランスパン/u, amount: '1切れ', grams: 30, aliases: ['バゲット'] },
  { id: 'croissant', pattern: /クロワッサン/u, amount: '1個', grams: 40 },
  { id: 'bagel', pattern: /ベーグル/u, amount: '1個', grams: 100 },
  { id: 'udon', pattern: /うどん.*ゆで/u, amount: '1玉', grams: 250, aliases: ['饂飩'] },
  { id: 'soba', pattern: /そば.*ゆで/u, amount: '1玉', grams: 180, aliases: ['蕎麦'] },
  { id: 'ramen', pattern: /中華めん.*ゆで/u, amount: '1玉', grams: 200, aliases: ['ラーメン'] },
  { id: 'spaghetti', pattern: /スパゲッティ.*ゆで/u, amount: '1人前', grams: 250, aliases: ['パスタ'] },
  { id: 'macaroni', pattern: /マカロニ.*ゆで/u, amount: '1人前', grams: 180 },
  { id: 'somen', pattern: /そうめん.*ゆで/u, amount: '1人前', grams: 180 },
  { id: 'hiyamugi', pattern: /ひやむぎ.*ゆで/u, amount: '1人前', grams: 180 },
  { id: 'bifun', pattern: /ビーフン.*ゆで/u, amount: '1人前', grams: 180 },
  { id: 'mochi', pattern: /餅|もち$/u, amount: '1個', grams: 50 },
  { id: 'egg', pattern: /鶏卵|たまご/u, amount: '1個', grams: 50, aliases: ['卵', '玉子', 'たまご'] },
  { id: 'quail-egg', pattern: /うずら卵/u, amount: '1個', grams: 10 },
  { id: 'natto', pattern: /納豆/u, amount: '1パック', grams: 45, aliases: ['なっとう'] },
  { id: 'silken-tofu', pattern: /絹ごし豆腐/u, amount: '1/2丁', grams: 150, aliases: ['豆腐'] },
  { id: 'momen-tofu', pattern: /木綿豆腐/u, amount: '1/2丁', grams: 150, aliases: ['豆腐'] },
  { id: 'aburaage', pattern: /油揚げ/u, amount: '1枚', grams: 20 },
  { id: 'atsuage', pattern: /厚揚げ/u, amount: '1/2枚', grams: 75 },
  { id: 'ganmodoki', pattern: /がんもどき/u, amount: '1個', grams: 80 },
  { id: 'okara', pattern: /おから/u, amount: '1皿', grams: 80 },
  { id: 'soy-milk', pattern: /豆乳/u, amount: '1杯', grams: 200 },
  { id: 'milk', pattern: /牛乳/u, amount: '1杯', grams: 200, aliases: ['ミルク'] },
  { id: 'drink-yogurt', pattern: /飲むヨーグルト/u, amount: '1本', grams: 180 },
  { id: 'yogurt', pattern: /ヨーグルト/u, amount: '1個', grams: 100 },
  { id: 'processed-cheese', pattern: /プロセスチーズ/u, amount: '1切れ', grams: 20, aliases: ['チーズ'] },
  { id: 'natural-cheese', pattern: /ナチュラルチーズ/u, amount: '1切れ', grams: 20, aliases: ['チーズ'] },
  { id: 'chicken-breast', pattern: /鶏.*むね/u, amount: '1枚', grams: 120, aliases: ['鶏むね肉', '鶏胸肉', '鶏胸'] },
  { id: 'chicken-thigh', pattern: /鶏.*もも/u, amount: '1枚', grams: 120, aliases: ['鶏もも肉', '鶏腿肉'] },
  { id: 'chicken-tender', pattern: /鶏.*ささみ/u, amount: '2本', grams: 100, aliases: ['ささみ'] },
  { id: 'beef-shoulder', pattern: /牛.*かた/u, amount: '1枚', grams: 100, aliases: ['牛肩肉'] },
  { id: 'beef-loin', pattern: /牛.*ロース/u, amount: '1枚', grams: 100, aliases: ['牛ロース'] },
  { id: 'beef-thigh', pattern: /牛.*もも/u, amount: '1枚', grams: 100, aliases: ['牛もも肉'] },
  { id: 'pork-loin', pattern: /豚.*ロース/u, amount: '1枚', grams: 100, aliases: ['豚ロース'] },
  { id: 'pork-belly', pattern: /豚.*ばら/u, amount: '1枚', grams: 100, aliases: ['豚バラ肉', '豚ばら肉'] },
  { id: 'pork-thigh', pattern: /豚.*もも/u, amount: '1枚', grams: 100, aliases: ['豚もも肉'] },
  { id: 'ham', pattern: /ハム/u, amount: '2枚', grams: 30 },
  { id: 'bacon', pattern: /ベーコン/u, amount: '2枚', grams: 30 },
  { id: 'sausage', pattern: /ソーセージ|ウインナー/u, amount: '2本', grams: 40 },
  { id: 'tuna', pattern: /まぐろ/u, amount: '5切れ', grams: 100, aliases: ['マグロ', '鮪', 'ツナ'] },
  { id: 'salmon', pattern: /さけ|鮭|サーモン/u, amount: '1切れ', grams: 80 },
  { id: 'mackerel', pattern: /さば|鯖/u, amount: '1切れ', grams: 100 },
  { id: 'yellowtail', pattern: /ぶり|鰤/u, amount: '1切れ', grams: 100 },
  { id: 'horse-mackerel', pattern: /あじ|鯵/u, amount: '1尾', grams: 80 },
  { id: 'sardine', pattern: /いわし|鰯/u, amount: '1尾', grams: 100 },
  { id: 'shirasu', pattern: /しらす/u, amount: '大さじ1', grams: 10 },
  { id: 'shrimp', pattern: /えび|海老/u, amount: '5尾', grams: 75 },
  { id: 'squid', pattern: /いか|烏賊/u, amount: '1/2杯', grams: 100 },
  { id: 'octopus', pattern: /たこ|蛸/u, amount: '1/2杯', grams: 80 },
  { id: 'cabbage', pattern: /キャベツ/u, amount: '1枚', grams: 50 },
  { id: 'lettuce', pattern: /レタス/u, amount: '2枚', grams: 40 },
  { id: 'onion', pattern: /たまねぎ|玉ねぎ/u, amount: '1/2個', grams: 100 },
  { id: 'carrot', pattern: /にんじん|人参/u, amount: '1/2本', grams: 75 },
  { id: 'tomato', pattern: /トマト/u, amount: '1個', grams: 150 },
  { id: 'mini-tomato', pattern: /ミニトマト/u, amount: '5個', grams: 75 },
  { id: 'cucumber', pattern: /きゅうり/u, amount: '1本', grams: 100 },
  { id: 'broccoli', pattern: /ブロッコリー/u, amount: '1/2株', grams: 100 },
  { id: 'spinach', pattern: /ほうれんそう/u, amount: '1/2束', grams: 100, aliases: ['ほうれん草'] },
  { id: 'komatsuna', pattern: /こまつな|小松菜/u, amount: '1/2束', grams: 100 },
  { id: 'potato', pattern: /じゃがいも/u, amount: '1個', grams: 150 },
  { id: 'sweet-potato', pattern: /さつまいも/u, amount: '1本', grams: 200 },
  { id: 'pumpkin', pattern: /かぼちゃ/u, amount: '1/8個', grams: 200 },
  { id: 'banana', pattern: /バナナ/u, amount: '1本', grams: 100 },
  { id: 'apple', pattern: /りんご/u, amount: '1個', grams: 150, aliases: ['林檎'] },
  { id: 'mikan', pattern: /みかん/u, amount: '1個', grams: 80 },
  { id: 'strawberry', pattern: /いちご/u, amount: '5粒', grams: 75, aliases: ['苺'] },
  { id: 'miso-soup', pattern: /みそ汁|味噌汁/u, amount: '1杯', grams: 200 },
  { id: 'soup', pattern: /スープ/u, amount: '1杯', grams: 200 },
  { id: 'curry', pattern: /カレー/u, amount: '1皿', grams: 250 },
  { id: 'stew', pattern: /シチュー/u, amount: '1皿', grams: 250 },
  { id: 'hamburg', pattern: /ハンバーグ/u, amount: '1個', grams: 120 },
  { id: 'croquette', pattern: /コロッケ/u, amount: '1個', grams: 80 },
  { id: 'menchi', pattern: /メンチカツ/u, amount: '1個', grams: 80 },
  { id: 'karaage', pattern: /から揚げ|からあげ|唐揚げ/u, amount: '5個', grams: 125 },
  { id: 'gyoza', pattern: /餃子/u, amount: '5個', grams: 100 },
  { id: 'shumai', pattern: /焼売|しゅうまい/u, amount: '4個', grams: 80 },
  { id: 'okonomiyaki', pattern: /お好み焼き/u, amount: '1枚', grams: 300 },
  { id: 'takoyaki', pattern: /たこ焼き/u, amount: '6個', grams: 180 },
  { id: 'salad', pattern: /サラダ/u, amount: '1皿', grams: 120 },
  { id: 'coffee', pattern: /コーヒー/u, amount: '1杯', grams: 150 },
  { id: 'tea', pattern: /紅茶|緑茶|ほうじ茶|烏龍茶/u, amount: '1杯', grams: 150 },
  { id: 'beer', pattern: /ビール/u, amount: '1缶', grams: 350 },
  { id: 'wine', pattern: /ワイン/u, amount: '1杯', grams: 120 },
]

const ALIAS_RULES: AliasRule[] = [
  { pattern: /精白米.*めし/u, aliases: ['白米', 'ごはん', 'ご飯', 'ライス'] },
  { pattern: /玄米.*めし/u, aliases: ['玄米ごはん'] },
  { pattern: /にわとり|鶏/u, aliases: ['とり', 'チキン'] },
  { pattern: /ぶた|豚/u, aliases: ['ポーク'] },
  { pattern: /うし|牛/u, aliases: ['ビーフ'] },
  { pattern: /まぐろ/u, aliases: ['マグロ', '鮪', 'ツナ'] },
  { pattern: /さけ|鮭/u, aliases: ['サーモン'] },
  { pattern: /さば|鯖/u, aliases: ['サバ'] },
  { pattern: /食パン/u, aliases: ['トースト'] },
  { pattern: /中華めん/u, aliases: ['ラーメン'] },
  { pattern: /スパゲッティ/u, aliases: ['パスタ'] },
  { pattern: /みそ汁|味噌汁/u, aliases: ['味噌汁'] },
]

function parseCliOptions(argv: string[]): CliOptions {
  const readValue = (prefix: string): string | null => argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null
  const inspectBookRaw = readValue('--book=')
  const inspectRowsRaw = readValue('--rows=')
  return {
    inspect: argv.includes('--inspect'),
    inspectBook: inspectBookRaw ? Number.parseInt(inspectBookRaw, 10) : null,
    inspectSheet: readValue('--sheet='),
    inspectRows: inspectRowsRaw ? Number.parseInt(inspectRowsRaw, 10) : 8,
    mainSource: readValue('--main-source='),
    fattySource: readValue('--fatty-source='),
    outputPath: path.resolve(process.cwd(), readValue('--out=') ?? DEFAULT_OUTPUT_PATH),
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  return response.text()
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function loadBuffer(source: string): Promise<Buffer> {
  if (/^https?:\/\//iu.test(source)) {
    return fetchBuffer(source)
  }
  return readFile(path.resolve(process.cwd(), source))
}

function resolveContentUrl(href: string): string {
  return new URL(href, MEXT_PAGE_URL).toString()
}

function findDownloadLinks(html: string): string[] {
  const matches = [...html.matchAll(/href="([^"]+\.(?:xlsx?|csv))"/giu)]
  return matches.map((match) => resolveContentUrl(match[1]))
}

function pickSource(links: string[], pattern: RegExp, fallback: string): string {
  return links.find((link) => pattern.test(link)) ?? fallback
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[　\t]+/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeMatchText(value: string): string {
  return normalizeWhitespace(value)
    .replace(/[［\[]/g, ' ')
    .replace(/[］\]]/g, ' ')
    .replace(/[＜<]/g, ' ')
    .replace(/[＞>]/g, ' ')
    .replace(/[（）()]/g, ' ')
    .replace(/[・]/g, ' ')
    .replace(/[‐－―ー]/g, '-')
    .replace(/\s+/g, '')
}

function cleanFoodName(rawName: string): string {
  const withoutCategory = normalizeWhitespace(rawName).replace(/^＜[^＞]+＞\s*/u, '')
  const bracketExpanded = withoutCategory.replace(/［([^］]+)］/gu, ' $1 ')
  return normalizeWhitespace(
    bracketExpanded
      .replace(/にわとり/gu, '鶏')
      .replace(/ぶた/gu, '豚')
      .replace(/うし/gu, '牛')
      .replace(/こめ/gu, '米')
      .replace(/おおむぎ/gu, '大麦'),
  )
}

function padFoodCode(value: string): string {
  return value.trim().padStart(5, '0')
}

function buildGroupNameMap(sheetNames: string[]): Record<string, string> {
  const map: Record<string, string> = { ...GROUP_NAME_OVERRIDES }
  for (const sheetName of sheetNames) {
    const normalized = normalizeWhitespace(sheetName)
    const match = normalized.match(/^(\d{1,2})(.+)$/u)
    if (!match) {
      continue
    }
    const code = match[1].padStart(2, '0')
    map[code] = normalizeWhitespace(match[2]).replace(/\s+/g, '')
  }
  return map
}

function emptyMicros(): MicrosPayload {
  return Object.fromEntries(MICRO_KEYS.map((key) => [key, null])) as MicrosPayload
}

function roundValue(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }
  return Math.round(value * 1000) / 1000
}

function parseNutrientValue(raw: string | undefined): number | null {
  const normalized = normalizeWhitespace(String(raw ?? ''))
  if (!normalized || normalized === '-' || normalized === '*' || normalized === '…') {
    return null
  }
  const trimmedBrackets = normalized
    .replace(/^[（(]/u, '')
    .replace(/[）)]$/u, '')
    .trim()
  const lowered = trimmedBrackets.toLowerCase()
  if (!trimmedBrackets || trimmedBrackets === '-' || trimmedBrackets === '*') {
    return null
  }
  if (lowered === 'tr') {
    return 0
  }
  if (trimmedBrackets === '0') {
    return 0
  }
  const parsed = Number.parseFloat(trimmedBrackets)
  return Number.isFinite(parsed) ? parsed : null
}

function findCodeRowIndex(rows: string[][], requiredCode: string): number {
  const index = rows.findIndex((row) => row.some((cell) => normalizeWhitespace(cell) === requiredCode))
  if (index === -1) {
    throw new Error(`Component code row not found for ${requiredCode}`)
  }
  return index
}

function findDataStartIndex(rows: string[][], fallbackStart: number): number {
  const index = rows.findIndex((row, rowIndex) => {
    if (rowIndex < fallbackStart) {
      return false
    }
    return /^\d{2}$/u.test(normalizeWhitespace(row[0] ?? '')) && /^\d{5}$/u.test(normalizeWhitespace(row[1] ?? ''))
  })
  if (index === -1) {
    throw new Error('Food data rows not found')
  }
  return index
}

function buildComponentIndexMap(codeRow: string[]): Map<string, number> {
  const map = new Map<string, number>()
  codeRow.forEach((cell, index) => {
    const normalized = normalizeWhitespace(cell)
    if (normalized) {
      map.set(normalized, index)
    }
  })
  return map
}

function readRequiredColumn(map: Map<string, number>, code: string): number {
  const index = map.get(code)
  if (index == null) {
    throw new Error(`Column ${code} not found`)
  }
  return index
}

async function loadTabularSource(source: string): Promise<SourcePayload> {
  const buffer = await loadBuffer(source)
  const extension = path.extname(new URL(source, 'https://dummy.invalid').pathname).toLowerCase()

  if (extension === '.csv') {
    const decoded = iconv.decode(buffer, 'shift_jis')
    const rows = parseCsv(decoded, { relax_column_count: true, skip_empty_lines: false }) as string[][]
    return { label: path.basename(source), source, rows }
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames.includes('表全体') ? '表全体' : workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  }) as string[][]

  return { label: sheetName, source, rows }
}

function buildSearchTerms(rawName: string, cleanedName: string): string[] {
  const terms = new Set<string>()
  const add = (value: string) => {
    const normalized = normalizeWhitespace(value)
    if (!normalized) {
      return
    }
    terms.add(normalized)
    terms.add(normalized.replace(/\s+/g, ''))
  }

  add(rawName)
  add(cleanedName)

  const compact = normalizeMatchText(cleanedName)
  for (const rule of SERVING_RULES) {
    if (rule.pattern.test(compact)) {
      rule.aliases?.forEach(add)
    }
  }
  for (const rule of ALIAS_RULES) {
    if (rule.pattern.test(cleanedName)) {
      rule.aliases.forEach(add)
    }
  }

  if (/鶏/u.test(cleanedName) && /むね/u.test(cleanedName)) {
    ['鶏むね肉', '鶏胸肉', '鶏胸', 'とりむね', 'チキンブレスト'].forEach(add)
  }
  if (/鶏/u.test(cleanedName) && /もも/u.test(cleanedName)) {
    ['鶏もも肉', '鶏腿肉', 'とりもも'].forEach(add)
  }
  if (/豚/u.test(cleanedName) && /ロース/u.test(cleanedName)) {
    ['豚ロース', 'ポークロース'].forEach(add)
  }
  if (/牛/u.test(cleanedName) && /ロース/u.test(cleanedName)) {
    ['牛ロース', 'ビーフロース'].forEach(add)
  }
  if (/精白米/u.test(cleanedName) && /めし/u.test(cleanedName)) {
    ['白米', 'ごはん', 'ご飯', 'ライス'].forEach(add)
  }

  return [...terms]
}

function chooseServing(name: string): { amount: string; grams: number } {
  const compact = normalizeMatchText(name)
  for (const rule of SERVING_RULES) {
    if (rule.pattern.test(compact)) {
      return { amount: rule.amount, grams: rule.grams }
    }
  }
  return { amount: '100g', grams: 100 }
}

function scaleByAmount(value: number | null, amountG: number): number | null {
  if (value == null) {
    return null
  }
  return roundValue((value * amountG) / 100)
}

function convertSaltToSodium(saltG: number | null): number | null {
  if (saltG == null) {
    return null
  }
  return roundValue(saltG * SODIUM_PER_SALT_G)
}

function scaleMicrosByAmount(micros: MicrosPayload, amountG: number): MicrosPayload {
  const scaled = emptyMicros()
  for (const key of MICRO_KEYS) {
    scaled[key] = scaleByAmount(micros[key], amountG)
  }
  return scaled
}

function parseMainRecords(payload: SourcePayload, groupNameMap: Record<string, string>): Map<string, FoodMasterRecord> {
  const rows = payload.rows
  const codeRowIndex = findCodeRowIndex(rows, 'ENERC_KCAL')
  const codeRow = rows[codeRowIndex] ?? []
  const columns = buildComponentIndexMap(codeRow)
  const dataStartIndex = findDataStartIndex(rows, codeRowIndex + 1)

  const kcalCol = readRequiredColumn(columns, 'ENERC_KCAL')
  const proteinCol = readRequiredColumn(columns, 'PROT-')
  const fatCol = readRequiredColumn(columns, 'FAT-')
  const carbsCol = readRequiredColumn(columns, 'CHOCDF-')
  const cholesterolCol = readRequiredColumn(columns, 'CHOLE')
  const sodiumCol = readRequiredColumn(columns, 'NA')
  const potassiumCol = readRequiredColumn(columns, 'K')
  const calciumCol = readRequiredColumn(columns, 'CA')
  const magnesiumCol = readRequiredColumn(columns, 'MG')
  const phosphorusCol = readRequiredColumn(columns, 'P')
  const ironCol = readRequiredColumn(columns, 'FE')
  const zincCol = readRequiredColumn(columns, 'ZN')
  const copperCol = readRequiredColumn(columns, 'CU')
  const manganeseCol = readRequiredColumn(columns, 'MN')
  const iodineCol = readRequiredColumn(columns, 'ID')
  const seleniumCol = readRequiredColumn(columns, 'SE')
  const chromiumCol = readRequiredColumn(columns, 'CR')
  const molybdenumCol = readRequiredColumn(columns, 'MO')
  const vitaminACol = readRequiredColumn(columns, 'VITA_RAE')
  const vitaminDCol = readRequiredColumn(columns, 'VITD')
  const vitaminECol = readRequiredColumn(columns, 'TOCPHA')
  const vitaminKCol = readRequiredColumn(columns, 'VITK')
  const vitaminB1Col = readRequiredColumn(columns, 'THIA')
  const vitaminB2Col = readRequiredColumn(columns, 'RIBF')
  const niacinEqCol = readRequiredColumn(columns, 'NE')
  const vitaminB6Col = readRequiredColumn(columns, 'VITB6A')
  const vitaminB12Col = readRequiredColumn(columns, 'VITB12')
  const folateCol = readRequiredColumn(columns, 'FOL')
  const pantothenicCol = readRequiredColumn(columns, 'PANTAC')
  const biotinCol = readRequiredColumn(columns, 'BIOT')
  const vitaminCCol = readRequiredColumn(columns, 'VITC')
  const fiberCol = readRequiredColumn(columns, 'FIB-')
  const alcoholCol = readRequiredColumn(columns, 'ALC')
  const saltEqCol = readRequiredColumn(columns, 'NACL_EQ')

  const records = new Map<string, FoodMasterRecord>()
  for (const row of rows.slice(dataStartIndex)) {
    const foodGroupCode = normalizeWhitespace(row[0] ?? '').padStart(2, '0')
    const foodCode = padFoodCode(row[1] ?? '')
    const rawName = normalizeWhitespace(row[3] ?? '')
    if (!foodGroupCode || !foodCode || !rawName) {
      continue
    }

    const name = cleanFoodName(rawName)
    const serving = chooseServing(name)
    const searchTerms = buildSearchTerms(rawName, name)

    const per100gMicros = emptyMicros()
    const sodiumFromSalt = convertSaltToSodium(parseNutrientValue(row[saltEqCol]))
    per100gMicros.sodium_mg = sodiumFromSalt ?? roundValue(parseNutrientValue(row[sodiumCol]))
    per100gMicros.potassium_mg = roundValue(parseNutrientValue(row[potassiumCol]))
    per100gMicros.calcium_mg = roundValue(parseNutrientValue(row[calciumCol]))
    per100gMicros.magnesium_mg = roundValue(parseNutrientValue(row[magnesiumCol]))
    per100gMicros.phosphorus_mg = roundValue(parseNutrientValue(row[phosphorusCol]))
    per100gMicros.iron_mg = roundValue(parseNutrientValue(row[ironCol]))
    per100gMicros.zinc_mg = roundValue(parseNutrientValue(row[zincCol]))
    per100gMicros.copper_mg = roundValue(parseNutrientValue(row[copperCol]))
    per100gMicros.manganese_mg = roundValue(parseNutrientValue(row[manganeseCol]))
    per100gMicros.selenium_ug = roundValue(parseNutrientValue(row[seleniumCol]))
    per100gMicros.chromium_ug = roundValue(parseNutrientValue(row[chromiumCol]))
    per100gMicros.molybdenum_ug = roundValue(parseNutrientValue(row[molybdenumCol]))
    per100gMicros.iodine_ug = roundValue(parseNutrientValue(row[iodineCol]))
    per100gMicros.vitamin_a_ug = roundValue(parseNutrientValue(row[vitaminACol]))
    per100gMicros.vitamin_d_ug = roundValue(parseNutrientValue(row[vitaminDCol]))
    per100gMicros.vitamin_e_mg = roundValue(parseNutrientValue(row[vitaminECol]))
    per100gMicros.vitamin_k_ug = roundValue(parseNutrientValue(row[vitaminKCol]))
    per100gMicros.vitamin_b1_mg = roundValue(parseNutrientValue(row[vitaminB1Col]))
    per100gMicros.vitamin_b2_mg = roundValue(parseNutrientValue(row[vitaminB2Col]))
    per100gMicros.vitamin_b6_mg = roundValue(parseNutrientValue(row[vitaminB6Col]))
    per100gMicros.vitamin_b12_ug = roundValue(parseNutrientValue(row[vitaminB12Col]))
    per100gMicros.niacin_mg = roundValue(parseNutrientValue(row[niacinEqCol]))
    per100gMicros.folate_ug = roundValue(parseNutrientValue(row[folateCol]))
    per100gMicros.pantothenic_acid_mg = roundValue(parseNutrientValue(row[pantothenicCol]))
    per100gMicros.biotin_ug = roundValue(parseNutrientValue(row[biotinCol]))
    per100gMicros.vitamin_c_mg = roundValue(parseNutrientValue(row[vitaminCCol]))
    per100gMicros.fiber_g = roundValue(parseNutrientValue(row[fiberCol]))
    per100gMicros.cholesterol_mg = roundValue(parseNutrientValue(row[cholesterolCol]))
    per100gMicros.alcohol_g = roundValue(parseNutrientValue(row[alcoholCol]))

    records.set(foodCode, {
      foodCode,
      foodGroupCode,
      foodGroup: groupNameMap[foodGroupCode] ?? GROUP_NAME_OVERRIDES[foodGroupCode] ?? foodGroupCode,
      rawName,
      name,
      nameKana: searchTerms.join(' '),
      amount: serving.amount,
      amountG: serving.grams,
      per100gKcal: roundValue(parseNutrientValue(row[kcalCol])),
      per100gProteinG: roundValue(parseNutrientValue(row[proteinCol])),
      per100gFatG: roundValue(parseNutrientValue(row[fatCol])),
      per100gCarbsG: roundValue(parseNutrientValue(row[carbsCol])),
      per100gMicros,
    })
  }

  return records
}

function parseFattyMicros(payload: SourcePayload): Map<string, Partial<MicrosPayload>> {
  const rows = payload.rows
  const codeRowIndex = findCodeRowIndex(rows, 'FASAT')
  const codeRow = rows[codeRowIndex] ?? []
  const columns = buildComponentIndexMap(codeRow)
  const dataStartIndex = findDataStartIndex(rows, codeRowIndex + 1)

  const saturatedCol = readRequiredColumn(columns, 'FASAT')
  const omega3Col = readRequiredColumn(columns, 'FAPUN3')
  const omega6Col = readRequiredColumn(columns, 'FAPUN6')

  const map = new Map<string, Partial<MicrosPayload>>()
  for (const row of rows.slice(dataStartIndex)) {
    const foodCode = padFoodCode(row[1] ?? '')
    const rawName = normalizeWhitespace(row[3] ?? '')
    if (!foodCode || !rawName) {
      continue
    }
    map.set(foodCode, {
      saturated_fat_g: roundValue(parseNutrientValue(row[saturatedCol])),
      omega3_mg: roundValue(scaleByAmount(parseNutrientValue(row[omega3Col]), 1000)),
      omega6_mg: roundValue(scaleByAmount(parseNutrientValue(row[omega6Col]), 1000)),
    })
  }
  return map
}

function serializeMicros(micros: MicrosPayload): string {
  const ordered = Object.fromEntries(MICRO_KEYS.map((key) => [key, micros[key]]))
  return JSON.stringify(ordered)
}

function sqlNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return 'NULL'
  }
  return String(value)
}

function sqlText(value: string | null): string {
  if (value == null) {
    return 'NULL'
  }
  return `'${value.replace(/'/g, "''")}'`
}

function buildInsertStatements(records: FoodMasterRecord[]): string[] {
  const statements: string[] = []
  const columns = [
    'food_code',
    'food_group',
    'name',
    'name_kana',
    'amount',
    'amount_g',
    'kcal',
    'protein_g',
    'fat_g',
    'carbs_g',
    'micros_json',
    'per100g_kcal',
    'per100g_protein_g',
    'per100g_fat_g',
    'per100g_carbs_g',
    'per100g_micros_json',
  ]

  for (let index = 0; index < records.length; index += INSERT_BATCH_SIZE) {
    const batch = records.slice(index, index + INSERT_BATCH_SIZE)
    const valuesSql = batch
      .map((record) => {
        const microsForAmount = scaleMicrosByAmount(record.per100gMicros, record.amountG)
        return `  (${[
          sqlText(record.foodCode),
          sqlText(record.foodGroup),
          sqlText(record.name),
          sqlText(record.nameKana),
          sqlText(record.amount),
          sqlNumber(record.amountG),
          sqlNumber(scaleByAmount(record.per100gKcal, record.amountG)),
          sqlNumber(scaleByAmount(record.per100gProteinG, record.amountG)),
          sqlNumber(scaleByAmount(record.per100gFatG, record.amountG)),
          sqlNumber(scaleByAmount(record.per100gCarbsG, record.amountG)),
          sqlText(serializeMicros(microsForAmount)),
          sqlNumber(record.per100gKcal),
          sqlNumber(record.per100gProteinG),
          sqlNumber(record.per100gFatG),
          sqlNumber(record.per100gCarbsG),
          sqlText(serializeMicros(record.per100gMicros)),
        ].join(', ')})`
      })
      .join(',\n')

    statements.push(`INSERT INTO food_master (${columns.join(', ')}) VALUES\n${valuesSql};`)
  }

  return statements
}

function mergeRecords(mainRecords: Map<string, FoodMasterRecord>, fattyMap: Map<string, Partial<MicrosPayload>>): FoodMasterRecord[] {
  const merged: FoodMasterRecord[] = []
  for (const record of mainRecords.values()) {
    const fatty = fattyMap.get(record.foodCode)
    if (fatty) {
      if (fatty.saturated_fat_g != null) {
        record.per100gMicros.saturated_fat_g = fatty.saturated_fat_g
      }
      if (fatty.omega3_mg != null) {
        record.per100gMicros.omega3_mg = fatty.omega3_mg
      }
      if (fatty.omega6_mg != null) {
        record.per100gMicros.omega6_mg = fatty.omega6_mg
      }
    }
    merged.push(record)
  }
  return merged.sort((left, right) => left.foodCode.localeCompare(right.foodCode, 'ja'))
}

function logWorkbook(label: string, workbook: XLSX.WorkBook, rowsToShow: number, sheetFilter: string | null): void {
  console.log(`\n[${label}]`)
  console.log(`sheets=${workbook.SheetNames.join(', ')}`)
  for (const sheetName of workbook.SheetNames) {
    if (sheetFilter && sheetName !== sheetFilter) {
      continue
    }
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][]
    console.log(`sheet=${sheetName} rows=${rows.length}`)
    console.log(JSON.stringify(rows.slice(0, rowsToShow), null, 2))
  }
}

async function runInspect(options: CliOptions): Promise<void> {
  const html = await fetchText(MEXT_PAGE_URL)
  const links = findDownloadLinks(html)
  console.log('download_links')
  for (const link of links) {
    console.log(link)
  }

  for (const [index, link] of links.entries()) {
    if (options.inspectBook != null && options.inspectBook !== index + 1) {
      continue
    }
    const buffer = await fetchBuffer(link)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    logWorkbook(`book_${index + 1}`, workbook, Number.isFinite(options.inspectRows) ? options.inspectRows : 8, options.inspectSheet)
  }
}

async function resolveSources(options: CliOptions): Promise<{ mainSource: string; fattySource: string; groupNameMap: Record<string, string> }> {
  const html = await fetchText(MEXT_PAGE_URL)
  const links = findDownloadLinks(html)
  const mainSource = options.mainSource ?? pickSource(links, /_012\.(?:xlsx|csv)$/iu, DEFAULT_MAIN_SOURCE)
  const fattySource = options.fattySource ?? pickSource(links, /_032\.(?:xlsx|csv)$/iu, DEFAULT_FATTY_SOURCE)

  const mainWorkbookBuffer = await fetchBuffer(mainSource)
  const mainWorkbook = XLSX.read(mainWorkbookBuffer, { type: 'buffer' })
  const groupNameMap = buildGroupNameMap(mainWorkbook.SheetNames)

  return { mainSource, fattySource, groupNameMap }
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))

  if (options.inspect) {
    await runInspect(options)
    return
  }

  const { mainSource, fattySource, groupNameMap } = await resolveSources(options)
  const mainPayload = await loadTabularSource(mainSource)
  const fattyPayload = await loadTabularSource(fattySource)
  const mainRecords = parseMainRecords(mainPayload, groupNameMap)
  const fattyMap = parseFattyMicros(fattyPayload)
  const mergedRecords = mergeRecords(mainRecords, fattyMap)
  const insertStatements = buildInsertStatements(mergedRecords)

  const sql = [
    '-- Generated by scripts/convert-mext-csv.ts',
    `-- Main source: ${mainSource}`,
    `-- Fatty acid source: ${fattySource}`,
    `-- Generated at: ${new Date().toISOString()}`,
    '',
    'DELETE FROM food_master;',
    '',
    ...insertStatements,
    '',
  ].join('\n')

  await mkdir(path.dirname(options.outputPath), { recursive: true })
  await writeFile(options.outputPath, sql, 'utf8')

  console.log(`generated_records=${mergedRecords.length}`)
  console.log(`output=${options.outputPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
