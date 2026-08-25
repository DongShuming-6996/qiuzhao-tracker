import { useState } from 'react';
import { Tag, Table, Button, Space, Typography, Empty, Modal, Tooltip, Popover } from 'antd';
import {
  PlusOutlined,
  CheckSquareOutlined, CloseOutlined, ColumnWidthOutlined,
  LinkOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { STATUS_FIELDS, TODO_FIELDS, STATUS_SHORT, RESULT_COLOR_MAP, RESULT_MAP, ATTITUDE_ICON_MAP, normalizeUrl } from '../utils/constants';
import StatusCheckboxes from './StatusCheckboxes';

const { Text, Link } = Typography;

/**
 * 岗位列表表格 — 支持行选择 + 批量操作
 * @param {Array}    jobs         - 岗位数据
 * @param {Function} onBatchEdit  - 批量编辑 (selectedIds: string[]) => void
 * @param {Function} onBatchDelete- 批量删除 (selectedIds: string[]) => void
 * @param {Function} onCompare    - 对比选中 (jobs: Object[]) => void
 * @param {Function} onRefresh    - 刷新列表回调
 */
export default function JobTable({ jobs = [], onBatchEdit, onBatchDelete, onCompare, onRefresh, onStatusChange, currentPage, pageSize, onPageChange }) {
  const navigate = useNavigate();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const getStatusTags = (record) => {
    const tags = [];
    STATUS_FIELDS.forEach(f => {
      if (record[f.key]) {
        tags.push(
          <Tag key={f.key} color="blue" style={{ fontSize: 11, margin: '1px 2px' }}>
            {STATUS_SHORT[f.key]}
          </Tag>
        );
      }
    });
    TODO_FIELDS.forEach(f => {
      if (record[f.key]) {
        tags.push(
          <Tag key={f.key} color="red" style={{ fontSize: 11, margin: '1px 2px' }}>
            {f.label}
          </Tag>
        );
      }
    });
    if (tags.length === 0) {
      return <Text type="secondary" style={{ fontSize: 12 }}>未开始</Text>;
    }
    return <Space size={0} wrap>{tags}</Space>;
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (newKeys) => setSelectedRowKeys(newKeys),
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE,
    ],
  };

  const clearSelection = () => setSelectedRowKeys([]);

  const handleBatchEdit = () => {
    if (selectedRowKeys.length === 0) return;
    onBatchEdit?.(selectedRowKeys);
  };

  const handleCompare = () => {
    if (selectedRowKeys.length < 2) return;
    const selectedJobs = jobs.filter(j => selectedRowKeys.includes(j.id));
    onCompare?.(selectedJobs);
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) return;
    Modal.confirm({
      title: `确定批量删除 ${selectedRowKeys.length} 个岗位吗？`,
      content: '删除后无法恢复。',
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        onBatchDelete?.(selectedRowKeys);
        setSelectedRowKeys([]);
      },
    });
  };

  const columns = [
    {
      title: '态度',
      dataIndex: 'attitude',
      key: 'attitude',
      width: 55,
      align: 'center',
      render: (val) => {
        const icon = ATTITUDE_ICON_MAP[val || 0];
        if (!icon) return <Text type="secondary">-</Text>;
        return (
          <Tooltip title={ATTITUDE_ICON_MAP[val || 0]}>
            <span style={{ fontSize: 16 }}>{icon}</span>
          </Tooltip>
        );
      },
      filters: [
        { text: '⭐⭐ 超喜欢', value: 2 },
        { text: '⭐ 喜欢', value: 1 },
        { text: '未标记', value: 0 },
        { text: '✗ 不喜欢', value: -1 },
        { text: '✗✗ 很不喜欢', value: -2 },
      ],
      onFilter: (value, record) => (record.attitude || 0) === value,
    },
    {
      title: '岗位名称',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      render: (text, record) => (
        <Space size={4}>
          <Link
            onClick={() => navigate(`/jobs/${record.id}`)}
            style={{ fontWeight: 500 }}
          >
            {text || '（无标题）'}
          </Link>
          {record.url && record.result !== 'failed' && (
            <Tooltip title="打开官网链接">
              <a
                href={normalizeUrl(record.url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: '#1677ff', fontSize: 13 }}
              >
                <LinkOutlined />
              </a>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '岗位ID',
      dataIndex: 'job_id',
      key: 'job_id',
      width: 100,
      ellipsis: true,
      render: text => text ? <Text code style={{ fontSize: 11 }}>{text}</Text> : '-',
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
      width: 120,
      render: text => text ? <Tag color="geekblue">{text}</Tag> : '-',
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 110,
      ellipsis: true,
      render: text => text ? <Tag color="purple">{text}</Tag> : '-',
    },
    {
      title: 'Base地点',
      key: 'location',
      width: 120,
      render: (_, record) => {
        const locs = (record.locations && record.locations.length > 0)
          ? record.locations
          : (record.location ? record.location.split(/[\/、,，\s]+/).filter(Boolean) : []);
        if (locs.length === 0) return '-';
        return (
          <Space size={2} wrap>
            {locs.map((l, i) => <Tag key={i} color="green" style={{ fontSize: 11 }}>{l.trim()}</Tag>)}
          </Space>
        );
      },
    },
    {
      title: '投递状态',
      key: 'status',
      width: 200,
      render: (_, record) => (
        <Popover
          trigger="click"
          placement="bottom"
          title="编辑投递状态"
          content={
            <div style={{ minWidth: 240 }}>
              <StatusCheckboxes
                status={record}
                onChange={(field, value) => onStatusChange?.(record.id, field, value)}
                mode="compact"
              />
            </div>
          }
        >
          <span
            style={{ cursor: 'pointer', display: 'inline-block' }}
            onClick={e => e.stopPropagation()}
          >
            {getStatusTags(record)}
          </span>
        </Popover>
      ),
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 90,
      render: (text) => (
        <Tag color={RESULT_COLOR_MAP[text] || 'default'}>
          {RESULT_MAP[text] || text}
        </Tag>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 110,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      defaultSortOrder: 'descend',
      render: text => {
        if (!text) return '-';
        const d = dayjs(text);
        return (
          <Text style={{ fontSize: 12 }} title={d.format('YYYY-MM-DD HH:mm')}>
            {d.format('MM-DD HH:mm')}
          </Text>
        );
      },
    },
  ];

  if (jobs.length === 0) {
    return (
      <Empty
        description="还没有添加任何岗位"
        style={{ padding: 60 }}
      >
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/create')}
        >
          添加第一个岗位
        </Button>
      </Empty>
    );
  }

  return (
    <div>
      {/* 批量操作栏 */}
      {selectedRowKeys.length > 0 && (
        <div style={{
          background: '#e6f7ff',
          border: '1px solid #91d5ff',
          borderRadius: 6,
          padding: '10px 16px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Space size={12}>
            <CheckSquareOutlined style={{ color: '#1677ff', fontSize: 16 }} />
            <Text strong>已选 {selectedRowKeys.length} 个岗位</Text>
          </Space>
          <Space size={8}>
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={handleBatchEdit}
            >
              批量编辑状态
            </Button>
            {selectedRowKeys.length >= 2 && selectedRowKeys.length <= 5 && (
              <Button
                size="small"
                icon={<ColumnWidthOutlined />}
                onClick={handleCompare}
                style={{ background: '#fff7e6', borderColor: '#ffd591', color: '#d46b08' }}
              >
                对比选中 ({selectedRowKeys.length})
              </Button>
            )}
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
            >
              批量删除
            </Button>
            <Button size="small" icon={<CloseOutlined />} onClick={clearSelection}>
              取消选择
            </Button>
          </Space>
        </div>
      )}

      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={jobs}
        rowKey="id"
        size="middle"
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) => `共 ${total} 个岗位`,
          onChange: (p, ps) => onPageChange?.(p, ps),
        }}
        scroll={{ x: 1080 }}
        rowClassName={(record) => {
          if (record.todo_assessment || record.todo_interview) return 'qiuzhao-row-todo';
          if (record.result === 'failed') return 'qiuzhao-row-failed';
          return '';
        }}
        onRow={(record) => ({
          onDoubleClick: () => navigate(`/jobs/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  );
}
