export const MEAL_TYPES = [
    { value: 'breakfast', label: '朝食', emoji: '🌅' },
    { value: 'lunch', label: '昼食', emoji: '☀️' },
    { value: 'dinner', label: '夕食', emoji: '🌙' },
    { value: 'snack', label: '間食', emoji: '🍪' },
] as const

export const MEAL_TYPE_LABELS: Record<string, string> = {
    breakfast: '🌅 朝食',
    lunch: '☀️ 昼食',
    dinner: '🌙 夕食',
    snack: '🍪 間食',
}

export const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', null] as const

export function suggestMealType(): string {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 10) return 'breakfast'
    if (hour >= 10 && hour < 15) return 'lunch'
    if (hour >= 15 && hour < 21) return 'dinner'
    return 'snack'
}
