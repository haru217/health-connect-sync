import { apiFetch } from './client'
import type { FoodAnalyzeResponse, FoodHistoryResponse, FoodAnalyzeResult, NutrientDetails } from './types'

function buildNutrients(
        macros: { calories: number | null; protein_g: number | null; fat_g: number | null; carbs_g: number | null },
        micros?: Partial<NutrientDetails>,
): NutrientDetails {
        const defaults: NutrientDetails = {
                calories: null, protein_g: null, fat_g: null, carbs_g: null,
                saturated_fat_g: null, omega3_mg: null, omega6_mg: null, trans_fat_g: null,
                sugar_g: null, fiber_g: null,
                vitamin_a_ug: null, vitamin_d_ug: null, vitamin_e_mg: null, vitamin_k_ug: null,
                vitamin_b1_mg: null, vitamin_b2_mg: null, vitamin_b6_mg: null, vitamin_b12_ug: null,
                vitamin_c_mg: null, niacin_mg: null, folate_ug: null, pantothenic_acid_mg: null, biotin_ug: null,
                sodium_mg: null, potassium_mg: null, calcium_mg: null, magnesium_mg: null, phosphorus_mg: null,
                iron_mg: null, zinc_mg: null, copper_mg: null, manganese_mg: null,
                selenium_ug: null, chromium_ug: null, molybdenum_ug: null, iodine_ug: null,
                cholesterol_mg: null, purine_mg: null, caffeine_mg: null, alcohol_g: null,
        }
        return { ...defaults, ...macros, ...micros }
}

interface FoodApiItem {
        id?: string | number
        name: string
        display_name?: string
        brand: string | null
        amount: string
        amount_g?: number | null
        kcal: number | null
        protein_g: number | null
        fat_g: number | null
        carbs_g: number | null
        micros?: Partial<NutrientDetails>
        source_type?: 'master' | 'custom'
        food_group?: string | null
        food_master_id?: number | null
        per100g_kcal?: number | null
        per100g_protein_g?: number | null
        per100g_fat_g?: number | null
        per100g_carbs_g?: number | null
        per100g_micros?: Partial<NutrientDetails> | null
}

function mapApiItemToResult(item: FoodApiItem): FoodAnalyzeResult {
        const displayName = item.display_name ?? item.name
        return {
                id: item.id,
                name: displayName,
                display_name: displayName,
                brand: item.brand,
                amount: item.amount,
                amount_g: item.amount_g ?? null,
                source_type: item.source_type,
                food_group: item.food_group ?? null,
                food_master_id: item.food_master_id ?? null,
                nutrients: buildNutrients(
                        { calories: item.kcal, protein_g: item.protein_g, fat_g: item.fat_g, carbs_g: item.carbs_g },
                        item.micros,
                ),
                per100g_nutrients: item.per100g_kcal != null
                        || item.per100g_protein_g != null
                        || item.per100g_fat_g != null
                        || item.per100g_carbs_g != null
                        || item.per100g_micros != null
                        ? buildNutrients(
                                {
                                        calories: item.per100g_kcal ?? null,
                                        protein_g: item.per100g_protein_g ?? null,
                                        fat_g: item.per100g_fat_g ?? null,
                                        carbs_g: item.per100g_carbs_g ?? null,
                                },
                                item.per100g_micros ?? undefined,
                        )
                        : null,
        }
}

export async function analyzeFoodText(text: string): Promise<FoodAnalyzeResponse> {
        const res = await apiFetch<{ items: FoodApiItem[] }>('/api/food/analyze', {
                method: 'POST',
                body: JSON.stringify({ text })
        })
        return { items: (res.items || []).map(mapApiItemToResult) }
}

export async function analyzeFoodImage(file: File, text?: string): Promise<FoodAnalyzeResponse> {
        const base64 = await fileToBase64(file)
        const body: Record<string, string> = { image_base64: base64 }
        if (text?.trim()) body.text = text.trim()
        const res = await apiFetch<{ items: FoodApiItem[] }>('/api/food/analyze', {
                method: 'POST',
                body: JSON.stringify(body),
        })
        return { items: (res.items || []).map(mapApiItemToResult) }
}

function fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => {
                        const result = reader.result as string
                        resolve(result)
                }
                reader.onerror = reject
                reader.readAsDataURL(file)
        })
}

