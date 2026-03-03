import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteNutritionLog,
  fetchSummary,
  fetchNutrientTargets,
  fetchNutritionDay,
  fetchSupplements,
  logNutrition,
} from '../api/healthApi'
import { getExpertByTag } from '../components/ExpertCard'
import TabAiAdvice from '../components/TabAiAdvice'
import { useDateContext } from '../context/DateContext'
import { useTabComment } from '../hooks/useTabComment'
import type {
  NutrientTargetItem,
  NutritionDayResponse,
  RequestState,
  SummaryResponse,
  SupplementItem,
} from '../api/types'
import advisorNutritionist from '../assets/advisor_nutritionist.png'
import './MealScreen.css'

type TabType = 'log' | 'supplement' | 'nutrition'
type TimingType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface SupplementView {
  alias: string
  name: string
  checked: boolean
  count: number
  eventIds: number[]
  unitLabel: string
  defaultCount: number
}

interface MealScreenData {
  day: NutritionDayResponse
  supplements: SupplementView[]
  targets: NutrientTargetItem[]
  summary: SummaryResponse | null
}

function todayLocal(): string {
  return new Date().toLocaleDateString('sv-SE')
}

function formatDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
}

function addDays(baseDate: string, diffDays: number): string {
  const base = new Date(`${baseDate}T00:00:00`)
  base.setDate(base.getDate() + diffDays)
  return base.toLocaleDateString('sv-SE')
}

function getTimingLabel(timing: TimingType): string {
  switch (timing) {
    case 'breakfast':
      return '朝食'
    case 'lunch':
      return '昼食'
    case 'dinner':
      return '夕食'
    case 'snack':
      return '間食'
    default: {
      const exhaustiveCheck: never = timing
      throw new Error(`Unhandled timing: ${String(exhaustiveCheck)}`)
    }
  }
}

function classifyTiming(consumedAt: string): TimingType {
  const hourText = consumedAt.slice(11, 13)
  const hour = Number.parseInt(hourText, 10)
  if (Number.isNaN(hour)) {
    return 'snack'
  }
  if (hour < 10) {
    return 'breakfast'
  }
  if (hour < 15) {
    return 'lunch'
  }
  if (hour < 20) {
    return 'dinner'
  }
  return 'snack'
}

function parseOptionalNumber(input: string | null): number | null {
  if (!input) {
    return null
  }
  const n = Number.parseFloat(input)
  return Number.isFinite(n) ? n : null
}

function getSupplementUnitLabel(alias: string): string {
  return alias === 'protein' ? '本' : '錠'
}

function getDefaultSupplementCount(_alias: string): number {
  return 1
}

function toRoundedPositiveCount(value: number | null | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return Math.max(1, Math.round(value))
}

function toSupplementViews(supplements: SupplementItem[], day: NutritionDayResponse): SupplementView[] {
  return supplements.map((item) => {
    const aliasEvents = day.events.filter((event) => event.alias === item.alias)
    const defaultCount = getDefaultSupplementCount(item.alias)
    const sumCount = aliasEvents.reduce((sum, event) => sum + (event.count ?? 0), 0)
    return {
      alias: item.alias,
      name: item.label,
      checked: aliasEvents.length > 0,
      count: toRoundedPositiveCount(sumCount, defaultCount),
      eventIds: aliasEvents.map((event) => event.id),
      unitLabel: getSupplementUnitLabel(item.alias),
      defaultCount,
    }
  })
}

function formatActualText(actual: number | null, target: number, unit: string): string {
  if (actual == null) {
    return `-- / ${target}${unit}`
  }
  return `${actual.toFixed(1)} / ${target}${unit}`
}

function findTodayOrLatest<T extends { date: string }>(
  series: T[],
  valueSelector: (item: T) => number,
): number | null {
  if (series.length === 0) {
    return null
  }
  const today = todayLocal()
  const todayPoint = series.find((item) => item.date === today)
  if (todayPoint) {
    return valueSelector(todayPoint)
  }
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  if (!latest) {
    return null
  }
  return valueSelector(latest)
}

