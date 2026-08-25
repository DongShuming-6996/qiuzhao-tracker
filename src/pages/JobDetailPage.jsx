import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions, Button, Space, Divider, Typography, Tag, Card,
  message, Popconfirm,
} from 'antd';
import {
  EditOutlined, ArrowLeftOutlined, DeleteOutlined, LinkOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getJob, updateJob, deleteJob } from '../api/storage';
import { RESULT_COLOR_MAP, RESULT_MAP, STATUS_FIELDS, ATTITUDE_ICON_MAP, ATTITUDE_MAP, normalizeUrl } from '../utils/constants';
import StatusCheckboxes from '../components/StatusCheckboxes';

const { Title, Paragraph, Text } = Typography;

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getJob(id);
        if (data) {
          setJob(data);
        } else {
          message.error('岗位不存在');
          navigate('/');
        }
      } catch (err) {
        message.error('加载失败: ' + err.message);
        navigate('/');
      }
      setLoading(false);
    })();
  }, [id, navigate]);

  /** 更新状态：debounce 300ms */
  const handleStatusChange = (field, value) => {
    if (!job) return;
    setJob(prev => ({ ...prev, [field]: value }));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateJob(id, { [field]: value }).catch(err => message.error('更新失败: ' + err.message));
    }, 300);
  };

  const handleDelete = async () => {
    try {
      await deleteJob(id);
      message.success('已删除');
      navigate('/');
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}>加载中…</div>;
  }

  if (!job) {
    return null;
  }

  const statusSummary = STATUS_FIELDS
    .filter(f => job[f.key])
    .map(f => f.label)
    .join(' · ');

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* 顶部操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
        >
          返回列表
        </Button>
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/jobs/${id}/edit`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个岗位吗？"
            description="删除后无法恢复。"
            onConfirm={handleDelete}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      {/* 基本信息 */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginTop: 0, marginBottom: 16 }}>
          {job.title || '（无标题）'}
        </Title>
        <Descriptions bordered column={2} size="middle">
          <Descriptions.Item label="岗位ID">
            {job.job_id ? <Text code>{job.job_id}</Text> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="岗位公司">
            <Tag color="geekblue" style={{ fontSize: 14 }}>{job.company || '-'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="岗位部门">{job.department || '-'}</Descriptions.Item>
          <Descriptions.Item label="Base 地点">
            {(() => {
              const locs = (job.locations && job.locations.length > 0)
                ? job.locations
                : (job.location ? job.location.split(/[\/、,，\s]+/).filter(Boolean) : []);
              if (locs.length === 0) return '-';
              return (
                <Space size={4} wrap>
                  {locs.map((l, i) => <Tag key={i} color="green">{l.trim()}</Tag>)}
                </Space>
              );
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="官网链接">
            {job.url ? (
              <a
                href={normalizeUrl(job.url)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#1677ff' }}
              >
                <LinkOutlined /> 打开官网
              </a>
            ) : (
              <Text type="secondary">未填写</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="上传时间">
            {job.created_at ? dayjs(job.created_at).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="投递进度" span={2}>
            {statusSummary || <Text type="secondary">尚未开始</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="用户态度">
            <span style={{ fontSize: 22 }}>{ATTITUDE_ICON_MAP[job.attitude || 0]}</span>
            {job.attitude ? <Text style={{ marginLeft: 8 }}>{ATTITUDE_MAP[job.attitude]}</Text> : <Text type="secondary">未标记</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="结果" span={2}>
            <Tag color={RESULT_COLOR_MAP[job.result]} style={{ fontSize: 14 }}>
              {RESULT_MAP[job.result]}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
        {job.notes && (
          <>
            <Divider />
            <Text strong>备注：</Text>
            <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{job.notes}</Paragraph>
          </>
        )}
      </Card>

      {/* 状态修改 */}
      <Card title="投递状态追踪" style={{ marginBottom: 24 }}>
        <StatusCheckboxes
          status={job}
          onChange={handleStatusChange}
          mode="detail"
        />
      </Card>

      {/* 岗位详情全文 */}
      <Card title="岗位详情">
        {job.description ? (
          job.description_html ? (
            <div
              style={{ lineHeight: 1.8, fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              dangerouslySetInnerHTML={{ __html: job.description_html }}
            />
          ) : (
            <Paragraph
              style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 14 }}
              copyable
            >
              {job.description}
            </Paragraph>
          )
        ) : (
          <Text type="secondary">暂无详情内容</Text>
        )}
      </Card>
    </div>
  );
}
