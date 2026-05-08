import { useState, useEffect } from 'react';
import { Card, Descriptions, Statistic, Row, Col, Button, Typography, Tag, Table, message, Space } from 'antd';
import { ArrowLeftOutlined, SendOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api from '../utils/api';

const { Title } = Typography;

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get(`/campaigns/${id}`);
      setCampaign(data.campaign);
      setEvents(data.events || []);
    } catch {}
  };
  useEffect(() => { load(); }, [id]);

  const handleSend = async () => {
    try {
      await api.post(`/campaigns/${id}/send`);
      message.success('發送已啟動');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || '發送失敗');
    }
  };

  const handlePause = async () => {
    try {
      await api.post(`/campaigns/${id}/pause`);
      message.success('已暫停');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失敗');
    }
  };

  if (!campaign) return <AppLayout><p>Loading...</p></AppLayout>;

  const statusMap = { draft: '草稿', scheduled: '已排程', sending: '發送中', sent: '已發送', paused: '已暫停' };

  return (
    <AppLayout>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/campaigns')}>返回</Button>
        {campaign.status === 'draft' && <Button type="primary" icon={<SendOutlined />} onClick={handleSend}>發送</Button>}
        {campaign.status === 'sending' && <Button icon={<PauseCircleOutlined />} onClick={handlePause}>暫停</Button>}
      </Space>

      <Title level={4}>{campaign.name} <Tag>{statusMap[campaign.status]}</Tag></Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={4}><Card><Statistic title="總收件人" value={campaign.total_recipients || 0} /></Card></Col>
        <Col xs={12} sm={4}><Card><Statistic title="已發送" value={campaign.sent_count || 0} /></Card></Col>
        <Col xs={12} sm={4}><Card><Statistic title="送達" value={campaign.delivered_count || 0} /></Card></Col>
        <Col xs={12} sm={4}><Card>
          <Statistic
            title="送達率"
            value={campaign.sent_count > 0 ? ((campaign.delivered_count / campaign.sent_count) * 100).toFixed(1) : '0'}
            suffix="%"
          />
        </Card></Col>
        <Col xs={12} sm={4}><Card><Statistic title="退信" value={campaign.bounce_count || 0} /></Card></Col>
        <Col xs={12} sm={4}><Card>
          <Statistic
            title="開信率"
            value={campaign.delivered_count > 0 ? ((campaign.open_count / campaign.delivered_count) * 100).toFixed(1) : '0'}
            suffix="%"
          />
        </Card></Col>
      </Row>

      <Card title="詳細資訊" style={{ marginBottom: 24 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="主旨">{campaign.subject}</Descriptions.Item>
          <Descriptions.Item label="寄件人名稱">{campaign.from_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="名單 ID">{campaign.list_id}</Descriptions.Item>
          <Descriptions.Item label="建立時間">{new Date(campaign.created_at).toLocaleString()}</Descriptions.Item>
        </Descriptions>
      </Card>

      {events.length > 0 && (
        <Card title="發送事件">
          <Table dataSource={events} rowKey="id" size="small" pagination={false}
            columns={[
              { title: '事件', dataIndex: 'event', key: 'event' },
              { title: '聯絡人', dataIndex: 'contact_id', key: 'contact' },
              { title: '時間', dataIndex: 'timestamp', key: 'time', render: d => new Date(d).toLocaleString() },
            ]}
          />
        </Card>
      )}
    </AppLayout>
  );
}
