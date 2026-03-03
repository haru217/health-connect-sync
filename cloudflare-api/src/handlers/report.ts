import { DEFAULT_LLM_MODEL, DEFAULT_LLM_PROVIDER, LLM_TIMEOUT_MS, REPORT_EMOJI_RE } from '../constants'
import type { AnthropicMessageResponse, D1Database, DailyReportGeneratedPayload, DailyReportRow, Env, GeminiResponse, OpenAICompatibleResponse, UserProfileRow } from '../types'
import { execute, isValidDate, jsonResponse, nowIso, parseBooleanFlag, queryAll, queryFirst, shiftIsoDateByDays, toIsoDate } from '../utils'
import { getUserProfile } from './profile'
import { getScores } from './scores'
import { average } from './health'
import { ensureAggregatesUpToDate } from './sync-aggregate'

export async function readOptionalJsonBody(request: Request, maxBytes = 65536): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10)
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new Error('Request body too large')
    }
    if (Number.isFinite(parsedLength) && parsedLength <= 0) {
      return {}
    }
  }

  const raw = await request.text()
  if (!raw.trim()) {
    return {}
  }
  if (raw.length > maxBytes) {
    throw new Error('Request body too large')
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Body must be an object')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON body'
    throw new Error(`Invalid request body: ${message}`)
  }
}

interface DailyReportTrendRow {
  date: string
  steps: number | null
  sleep_hours: number | null
  weight_kg: number | null
  blood_systolic: number | null
  blood_diastolic: number | null
  intake_kcal: number | null
  active_kcal: number | null
  total_kcal: number | null
}

interface DailyReportGenerationResult {
  payload: DailyReportGeneratedPayload
  model: string
  prompt_tokens: number | null
  completion_tokens: number | null
}

interface DailyReportGenerationOptions {
  force?: boolean
  provider?: string
  apiKey?: string
  model?: string
}

interface DailyReportPersistInput extends DailyReportGeneratedPayload {
  date: string
  model: string
  prompt_tokens: number | null
  completion_tokens: number | null
  generated_at: string
}

export function stripReportEmoji(value: string): string {
  return value.replace(REPORT_EMOJI_RE, '')
}

