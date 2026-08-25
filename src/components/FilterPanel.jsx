import { useState, useEffect } from 'react';
import {
  Card, Collapse, DatePicker, Select, Checkbox, Button, Space, Row, Col, Input,
} from 'antd';
import { SearchOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import { STATUS_FIELDS, TODO_FIELDS, RESULT_OPTIONS, ATTITUDE_OPTIONS } from '../utils/constants';
import { getFilterOptions } from '../api/storage';

const { RangePicker } = DatePicker;

/**
 * 筛选面板 — 公司/部门/地点支持多选标签
 */
export default function FilterPanel({ filters = {}, onFilter, onReset }) {
  const [options, setOptions] = useState({ companies: [], departments: [], locations: [] });
  const [keyword, setKeyword] = useState(filters.search || '');

  useEffect(() => {
    getFilterOptions().then(setOptions).catch(() => {});
  }, []);

  const refreshOptions = () => {
    getFilterOptions().then(setOptions).catch(() => {});
  };

  const handleChange = (key, value) => {
    // 空数组视为清空
    const v = Array.isArray(value) && value.length === 0 ? undefined : (value || undefined);
    onFilter?.({ ...filters, [key]: v });
  };

  const handleStatusChange = (checkedValues) => {
    const newFilters = { ...filters };
    STATUS_FIELDS.forEach(f => {
      newFilters[f.key] = checkedValues.includes(f.label) ? true : undefined;
    });
    onFilter?.(newFilters);
  };

  const handleTodoChange = (checkedValues) => {
    const newFilters = { ...filters };
    TODO_FIELDS.forEach(f => {
      newFilters[f.key] = checkedValues.includes(f.label) ? true : undefined;
    });
    onFilter?.(newFilters);
  };

  const handleKeywordSearch = () => {
    handleChange('search', keyword || undefined);
  };

  const handleReset = () => {
    setKeyword('');
    onReset?.();
  };

  const activeStatusLabels = STATUS_FIELDS
    .filter(f => filters[f.key] === true)
    .map(f => f.label);

  const activeTodoLabels = TODO_FIELDS
    .filter(f => filters[f.key] === true)
    .map(f => f.label);

  // 共用多选 Select 样式
  const multiSelectProps = {
    mode: 'multiple',
    maxTagCount: 'responsive',
    allowClear: true,
    showSearch: true,
    style: { width: '100%' },
    optionFilterProp: 'label',
  };

  const filterItems = [
    {
      key: 'filter',
      label: (
        <Space>
          <FilterOutlined />
          <span>筛选条件</span>
        </Space>
      ),
      extra: (
        <Button size="small" icon={<ReloadOutlined />} onClick={refreshOptions}>
          刷新选项
        </Button>
      ),
      children: (
        <div>
          {/* 第一行：关键词 + 时间 */}
          <Row gutter={[16, 12]} style={{ marginBottom: 12 }}>
            <Col xs={24} sm={12} md={6}>
              <Input.Search
                placeholder="搜索岗位/公司…"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onSearch={handleKeywordSearch}
                allowClear
                prefix={<SearchOutlined />}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <RangePicker
                style={{ width: '100%' }}
                placeholder={['上传起始日期', '上传结束日期']}
                onChange={(dates) => {
                  handleChange('start_date', dates?.[0]?.startOf('day')?.toISOString() || undefined);
                  handleChange('end_date', dates?.[1]?.endOf('day')?.toISOString() || undefined);
                }}
                format="YYYY-MM-DD"
              />
            </Col>
          </Row>

          {/* 第二行：公司/部门/地点 — 多选标签 */}
          <Row gutter={[16, 12]} style={{ marginBottom: 12 }}>
            <Col xs={24} sm={8}>
              <Select
                {...multiSelectProps}
                placeholder="公司（多选）"
                value={filters.company || undefined}
                onChange={v => handleChange('company', v)}
                options={options.companies.map(c => ({ value: c, label: c }))}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Select
                {...multiSelectProps}
                placeholder="部门（多选）"
                value={filters.department || undefined}
                onChange={v => handleChange('department', v)}
                options={options.departments.map(d => ({ value: d, label: d }))}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Select
                {...multiSelectProps}
                placeholder="Base 地点（多选）"
                value={filters.location || undefined}
                onChange={v => handleChange('location', v)}
                options={options.locations.map(l => ({ value: l, label: l }))}
              />
            </Col>
          </Row>

          {/* 第三行：投递状态 */}
          <div style={{ marginBottom: 12 }}>
            <Checkbox.Group
              options={STATUS_FIELDS.map(f => ({ label: f.label, value: f.label }))}
              value={activeStatusLabels}
              onChange={handleStatusChange}
            />
          </div>

          {/* 待办筛选 */}
          <div style={{ marginBottom: 12 }}>
            <Space size={8} wrap>
              <span style={{ fontWeight: 500, fontSize: 14, color: '#ff4d4f' }}>待办：</span>
              <Checkbox.Group
                options={TODO_FIELDS.map(f => ({ label: f.label, value: f.label }))}
                value={activeTodoLabels}
                onChange={handleTodoChange}
              />
            </Space>
          </div>

          {/* 第四行：结果 + 草稿 + 重置 */}
          <Space size={16} wrap>
            <Select
              placeholder="结果"
              value={filters.result || undefined}
              onChange={v => handleChange('result', v)}
              allowClear
              style={{ width: 130 }}
              options={RESULT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
            />
            <Select
              placeholder="态度"
              value={filters.attitude !== undefined && filters.attitude !== '' ? Number(filters.attitude) : undefined}
              onChange={v => handleChange('attitude', v !== undefined && v !== '' ? v : undefined)}
              allowClear
              style={{ width: 140 }}
              options={ATTITUDE_OPTIONS.filter(o => o.value !== 0).map(o => ({
                value: o.value,
                label: `${o.icon} ${o.label}`,
              }))}
            />
            <Checkbox
              checked={filters.show_drafts || false}
              onChange={e => handleChange('show_drafts', e.target.checked || undefined)}
            >
              显示草稿
            </Checkbox>
            <Button onClick={handleReset} icon={<ReloadOutlined />}>
              重置筛选
            </Button>
          </Space>
        </div>
      ),
    },
  ];

  return (
    <Card
      size="small"
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: '12px 20px' } }}
    >
      <Collapse
        items={filterItems}
        defaultActiveKey={[]}
        ghost
        size="small"
      />
    </Card>
  );
}