export default function MealScreen() {
  const { activeDate } = useDateContext()
  const [activeTab, setActiveTab] = useState<TabType>('log')
  const [date, setDate] = useState<string>(todayLocal())
  const [state, setState] = useState<RequestState<MealScreenData>>({ status: 'loading' })
  const [actionError, setActionError] = useState<string | null>(null)
  const { comment, loading } = useTabComment(activeDate, 'meal')
  const nutritionistConfig = getExpertByTag('nutritionist')

  const loadData = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const [day, supplementRes, targetRes, summary] = await Promise.all([
        fetchNutritionDay(date),
        fetchSupplements(),
        fetchNutrientTargets(date),
        fetchSummary().catch(() => null),
      ])
      const supplements = toSupplementViews(supplementRes.supplements, day)
      setState({
        status: 'success',
        data: {
          day,
          supplements,
          targets: targetRes.targets,
          summary,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      setState({ status: 'error', error: message })
    }
  }, [date])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const mealsByTiming = useMemo(() => {
    if (state.status !== 'success') {
      return {
        breakfast: [] as NutritionDayResponse['events'],
        lunch: [] as NutritionDayResponse['events'],
        dinner: [] as NutritionDayResponse['events'],
        snack: [] as NutritionDayResponse['events'],
      }
    }
    const groups: Record<TimingType, NutritionDayResponse['events']> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    }
    const mealEvents = state.data.day.events
      .filter((event) => !event.alias)
      .sort((a, b) => a.consumed_at.localeCompare(b.consumed_at))
    for (const event of mealEvents) {
      groups[classifyTiming(event.consumed_at)].push(event)
    }
    return groups
  }, [state])

  const deleteMeal = async (eventId: number) => {
    setActionError(null)
    try {
      await deleteNutritionLog(eventId)
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : '削除エラー'
      setActionError(message)
    }
  }

  const clearSupplementLogs = useCallback(async (item: SupplementView) => {
    if (item.eventIds.length === 0) {
      return
    }
    await Promise.all(item.eventIds.map((eventId) => deleteNutritionLog(eventId)))
  }, [])

  const saveSupplementCount = useCallback(
    async (item: SupplementView, count: number) => {
      const normalizedCount = toRoundedPositiveCount(count, item.defaultCount)
      await clearSupplementLogs(item)
      await logNutrition({ alias: item.alias, count: normalizedCount, local_date: date })
    },
    [clearSupplementLogs, date],
  )

  const setSupplementChecked = async (item: SupplementView, checked: boolean) => {
    setActionError(null)
    try {
      if (!checked) {
        await clearSupplementLogs(item)
      } else {
        const startCount = item.checked ? item.count : item.defaultCount
        await saveSupplementCount(item, startCount)
      }
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'サプリ更新エラー'
      setActionError(message)
    }
  }

  const adjustSupplementCount = async (item: SupplementView, delta: number) => {
    setActionError(null)
    const nextCount = toRoundedPositiveCount(item.count + delta, item.defaultCount)
    if (nextCount === item.count) {
      return
    }
    try {
      await saveSupplementCount(item, nextCount)
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'サプリ更新エラー'
      setActionError(message)
    }
  }
  const addMealFromPrompt = async () => {
    setActionError(null)
    const label = window.prompt('食品名を入力してください')
    if (!label || !label.trim()) {
      return
    }

    const kcal = parseOptionalNumber(window.prompt('カロリー(kcal) 任意'))
    const protein = parseOptionalNumber(window.prompt('タンパク質(g) 任意'))
    const fat = parseOptionalNumber(window.prompt('脂質(g) 任意'))
    const carbs = parseOptionalNumber(window.prompt('炭水化物(g) 任意'))

    const payload: Record<string, unknown> = {
      label: label.trim(),
      consumed_at: `${date}T12:00:00`,
    }
    if (kcal != null) payload.kcal = kcal
    if (protein != null) payload.protein_g = protein
    if (fat != null) payload.fat_g = fat
    if (carbs != null) payload.carbs_g = carbs

    try {
      await logNutrition(payload)
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : '食事追加エラー'
      setActionError(message)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="meal-container fade-in">
        <div className="card">読み込み中...</div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="meal-container fade-in">
        <div className="card">読み込みエラー: {state.error}</div>
      </div>
    )
  }

  const { day, supplements, targets, summary } = state.data
  const hasMeals = Object.values(mealsByTiming).some((items) => items.length > 0)
  const totalSeries = summary ? summary.totalCaloriesByDate ?? summary.totalCalByDate : []
  const consumedKcal = day.totals.kcal
  const burnedKcal = totalSeries.length > 0 ? findTodayOrLatest(totalSeries, (item) => item.kcal) : null
  const balanceKcal = consumedKcal != null && burnedKcal != null ? consumedKcal - burnedKcal : null
  const balanceTone =
    balanceKcal == null ? 'warning' : balanceKcal < -150 ? 'good' : balanceKcal > 150 ? 'danger' : 'warning'
  const balanceLabel =
    balanceKcal == null ? '--' : balanceKcal < -150 ? '減量中' : balanceKcal > 150 ? '増量寄り' : '維持'
  const balanceProgress = balanceKcal == null ? null : Math.min(100, (Math.abs(balanceKcal) / 600) * 100)
  const nutritionistComment =
    balanceKcal == null
      ? '摂取量と消費量の両方が揃うと、より精度の高い食事調整ができます。'
      : balanceKcal > 150
        ? '摂取が消費を上回っています。まずは間食量と夜の炭水化物量を見直しましょう。'
        : balanceKcal < -250
          ? '減量ペースは十分です。たんぱく質と睡眠を維持して筋量低下を防ぎましょう。'
          : '摂取と消費のバランスは良好です。この調子で継続しましょう。'

  return (
    <>
      <div className="meal-container fade-in">
        <div className="date-selector sticky-header">
          <button className="icon-btn ripple" onClick={() => setDate((prev) => addDays(prev, -1))}>
            ‹
          </button>
          <div className="current-date">{formatDateLabel(day.date)}</div>
          <button className="icon-btn ripple" onClick={() => setDate((prev) => addDays(prev, 1))}>
            ›
          </button>
        </div>

        <div className="tab-row">
          <div className={`tab-btn ripple ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
            食事ログ
          </div>
          <div
            className={`tab-btn ripple ${activeTab === 'supplement' ? 'active' : ''}`}
            onClick={() => setActiveTab('supplement')}
          >
            サプリ
          </div>
          <div
            className={`tab-btn ripple ${activeTab === 'nutrition' ? 'active' : ''}`}
            onClick={() => setActiveTab('nutrition')}
          >
            栄養素
          </div>
        </div>

        <section className="meal-insight-section">
          <div className="meal-insight-avatar">
            <img src={advisorNutritionist} alt="Nutritionist" />
          </div>
          <div className="meal-insight-bubble">
            <div className="meal-insight-title">管理栄養士</div>
            <p className="meal-insight-text">{nutritionistComment}</p>
          </div>
        </section>

        {actionError && <div className="card">操作エラー: {actionError}</div>}

        <div className="tab-content">
          {activeTab === 'log' && (
            <div className="meal-log-list fade-in">
              <div className="card meal-balance-card">
                <div className="meal-balance-title">今日のカロリー収支</div>
                <div className="meal-balance-row">
                  <span>摂取</span>
                  <strong>{consumedKcal == null ? '--' : consumedKcal.toFixed(0)} kcal</strong>
                </div>
                <div className="meal-balance-row">
                  <span>消費</span>
                  <strong>{burnedKcal == null ? '--' : burnedKcal.toFixed(0)} kcal</strong>
                </div>
                <div className="meal-balance-row">
                  <span>収支</span>
                  <strong>
                    {balanceKcal == null
                      ? '--'
                      : `${balanceKcal > 0 ? '+' : ''}${Math.round(balanceKcal).toLocaleString('ja-JP')}`}{' '}
                    kcal
                  </strong>
                </div>
                <div className="meal-balance-progress-row">
                  <span className={`meal-balance-status ${balanceTone}`}>{balanceLabel}</span>
                  <div className="meal-balance-progress-track">
                    <div
                      className={`meal-balance-progress-fill ${balanceTone}`}
                      style={{ width: `${balanceProgress ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {!hasMeals ? (
                <div className="empty-state stagger-1">
                  <div className="empty-state-icon">🍽️</div>
                  <div className="empty-state-title">記録なし</div>
                  <p>右下の＋ボタンから食事ログを追加できます。</p>
                </div>
              ) : (
                (['breakfast', 'lunch', 'dinner', 'snack'] as const).map((timing, groupIndex) => {
                  const timingMeals = mealsByTiming[timing]
                  if (timingMeals.length === 0) {
                    return null
                  }
                  return (
                    <div key={timing} className={`meal-group stagger-${Math.min(groupIndex + 1, 5)}`}>
                      <div className="meal-group-header">{getTimingLabel(timing)}</div>
                      {timingMeals.map((meal) => (
                        <div key={meal.id} className="meal-item card ripple">
                          <div className="meal-item-main">
                            <div className="meal-item-name">{meal.label}</div>
                            <div className="meal-item-kcal num">
                              {meal.kcal == null ? '--' : meal.kcal.toFixed(0)} <span className="unit">kcal</span>
                            </div>
                          </div>
                          <div className="meal-item-macros num">
                            P: {meal.protein_g ?? '--'}g / F: {meal.fat_g ?? '--'}g / C: {meal.carbs_g ?? '--'}g
                          </div>
                          <button className="delete-btn ripple" onClick={() => void deleteMeal(meal.id)}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {activeTab === 'supplement' && (
            <div className="suppl-list fade-in">
              {supplements.length === 0 ? (
                <div className="empty-state stagger-1">
                  <div className="empty-state-icon">💊</div>
                  <div className="empty-state-title">サプリ情報がありません</div>
                </div>
              ) : (
                supplements.map((item, idx) => (
                  <div
                    key={item.alias}
                    className={`suppl-item stagger-${Math.min(idx + 1, 5)} ${item.checked ? 'checked' : ''} ripple`}
                    onClick={() => void setSupplementChecked(item, !item.checked)}
                  >
                    <div className="suppl-item-icon">
                      <SupplementIcon alias={item.alias} />
                    </div>

                    <div className="suppl-item-content">
                      <div className="suppl-item-name">{item.name}</div>
                      {item.checked ? (
                        <div className="stepper-container" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="stepper-btn"
                            onClick={() => void adjustSupplementCount(item, -1)}
                            disabled={item.count <= 1}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg>
                          </button>
                          <div className="stepper-value">
                            {item.count}<span className="unit">{item.unitLabel}</span>
                          </div>
                          <button
                            className="stepper-btn"
                            onClick={() => void adjustSupplementCount(item, 1)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="suppl-default-hint">摂取目安: {item.defaultCount}{item.unitLabel}</div>
                      )}
                    </div>

                    <div className="suppl-item-action">
                      <div className="custom-checkbox">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {activeTab === 'nutrition' && (
            <div className="nutrition-list fade-in">
              {targets.length === 0 ? (
                <div className="card">栄養素データがありません</div>
              ) : (
                targets.map((target, idx) => (
                  <div key={target.key} className={`stagger-${Math.min(idx + 1, 5)}`}>
                    <NutritionBar item={target} />
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <TabAiAdvice comment={comment} loading={loading} expert={nutritionistConfig} />
      </div>

      {activeTab === 'log' && (
        <button className="fab ripple" aria-label="食事を追加" onClick={() => void addMealFromPrompt()}>
          ＋
        </button>
      )}
    </>
  )
}

function SupplementIcon({ alias }: { alias: string }) {
  let content = null
  switch (alias) {
    case 'protein':
      content = (
        <>
          <path d="M6 6h12l-1 14H7L6 6z" />
          <path d="M8 2h8v4H8z" />
          <path d="M10 10h4" />
          <path d="M10 14h4" />
        </>
      )
      break
    case 'vitamin_d':
      content = (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </>
      )
      break
    case 'fish_oil':
      content = (
        <>
          <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10z" />
          <path d="M14 7a5 5 0 00-6 3" />
        </>
      )
      break
    case 'multivitamin':
      content = (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v12M8 10l8 4M8 14l8-4" />
        </>
      )
      break
    default:
      content = (
        <>
          <rect x="7" y="3" width="10" height="18" rx="5" />
          <path d="M7 12h10" />
        </>
      )
      break
  }
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {content}
    </svg>
  )
}

function NutritionBar({ item }: { item: NutrientTargetItem }) {
  const actual = item.actual ?? 0
  const ratio = item.target > 0 ? actual / item.target : 0
  const percent = item.actual == null || item.target <= 0
    ? 0
    : Math.min(100, Math.round(ratio * 100))

  // API の rule フィールドを使用。なければ range をデフォルトとする
  const rule = item.rule ?? 'range'

  let computedStatus = item.status

  if (actual > 0 && item.target > 0) {
    if (rule === 'min') {
      // 多く摂るほど良い → 100%以上は緑、摂りすぎで赤にはならない
      if (ratio >= 1.0) computedStatus = 'green'
      else if (ratio >= 0.7) computedStatus = 'yellow'
      else computedStatus = 'red'
    } else if (rule === 'max') {
      // 超えたら問題 → 100%以内は緑、超えたら赤
      if (ratio <= 1.0) computedStatus = 'green'
      else if (ratio <= 1.2) computedStatus = 'yellow'
      else computedStatus = 'red'
    } else {
      // range → 80〜120%が緑
      if (ratio >= 0.8 && ratio <= 1.2) computedStatus = 'green'
      else if (ratio >= 0.6 && ratio <= 1.5) computedStatus = 'yellow'
      else computedStatus = 'red'
    }
  }

  let colorVar = '--accent-color'
  if (computedStatus === 'green') colorVar = '--good-color'
  else if (computedStatus === 'red') colorVar = '--danger-color'
  else if (computedStatus === 'yellow') colorVar = '--warning-color'

  return (
    <div className="nutrition-bar-container card">
      <div className="nutrition-bar-header">
        <span className="nutrition-bar-label">{item.name}</span>
        <span className="nutrition-bar-values num">{formatActualText(item.actual, item.target, item.unit)}</span>
      </div>
      <div className="progress-bg">
        <div className="progress-fill" style={{ width: `${percent}%`, backgroundColor: `var(${colorVar})` }} />
      </div>
    </div>
  )
}
