/** 投递状态字段配置 */
export const STATUS_FIELDS = [
  { key: 'hr_resume_pass',       label: 'HR简历关' },
  { key: 'business_resume_pass', label: '业务简历关' },
  { key: 'assessment_invite',    label: '测评邀请' },
  { key: 'assessment_done',      label: '测评完成' },
  { key: 'interview_1',          label: '一面' },
  { key: 'interview_2',          label: '二面' },
  { key: 'interview_3',          label: '三面' },
];

/** 待办字段配置（勾选后列表行标红） */
export const TODO_FIELDS = [
  { key: 'todo_assessment', label: '待完成测评' },
  { key: 'todo_interview',  label: '待面试' },
];

/** 结果选项 */
export const RESULT_OPTIONS = [
  { value: 'pending', label: '进行中', color: 'blue' },
  { value: 'failed',  label: '已挂',   color: 'red' },
  { value: 'offered', label: '已Offer', color: 'green' },
];

/** 结果值到 label 映射 */
export const RESULT_MAP = Object.fromEntries(
  RESULT_OPTIONS.map(o => [o.value, o.label])
);

/** 结果值到颜色映射 */
export const RESULT_COLOR_MAP = Object.fromEntries(
  RESULT_OPTIONS.map(o => [o.value, o.color])
);

/** 用户态度选项 */
export const ATTITUDE_OPTIONS = [
  { value: 0,  label: '未标记', icon: '' },
  { value: 1,  label: '喜欢',   icon: '⭐' },
  { value: 2,  label: '超喜欢', icon: '⭐⭐' },
  { value: -1, label: '不喜欢', icon: '✗' },
  { value: -2, label: '很不喜欢', icon: '✗✗' },
];

export const ATTITUDE_MAP = Object.fromEntries(
  ATTITUDE_OPTIONS.map(o => [o.value, o.label])
);

export const ATTITUDE_ICON_MAP = Object.fromEntries(
  ATTITUDE_OPTIONS.map(o => [o.value, o.icon])
);

/** 状态字段到中文简写 */
export const STATUS_SHORT = {
  hr_resume_pass:       'HR简历关',
  business_resume_pass: '业务简历关',
  assessment_invite:    '测评邀请',
  assessment_done:      '测评完成',
  interview_1:          '一面',
  interview_2:          '二面',
  interview_3:          '三面',
};

/** 规范化 URL：补全协议，供外链跳转使用 */
export function normalizeUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** 新建岗位时的默认值 */
export const DEFAULT_JOB = {
  job_id: '',
  title: '',
  company: '',
  department: '',
  location: '',
  locations: [],
  description: '',
  description_html: '',
  raw_text: '',
  url: '',
  attitude: 0,
  hr_resume_pass: false,
  business_resume_pass: false,
  assessment_invite: false,
  assessment_done: false,
  interview_1: false,
  interview_2: false,
  interview_3: false,
  todo_assessment: false,
  todo_interview: false,
  result: 'pending',
  notes: '',
  is_draft: false,
};