export async function confirmFood(
        items: Array<FoodAnalyzeResult & { save_to_favorites?: boolean; meal_type?: string | null }>,
        localDate: string,
        consumedAt: string,
        source: 'gemini' | 'manual' = 'gemini',
): Promise<void> {
        await apiFetch<void>('/api/food/confirm', {
                method: 'POST',
                body: JSON.stringify({
                        local_date: localDate,
                        consumed_at: consumedAt,
                        source,
                        items: items.map(item => ({
                                name: item.name,
                                display_name: item.display_name ?? item.name,
                                brand: item.brand,
                                amount: item.amount,
                                amount_g: item.amount_g ?? null,
                                kcal: item.nutrients.calories,
                                protein_g: item.nutrients.protein_g,
                                fat_g: item.nutrients.fat_g,
                                carbs_g: item.nutrients.carbs_g,
                                micros: item.nutrients,
                                source_type: item.source_type,
                                food_group: item.food_group ?? null,
                                food_master_id: item.food_master_id ?? null,
                                per100g_kcal: item.per100g_nutrients?.calories ?? null,
                                per100g_protein_g: item.per100g_nutrients?.protein_g ?? null,
                                per100g_fat_g: item.per100g_nutrients?.fat_g ?? null,
                                per100g_carbs_g: item.per100g_nutrients?.carbs_g ?? null,
                                per100g_micros: item.per100g_nutrients ?? null,
                                save_to_favorites: item.save_to_favorites ?? false,
                                meal_type: item.meal_type ?? null,
                        })),
                })
        })
}

interface FoodHistoryApiItem {
        id: string
        consumed_at: string
        name: string
        brand: string | null
        amount: string
        count: number
        kcal: number | null
        protein_g: number | null
        fat_g: number | null
        carbs_g: number | null
        micros?: Partial<NutrientDetails>
        meal_type?: string | null
        note: string | null
}

interface FoodHistoryApiResponse {
        date: string
        items: FoodHistoryApiItem[]
        summary: {
                kcal: number | null
                protein_g: number | null
                fat_g: number | null
                carbs_g: number | null
                micros?: Partial<NutrientDetails>
        }
}

export async function fetchFoodHistory(date: string): Promise<FoodHistoryResponse> {
        const res = await apiFetch<FoodHistoryApiResponse>(`/api/food/history?date=${date}`)
        const mappedItems = (res.items || []).map(item => ({
                id: item.id,
                name: item.name,
                brand: item.brand,
                amount: item.amount,
                nutrients: buildNutrients(
                        { calories: item.kcal, protein_g: item.protein_g, fat_g: item.fat_g, carbs_g: item.carbs_g },
                        item.micros,
                ),
                eatenAt: item.consumed_at,
                mealType: item.meal_type ?? null,
        }))

        const sum = (key: keyof NutrientDetails) =>
                mappedItems.reduce((acc, it) => acc + ((it.nutrients[key] as number) ?? 0), 0) || null

        const apiSummary = res.summary
        const summary: NutrientDetails = buildNutrients(
                {
                        calories: apiSummary?.kcal ?? sum('calories'),
                        protein_g: apiSummary?.protein_g ?? sum('protein_g'),
                        fat_g: apiSummary?.fat_g ?? sum('fat_g'),
                        carbs_g: apiSummary?.carbs_g ?? sum('carbs_g'),
                },
                apiSummary?.micros,
        )

        return { date: res.date, items: mappedItems, summary }
}

export async function searchFoodCandidates(query: string): Promise<FoodAnalyzeResult[]> {
        const res = await apiFetch<{ items: FoodApiItem[] }>(`/api/food/search?q=${encodeURIComponent(query)}`)
        return (res.items || []).map(mapApiItemToResult)
}

export const searchFoodFavorites = searchFoodCandidates

export async function deleteFood(id: string): Promise<void> {
        await apiFetch<void>(`/api/food/${id}`, { method: 'DELETE' })
}

export async function updateFood(
        id: string,
        data: {
                name?: string
                amount?: string
                kcal?: number
                protein_g?: number
                fat_g?: number
                carbs_g?: number
                meal_type?: string | null
        }
): Promise<void> {
        await apiFetch<void>(`/api/food/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
        })
}