export function normalizeDailyReportText(value: unknown, field: string, minLength = 20, maxLength = 320): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`)
  }
  const normalized = stripReportEmoji(value).replace(/\s+/g, ' ').trim()
  if (!normalized) {
    throw new Error(`${field} must not be empty`)
  }
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new Error(`${field} length is out of range`)
  }
  return normalized
}

export function extractJsonObjectCandidate(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) {
    return fenced[1].trim()
  }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || start >= end) {
    throw new Error('LLM response did not include a JSON object')
  }
  return raw.slice(start, end + 1).trim()
}

export function parseDailyReportGeneratedPayload(raw: string): DailyReportGeneratedPayload {
  const candidate = extractJsonObjectCandidate(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    throw new Error('LLM response is not valid JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('LLM response JSON must be an object')
  }

  const root = parsed as Record<string, unknown>
  const home = root.home
  const tabs = root.tabs
  if (!home || typeof home !== 'object' || Array.isArray(home)) {
    throw new Error('LLM response must include home object')
  }
  if (!tabs || typeof tabs !== 'object' || Array.isArray(tabs)) {
    throw new Error('LLM response must include tabs object')
  }

  const homeObject = home as Record<string, unknown>
  const tabsObject = tabs as Record<string, unknown>

  return {
    headline: normalizeDailyReportText(root.headline, 'headline', 5, 120),
    yu_comment: normalizeDailyReportText(homeObject.yu, 'home.yu', 20, 320),
    saki_comment: normalizeDailyReportText(homeObject.saki, 'home.saki', 20, 320),
    mai_comment: normalizeDailyReportText(homeObject.mai, 'home.mai', 20, 320),
    condition_comment: normalizeDailyReportText(tabsObject.condition, 'tabs.condition', 20, 320),
    activity_comment: normalizeDailyReportText(tabsObject.activity, 'tabs.activity', 20, 320),
    meal_comment: normalizeDailyReportText(tabsObject.meal, 'tabs.meal', 20, 320),
  }
}

export function buildSeasonContext(date: string): Record<string, string> {
  const month = Number.parseInt(date.slice(5, 7), 10)
  if (month >= 3 && month <= 5) {
    return {
      season: '春',
      context: '寒暖差と花粉の影響が出やすい時期です。水分補給と睡眠の質を意識してください。',
    }
  }
  if (month >= 6 && month <= 8) {
    return {
      season: '夏',
      context: '暑さで体力を消耗しやすい時期です。脱水と睡眠不足に注意してください。',
    }
  }
  if (month >= 9 && month <= 11) {
    return {
      season: '秋',
      context: '活動しやすい季節です。運動習慣を定着させる好機です。',
    }
  }
  return {
    season: '冬',
    context: '冷えと乾燥で体調が揺らぎやすい時期です。血圧管理と保温を重視してください。',
  }
}

export function buildTrendSummary(rows: DailyReportTrendRow[]): Record<string, unknown> {
  const latest = rows[rows.length - 1] ?? null
  const first = rows[0] ?? null
  const avgSteps = average(rows.map((row) => row.steps))
  const avgSleepHours = average(rows.map((row) => row.sleep_hours))
  const avgIntakeKcal = average(rows.map((row) => row.intake_kcal))
  const avgActiveKcal = average(rows.map((row) => row.active_kcal))
  const avgSystolic = average(rows.map((row) => row.blood_systolic))
  const avgDiastolic = average(rows.map((row) => row.blood_diastolic))
  const latestWeight = latest?.weight_kg ?? null
  const firstWeight = first?.weight_kg ?? null
  const weightDiff =
    latestWeight != null && firstWeight != null ? Number((latestWeight - firstWeight).toFixed(2)) : null

  return {
    observed_days: rows.length,
    latest: latest
      ? {
          ...latest,
        }
      : null,
    averages: {
      steps: avgSteps == null ? null : Math.round(avgSteps),
      sleep_hours: avgSleepHours == null ? null : Number(avgSleepHours.toFixed(2)),
      intake_kcal: avgIntakeKcal == null ? null : Math.round(avgIntakeKcal),
      active_kcal: avgActiveKcal == null ? null : Math.round(avgActiveKcal),
      blood_pressure: avgSystolic == null || avgDiastolic == null ? null : `${Math.round(avgSystolic)}/${Math.round(avgDiastolic)}`,
    },
    change: {
      steps:
        latest?.steps != null && first?.steps != null
          ? Math.round(latest.steps - first.steps)
          : null,
      sleep_hours:
        latest?.sleep_hours != null && first?.sleep_hours != null
          ? Number((latest.sleep_hours - first.sleep_hours).toFixed(2))
          : null,
      weight_kg: weightDiff,
    },
  }
}

export function buildDailyReportPrompt(params: {
  date: string
  season: Record<string, string>
  profile: UserProfileRow
  scores: Record<string, unknown>
  trendRows: DailyReportTrendRow[]
}): { systemPrompt: string; userPrompt: string } {
  const { date, season, profile, scores, trendRows } = params
  const trendSummary = buildTrendSummary(trendRows)

  const systemPrompt = [
    'あなたは健康管理アプリ「Health OS」の専属AIライターです。',
    'ユーザーの健康データを読み取り、3人の専門家キャラクターになりきって日次コメントを生成します。',
    '',
    '# 絶対ルール',
    '- 出力はJSON1つだけ。前後に文章・説明・マークダウンフェンスを付けない',
    '- 提供されたデータに基づく事実だけを書く。数値を作らない、診断しない',
    '- 「ダメ」「やめて」「〜してはいけない」など否定表現は禁止。肯定的な言い換えにする',
    '- 絵文字は一切使わない',
    '- 各コメントは80〜150文字（日本語）',
    '- データがnullの領域は触れずにスキップする',
    '',
    '# 比較の基準',
    '- 「高め」「低め」「改善」「悪化」を判断する基準は、医学基準ではなくユーザー個人の14日平均（ベースライン）を使う',
    '- 例: 血圧の14日平均が132/82で今日が129/86なら「平均より少し下がっています」が正しい',
    '- 医学的な正常値に触れる場合は「一般的な基準では〜」と明示する',
    '',
    '# コメントの構成ルール',
    '- 各コメントは「事実の確認→ポジティブな解釈or具体的な提案」の順にする',
    '- 数値が悪くても、まず客観的に事実を述べ、次に具体的で実行可能なアクションを1つ提案する',
    '- 「頑張りましょう」「意識しましょう」のような抽象的な励ましは避け、具体的な行動を提案する',
    '  - 悪い例: 「歩数を増やす工夫を始めてみましょう」',
    '  - 良い例: 「昼食後に10分だけ近所を歩くと、無理なく2000歩ほど上乗せできますよ」',
    '',
    '# home と tabs の役割分担',
    '- home（ホーム画面）: その専門家が今日一番伝えたいこと1つに絞る。概要として機能する',
    '- tabs（タブ画面）: homeとは別の切り口で書く。具体的なデータ比較・トレンド分析・行動提案を含める',
    '- homeとtabsで同じ話題を繰り返してはならない。例えばhomeで血圧に触れたら、tabsでは体重や心拍など別の指標に焦点を当てる',
  ].join('\n')

  const userPrompt = [
    `# 対象日: ${date}`,
    `季節: ${season.season}（${season.context}）`,
    '',
    '---',
    '# ユーザー情報',
    `- 年齢: ${profile.age ?? '不明'}歳、性別: ${profile.gender === 'male' ? '男性' : profile.gender === 'female' ? '女性' : '未設定'}`,
    `- 身長: ${profile.height_cm ?? '不明'}cm、目標体重: ${profile.goal_weight_kg ?? '未設定'}kg`,
    `- 歩数目標: ${profile.steps_goal ?? '未設定'}歩/日、睡眠目標: ${profile.sleep_goal_minutes ? `${Math.round(profile.sleep_goal_minutes / 60)}時間` : '未設定'}`,
    `- 運動頻度: ${profile.exercise_freq ?? '未設定'}、運動種目: ${profile.exercise_type ?? '未設定'}`,
    '',
    '---',
    '# 今日のスコア（0〜100点、高いほど良い）',
    `- 総合: ${(scores as Record<string, unknown>).overall ? JSON.stringify((scores as Record<string, unknown>).overall) : 'データなし'}`,
    `- 各領域: ${JSON.stringify((scores as Record<string, unknown>).domains)}`,
    `  - score: 0-100の点数。80以上=良好(green)、50-79=注意(yellow)、50未満=要改善(red)、null=データなし`,
    `- 14日平均スコア（ベースライン）: ${JSON.stringify((scores as Record<string, unknown>).baseline)}`,
    '',
    '# 気づき（ルールエンジンが検出した注目ポイント）',
    `${JSON.stringify((scores as Record<string, unknown>).insights)}`,
    '- type: "positive"=良い傾向, "attention"=注意, "threshold"=基準値超過',
    '',
    '# 過去14日トレンド',
    JSON.stringify(trendSummary),
    '- averages: 14日間の平均値',
    '- change: 初日→最新日の変化量（正=増加、負=減少）',
    '',
    '---',
    '# キャラクター定義',
    '',
    '## ユウ先生（内科医・男性）',
    '担当: homeのyuコメント + tabsのconditionコメント',
    'トーン: 穏やかで安心感がある。データを噛み砕いて丁寧に伝える。',
    '特徴: 14日平均との比較で「改善/横ばい/注意」を正確に判定する。季節と体調の関連を自然に織り込む。',
    '注意: 血圧が14日平均より下がっていれば「改善傾向」と書く。平均より上がっていれば「やや上がっている」と書く。方向を間違えない。',
    'homeの書き方: 今日のコンディションで一番伝えたいことを1つ。安心感を与える締め。',
    'tabsの書き方: homeで触れなかった指標のトレンド分析。14日間の変化と具体的な生活改善提案。',
    '例文: 「今日の血圧は14日平均より少し下がっていますね。この調子で減塩を続けていけば、安定したラインに近づいていきますよ。」',
    '',
    '## サキさん（管理栄養士・女性）',
    '担当: homeのsakiコメント + tabsのmealコメント',
    'トーン: 明るく親しみやすい。旬の食材や具体的なメニュー提案が得意。',
    '特徴: 制限ではなく「こうすると美味しいですよ」という提案型。季節の食材を具体的なメニュー名で提案する。',
    'homeの書き方: 今日の食事状況をサッと触れて、旬の食材を使った具体的な一品を提案。',
    'tabsの書き方: カロリーバランスや栄養面のトレンドを分析し、1週間単位での食事パターン改善を提案。',
    '食事記録がない場合: 「記録がない」とだけ指摘せず、記録することのメリットと、今日食べると良い具体メニューを提案する。',
    '例文: 「たんぱく質がしっかり摂れていますね。今の時期は新玉ねぎが甘くて美味しいので、スライスしてかつお節をのせるだけで立派な一品になりますよ。」',
    '',
    '## マイコーチ（パーソナルトレーナー・女性）',
    '担当: homeのmaiコメント + tabsのactivityコメント',
    'トーン: ポジティブで励まし上手。コーチとして具体的なメニューを提案する。',
    '特徴: ユーザーの運動種目・頻度を踏まえて、今日できる具体的な運動を1つ提案する。',
    '重要: 「歩数が少ない」「目標未達」という事実の報告だけではAIの価値がない。コーチとして「今日これをやろう」という具体的アクションを必ず含める。',
    `  - ユーザーの運動種目: ${profile.exercise_type ?? '未設定'}`,
    `  - ユーザーの運動頻度: ${profile.exercise_freq ?? '未設定'}`,
    'homeの書き方: 今日の活動で良かった点を見つけて褒め、+αの具体アクション1つ。',
    'tabsの書き方: 14日間の活動トレンドを分析し、週間での運動リズムを提案。歩数だけでなく消費カロリーや距離も活用。',
    '歩数が極端に少ない日: 「歩数が少ない」と繰り返さず、「今日は室内で過ごす日のようですね」と受け入れた上で、室内でできるストレッチや筋トレを提案する。',
    '例文: 「今日は室内中心の一日だったようですね。夕食前に5分だけスクワットとストレッチをすると、明日の身体が軽くなりますよ。」',
    '',
    '---',
    '# 出力フォーマット（このJSON構造を厳守）',
    JSON.stringify(
      {
        headline: '全体の状態を一言で（15〜30文字）',
        home: {
          yu: 'ユウ先生の総合コメント（80〜150文字）',
          saki: 'サキさんの栄養コメント（80〜150文字）',
          mai: 'マイコーチの運動コメント（80〜150文字）',
        },
        tabs: {
          condition: 'ユウ先生が書くコンディション詳細（80〜150文字）',
          activity: 'マイコーチが書く運動詳細（80〜150文字）',
          meal: 'サキさんが書く食事詳細（80〜150文字）',
        },
      },
      null,
      2,
    ),
  ].join('\n')

  return { systemPrompt, userPrompt }
}

