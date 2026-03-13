export const REPORT_TEMPLATES = [
  { id: 'weight', label: '体重・体組成', prompt: '体重と体脂肪の推移を分析し、改善の具体策を提案してください' },
  { id: 'sleep', label: '睡眠', prompt: '睡眠の質と量を分析し、改善の具体策を提案してください' },
  { id: 'blood_pressure', label: '血圧', prompt: '血圧の推移を分析し、安定化のための具体策を提案してください' },
  { id: 'activity', label: '運動・活動', prompt: '活動量と消費カロリーを分析し、改善の具体策を提案してください' },
  { id: 'nutrition', label: '食事・栄養', prompt: '食事内容と栄養バランスを分析し、改善の具体策を提案してください' },
  { id: 'general', label: '総合分析', prompt: '最近の全体的な体調を分析し、最も重要な改善ポイントを提案してください' },
] as const

export type ReportTemplateId = (typeof REPORT_TEMPLATES)[number]['id']
export type ReportTemplateDefinition = (typeof REPORT_TEMPLATES)[number]

export const REPORT_TEMPLATE_MAP = new Map<ReportTemplateId, ReportTemplateDefinition>(
  REPORT_TEMPLATES.map((template) => [template.id, template]),
)

