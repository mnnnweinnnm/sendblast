import { useState, useEffect } from 'react';
import { Table, Button, Typography, Space, Tag } from 'antd';
import { PlusOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api from '../utils/api';

const { Title } = Typography;

const statusMap = { draft: '草稿', scheduled: '已排程', sending: '發送中', sent: '已發送', paused: '已暫停' };
const statusColor = { draft: 'default', scheduled: 'blue', sending: 'processing', sent: 'green', paused: 'orange' };

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/campaigns'); setCampaigns(data.campaigns || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Campaign</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/campaigns/new')}>建立 Campaign</Button>
      </div>
      <Table dataSource={campaigns} rowKey="id" loading={loading}
        onRow={(r) => ({ onClick: () => navigate(`/campaigns/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: '名稱', dataIndex: 'name', key: 'name' },
          { title: '主旨', dataIndex: 'subject', key: 'subject', ellipsis: true },
          { title: '狀態', dataIndex: 'status', key: 'status', render: s => <Tag color={statusColor[s]}>{statusMap[s]}</Tag> },
          { title: '收件數', dataIndex: 'total_recipients', key: 'total' },
          { title: '已發送', dataIndex: 'sent_count', key: 'sent' },
          { title: '建立時間', dataIndex: 'created_at', key: 'created', render: d => new Date(d).toLocaleDateString() },
        ]}
      />
    </AppLayout>
  );
}
