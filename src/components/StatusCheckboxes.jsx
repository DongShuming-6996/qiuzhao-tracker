import { Checkbox, Select, Space, Typography } from 'antd';
import { STATUS_FIELDS, TODO_FIELDS, RESULT_OPTIONS } from '../utils/constants';

const { Text } = Typography;

/**
 * 投递状态勾选组件（复用：详情页 / 列表行内编辑）
 * @param {Object}  status       - { hr_resume_pass, business_resume_pass, assessment_invite, assessment_done,
 *                                   interview_1, interview_2, interview_3, todo_assessment, todo_interview, result }
 * @param {Function} onChange     - (field, value) => void
 * @param {boolean}  disabled     - 是否禁用
 * @param {'detail'|'compact'} mode - detail=并排大间距, compact=紧凑
 */
export default function StatusCheckboxes({ status = {}, onChange, disabled = false, mode = 'detail' }) {
  const isCompact = mode === 'compact';

  const handleStatusChange = (field, checked) => {
    onChange?.(field, checked);
  };

  const handleResultChange = (value) => {
    onChange?.('result', value);
  };

  if (isCompact) {
    return (
      <div>
        <Space size={[4, 2]} wrap>
          {STATUS_FIELDS.map(f => (
            <Checkbox
              key={f.key}
              checked={status[f.key] || false}
              disabled={disabled}
              onChange={e => handleStatusChange(f.key, e.target.checked)}
              style={{ fontSize: 12 }}
            >
              <Text style={{ fontSize: 12 }}>{f.label}</Text>
            </Checkbox>
          ))}
        </Space>
        <div style={{ borderTop: '1px solid #f0f0f0', margin: '8px 0' }} />
        <Text type="secondary" style={{ fontSize: 12 }}>待办（勾选后列表标红）</Text>
        <Space size={[4, 2]} wrap style={{ marginTop: 4 }}>
          {TODO_FIELDS.map(f => (
            <Checkbox
              key={f.key}
              checked={status[f.key] || false}
              disabled={disabled}
              onChange={e => handleStatusChange(f.key, e.target.checked)}
              style={{ fontSize: 12 }}
            >
              <Text style={{ fontSize: 12 }}>{f.label}</Text>
            </Checkbox>
          ))}
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>结果：</Text>
          <Select
            size="small"
            value={status.result || 'pending'}
            onChange={handleResultChange}
            disabled={disabled}
            style={{ width: 100 }}
            options={RESULT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      <Text strong style={{ marginRight: 16, fontSize: 14 }}>投递状态：</Text>
      <Space size={[16, 8]} wrap style={{ marginBottom: 12 }}>
        {STATUS_FIELDS.map(f => (
          <Checkbox
            key={f.key}
            checked={status[f.key] || false}
            disabled={disabled}
            onChange={e => handleStatusChange(f.key, e.target.checked)}
          >
            {f.label}
          </Checkbox>
        ))}
      </Space>
      <div style={{ marginTop: 8 }}>
        <Text strong style={{ marginRight: 12, fontSize: 14 }}>待办：</Text>
        <Space size={[16, 8]} wrap>
          {TODO_FIELDS.map(f => (
            <Checkbox
              key={f.key}
              checked={status[f.key] || false}
              disabled={disabled}
              onChange={e => handleStatusChange(f.key, e.target.checked)}
            >
              {f.label}
            </Checkbox>
          ))}
        </Space>
        <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>（勾选后列表标红）</Text>
      </div>
      <div style={{ marginTop: 8 }}>
        <Text strong style={{ marginRight: 12, fontSize: 14 }}>结果：</Text>
        <Select
          value={status.result || 'pending'}
          onChange={handleResultChange}
          disabled={disabled}
          style={{ width: 140 }}
          options={RESULT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
        />
      </div>
    </div>
  );
}
