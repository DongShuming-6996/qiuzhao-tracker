import { Card, List, Tag, Typography, Empty, Grid } from 'antd';
import { useNavigate } from 'react-router-dom';
import { TODO_FIELDS } from '../utils/constants';

const { Text } = Typography;
const { useBreakpoint } = Grid;

/**
 * 右侧固定待办板块 — 陈列「待完成测评 / 待面试」的岗位
 * @param {Array} jobs - 当前列表中的岗位数据
 */
export default function TodoPanel({ jobs = [] }) {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const todoJobs = jobs.filter(j => j.todo_assessment || j.todo_interview);

  const todoTags = (job) => TODO_FIELDS
    .filter(f => job[f.key])
    .map(f => <Tag key={f.key} color="red" style={{ margin: 0, fontSize: 11 }}>{f.label}</Tag>);

  return (
    <Card
      size="small"
      title={
        <span style={{ fontSize: 15, fontWeight: 600 }}>
          待完成 · <Text type="danger">{todoJobs.length}</Text>
        </span>
      }
      style={{
        width: isMobile ? '100%' : 320,
        flexShrink: isMobile ? undefined : 0,
        position: isMobile ? 'static' : 'sticky',
        top: isMobile ? undefined : 24,
        borderColor: '#ffd6d6',
        boxShadow: '0 2px 8px rgba(255, 77, 79, 0.08)',
      }}
      styles={{ body: { padding: 0, maxHeight: isMobile ? undefined : 'calc(100vh - 200px)', overflow: 'auto' } }}
    >
      {todoJobs.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary" style={{ fontSize: 12 }}>暂无待完成测评 / 面试</Text>}
          style={{ padding: '24px 12px' }}
        />
      ) : (
        <List
          size="small"
          dataSource={todoJobs}
          renderItem={(job) => (
            <List.Item
              style={{ padding: '10px 16px', cursor: 'pointer' }}
              onClick={() => navigate(`/jobs/${job.id}`)}
            >
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Text
                    ellipsis={{ tooltip: job.title }}
                    style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0 }}
                  >
                    {job.title || '（无标题）'}
                  </Text>
                  {todoTags(job)}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
                  {job.company ? <Tag color="geekblue" style={{ fontSize: 11, marginRight: 4 }}>{job.company}</Tag> : null}
                  {job.department || '-'}
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