export async function callAnthropicDailyReport(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<DailyReportGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  let rawResponse = ''
  let responseStatus = 0
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        temperature: 0.5,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
      signal: controller.signal,
    })
    responseStatus = response.status
    rawResponse = await response.text()
    if (!response.ok) {
      let detail = ''
      try {
        const parsed = JSON.parse(rawResponse) as Record<string, unknown>
        const err = parsed.error as Record<string, unknown> | undefined
        detail = typeof err?.message === 'string' ? `: ${err.message}` : ''
      } catch { /* ignore parse failure */ }
      throw new Error(`Anthropic API error (${responseStatus})${detail}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  let parsedResponse: AnthropicMessageResponse
  try {
    parsedResponse = JSON.parse(rawResponse) as AnthropicMessageResponse
  } catch {
    throw new Error('Anthropic API returned invalid JSON')
  }

  const textBlocks = (parsedResponse.content ?? [])
    .filter((item) => item?.type === 'text' && typeof item?.text === 'string')
    .map((item) => item.text as string)
  const generatedText = textBlocks.join('\n').trim()
  if (!generatedText) {
    throw new Error('Anthropic API returned empty content')
  }

  const payload = parseDailyReportGeneratedPayload(generatedText)
  return {
    payload: { ...payload },
    model: typeof parsedResponse.model === 'string' ? parsedResponse.model : model,
    prompt_tokens:
      typeof parsedResponse.usage?.input_tokens === 'number' ? parsedResponse.usage.input_tokens : null,
    completion_tokens:
      typeof parsedResponse.usage?.output_tokens === 'number' ? parsedResponse.usage.output_tokens : null,
  }
}

export async function callOpenAIDailyReport(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<DailyReportGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  let rawResponse = ''
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: /^(gpt-5|o[1-9])/.test(model) ? 16384 : 1200,
        ...(/^(gpt-5|o[1-9])/.test(model) ? {} : { temperature: 0.5 }),
        messages: [
          { role: /^(gpt-5|o[1-9])/.test(model) ? 'developer' : 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    })
    rawResponse = await response.text()
    if (!response.ok) {
      throw new Error(`OpenAI API error (${response.status}): ${rawResponse.slice(0, 200)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  const parsed = JSON.parse(rawResponse) as OpenAICompatibleResponse
  const generatedText = parsed.choices?.[0]?.message?.content?.trim() ?? ''
  if (!generatedText) {
    throw new Error('OpenAI API returned empty content')
  }

  const payload = parseDailyReportGeneratedPayload(generatedText)
  return {
    payload: { ...payload },
    model: typeof parsed.model === 'string' ? parsed.model : model,
    prompt_tokens: typeof parsed.usage?.prompt_tokens === 'number' ? parsed.usage.prompt_tokens : null,
    completion_tokens: typeof parsed.usage?.completion_tokens === 'number' ? parsed.usage.completion_tokens : null,
  }
}

export async function callGeminiDailyReport(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<DailyReportGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  const geminiModel = model || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`

  let rawResponse = ''
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: 16384,
          temperature: 0.5,
        },
      }),
      signal: controller.signal,
    })
    rawResponse = await response.text()
    if (!response.ok) {
      throw new Error(`Gemini API error (${response.status}): ${rawResponse.slice(0, 200)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  const parsed = JSON.parse(rawResponse) as GeminiResponse
  const parts = parsed.candidates?.[0]?.content?.parts ?? []
  // Gemini 2.5 models include "thought" parts before the actual response.
  // Find the last non-thought part which contains the generated text.
  const outputPart = [...parts].reverse().find((p) => !p.thought)
  const generatedText = (typeof outputPart?.text === 'string' ? outputPart.text : '').trim()
  if (!generatedText) {
    throw new Error(`Gemini API returned empty content. Parts count: ${parts.length}, raw snippet: ${rawResponse.slice(0, 300)}`)
  }

  const payload = parseDailyReportGeneratedPayload(generatedText)
  return {
    payload: { ...payload },
    model: parsed.modelVersion ?? geminiModel,
    prompt_tokens: typeof parsed.usageMetadata?.promptTokenCount === 'number' ? parsed.usageMetadata.promptTokenCount : null,
    completion_tokens: typeof parsed.usageMetadata?.candidatesTokenCount === 'number' ? parsed.usageMetadata.candidatesTokenCount : null,
  }
}

export async function callLlmDailyReport(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<DailyReportGenerationResult> {
  if (provider === 'openai') {
    return callOpenAIDailyReport(apiKey, model || 'gpt-4o-mini', systemPrompt, userPrompt)
  }
  if (provider === 'gemini' || provider === 'google') {
    return callGeminiDailyReport(apiKey, model || 'gemini-2.5-flash', systemPrompt, userPrompt)
  }
  return callAnthropicDailyReport(apiKey, model || DEFAULT_LLM_MODEL, systemPrompt, userPrompt)
}

export async function getDailyReport(db: D1Database, date: string): Promise<DailyReportRow | null> {
  const row = await queryFirst<DailyReportRow>(
    db,
    `
    SELECT
      date, headline, yu_comment, saki_comment, mai_comment,
      condition_comment, activity_comment, meal_comment,
      model, prompt_tokens, completion_tokens, generated_at, created_at
    FROM daily_reports
    WHERE date = ?
    LIMIT 1
    `,
    [date],
  )
  return row ?? null
}

export function toDailyReportResponse(row: DailyReportRow): Record<string, unknown> {
  return {
    date: row.date,
    generated_at: row.generated_at,
    model: row.model,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    home: {
      headline: row.headline,
      yu: row.yu_comment,
      saki: row.saki_comment,
      mai: row.mai_comment,
    },
    tabs: {
      condition: row.condition_comment,
      activity: row.activity_comment,
      meal: row.meal_comment,
    },
    cached: true,
  }
}

export async function saveDailyReport(db: D1Database, payload: DailyReportPersistInput): Promise<void> {
  await execute(
    db,
    `
    INSERT INTO daily_reports(
      date, headline, yu_comment, saki_comment, mai_comment,
      condition_comment, activity_comment, meal_comment,
      model, prompt_tokens, completion_tokens, generated_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      headline = excluded.headline,
      yu_comment = excluded.yu_comment,
      saki_comment = excluded.saki_comment,
      mai_comment = excluded.mai_comment,
      condition_comment = excluded.condition_comment,
      activity_comment = excluded.activity_comment,
      meal_comment = excluded.meal_comment,
      model = excluded.model,
      prompt_tokens = excluded.prompt_tokens,
      completion_tokens = excluded.completion_tokens,
      generated_at = excluded.generated_at
    `,
    [
      payload.date,
      payload.headline,
      payload.yu_comment,
      payload.saki_comment,
      payload.mai_comment,
      payload.condition_comment,
      payload.activity_comment,
      payload.meal_comment,
      payload.model,
      payload.prompt_tokens,
      payload.completion_tokens,
      payload.generated_at,
    ],
  )
}

export async function queryDailyReportTrendRows(db: D1Database, date: string): Promise<DailyReportTrendRow[]> {
  const startDate = shiftIsoDateByDays(date, -13)
  return queryAll<DailyReportTrendRow>(
    db,
    `
    SELECT
      date, steps, sleep_hours, weight_kg, blood_systolic, blood_diastolic, intake_kcal, active_kcal, total_kcal
    FROM daily_metrics
    WHERE date BETWEEN ? AND ?
    ORDER BY date ASC
    `,
    [startDate, date],
  )
}



export async function handleDailyReportGet(url: URL, env: Env): Promise<Response> {
  const date = url.searchParams.get('date') ?? toIsoDate(new Date())
  if (!isValidDate(date)) {
    return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
  }

  const row = await getDailyReport(env.DB, date)
  if (!row) {
    return jsonResponse({ detail: 'Report not found' }, 404)
  }
  return jsonResponse(toDailyReportResponse(row))
}

export async function generateDailyReportIfNeeded(
  env: Env,
  date: string,
  options: DailyReportGenerationOptions = {},
): Promise<{ date: string; generated: boolean; cached: boolean; generated_at?: string }> {
  const force = options.force ?? false
  const cached = await getDailyReport(env.DB, date)
  if (cached && !force) {
    return {
      date,
      generated: false,
      cached: true,
      generated_at: cached.generated_at,
    }
  }

  await ensureAggregatesUpToDate(env.DB)
  const [profile, scores, trendRows] = await Promise.all([
    getUserProfile(env.DB),
    getScores(env.DB, date),
    queryDailyReportTrendRows(env.DB, date),
  ])
  const season = buildSeasonContext(date)
  const prompt = buildDailyReportPrompt({
    date,
    season: { ...season },
    profile: { ...profile },
    scores: { ...scores },
    trendRows: [...trendRows],
  })

  const envProvider = (env.LLM_PROVIDER ?? DEFAULT_LLM_PROVIDER).trim().toLowerCase() || DEFAULT_LLM_PROVIDER
  const provider = options.provider?.trim().toLowerCase() || envProvider
  const overrideApiKey = options.apiKey?.trim() ?? ''
  const envApiKey = (env.LLM_API_KEY ?? '').trim()
  const effectiveApiKey = overrideApiKey || envApiKey
  if (!effectiveApiKey) {
    throw new Error('LLM API key is not configured')
  }
  const overrideModel = options.model?.trim() ?? ''
  const model = overrideModel || (env.LLM_MODEL ?? '').trim() || ''

  const generated = await callLlmDailyReport(provider, effectiveApiKey, model, prompt.systemPrompt, prompt.userPrompt)
  const persistPayload: DailyReportPersistInput = {
    date,
    model: generated.model,
    prompt_tokens: generated.prompt_tokens,
    completion_tokens: generated.completion_tokens,
    generated_at: nowIso(),
    ...generated.payload,
  }

  await saveDailyReport(env.DB, persistPayload)

  return {
    date,
    generated: true,
    cached: false,
  }
}

export async function handleDailyReportGenerate(request: Request, url: URL, env: Env): Promise<Response> {
  const apiKey = (env.LLM_API_KEY ?? '').trim()
  if (!apiKey) {
    return jsonResponse({ detail: 'LLM API key is not configured' }, 503)
  }

  let body: Record<string, unknown>
  try {
    body = await readOptionalJsonBody(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request body'
    return jsonResponse({ detail: message }, 400)
  }

  const bodyDate = body.date
  if (bodyDate != null && typeof bodyDate !== 'string') {
    return jsonResponse({ detail: 'date must be YYYY-MM-DD' }, 400)
  }
  const date = (bodyDate as string | null) ?? url.searchParams.get('date') ?? toIsoDate(new Date())
  if (!isValidDate(date)) {
    return jsonResponse({ detail: 'date must be YYYY-MM-DD' }, 400)
  }

  const forceFromBody = parseBooleanFlag(body.force)
  const forceFromQuery = parseBooleanFlag(url.searchParams.get('force'))
  const force = forceFromBody ?? forceFromQuery ?? false

  const provider = typeof body.provider === 'string' ? body.provider : undefined
  const overrideApiKey = typeof body.api_key === 'string' ? body.api_key : undefined
  const overrideModel = typeof body.model === 'string' ? body.model : undefined

  try {
    const result = await generateDailyReportIfNeeded(env, date, {
      force,
      provider,
      apiKey: overrideApiKey ?? apiKey,
      model: overrideModel,
    })
    return jsonResponse({ ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate daily report'
    if (message.includes('JSON') || message.includes('LLM response')) {
      console.error(`daily-report-json-parse-error: ${message}`)
    }
    return jsonResponse({ detail: message }, 500)
  }
}

