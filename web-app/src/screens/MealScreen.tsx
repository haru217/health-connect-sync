import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteNutritionLog,
  fetchNutrientTargets,
  fetchNutritionDay,
  fetchSupplements,
  logNutrition,
} from '../api/healthApi'
import type {
  NutrientTargetItem,
  NutritionDayResponse,
  RequestState,
  SupplementItem,
} from '../api/types'
import './MealScreen.css'

type TabType = 'log' | 'supplement' | 'nutrition'
type TimingType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface SupplementView {
  alias: string
  name: string
  checked: boolean
  eventId: number | null
}

interface MealScreenData {
  day: NutritionDayResponse
  supplements: SupplementView[]
  targets: NutrientTargetItem[]
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

function toSupplementViews(supplements: SupplementItem[], day: NutritionDayResponse): SupplementView[] {
  return supplements.map((item) => {
    const matched = day.events.find((event) => event.alias === item.alias)
    return {
      alias: item.alias,
      name: item.label,
      checked: Boolean(matched),
      eventId: matched?.id ?? null,
    }
  })
}

function formatActualText(actual: number | null, target: number, unit: string): string {
  if (actual == null) {
    return `-- / ${target}${unit}`
  }
  return `${actual.toFixed(1)} / ${target}${unit}`
}

export default function MealScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('log')
  const [date, setDate] = useState<string>(todayLocal())
  const [state, setState] = useState<RequestState<MealScreenData>>({ status: 'loading' })
  const [actionError, setActionError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const [day, supplementRes, targetRes] = await Promise.all([
        fetchNutritionDay(date),
        fetchSupplements(),
        fetchNutrientTargets(date),
      ])
      const supplements = toSupplementViews(supplementRes.supplements, day)
      setState({
        status: 'success',
        data: {
          day,
          supplements,
          targets: targetRes.targets,
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

  const toggleSupplement = async (item: SupplementView) => {
    setActionError(null)
    try {
      if (item.checked && item.eventId != null) {
        await deleteNutritionLog(item.eventId)
      } else {
        await logNutrition({ alias: item.alias, count: 1, local_date: date })
      }
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

  const { day, supplements, targets } = state.data
  const hasMeals = Object.values(mealsByTiming).some((items) => items.length > 0)

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

        {actionError && <div className="card">操作エラー: {actionError}</div>}

        <div className="tab-content">
          {activeTab === 'log' && (
            <div className="meal-log-list fade-in">
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
                    className={`suppl-item card ripple stagger-${Math.min(idx + 1, 5)} ${item.checked ? 'checked' : ''}`}
                    onClick={() => void toggleSupplement(item)}
                  >
                    <div className="suppl-item-name">{item.name}</div>
                    <div className="suppl-item-check">{item.checked ? '✅' : '⬜'}</div>
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
      </div>

      {activeTab === 'log' && (
        <button className="fab ripple" aria-label="食事を追加" onClick={() => void addMealFromPrompt()}>
          ＋
        </button>
      )}
    </>
  )
}

function NutritionBar({ item }: { item: NutrientTargetItem }) {
  const percent =
    item.actual == null || item.target <= 0 ? 0 : Math.min(100, Math.round((item.actual / item.target) * 100))

  let colorVar = '--accent-color'
  if (item.status === 'green') {
    colorVar = '--good-color'
  } else if (item.status === 'red') {
    colorVar = '--danger-color'
  } else if (item.status === 'yellow') {
    colorVar = '--warning-color'
  }

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
