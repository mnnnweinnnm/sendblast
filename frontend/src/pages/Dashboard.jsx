import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Typography } from 'antd';
import { MailOutlined, CheckCircleOutlined, EyeOutlined, DollarOutlined } from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import api from '../utils/api';

const { Title } = Typography;

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    api.get('/campaigns').then(r => {
      const campaigns = r.data.campaigns || [];
      setCampaigns(campaigns.slice(0, 5));
      const total = campaigns.length;
      const sent = campaigns.filter(c => c.status === 'sent').length;
      setStats(prev => ({ ...prev, totalCampaigns: total, activeCampaigns: sent }));
    }).catch(() => {});
    api.get('/auth/me').then(r => {
      setStats(prev => ({ ...prev, creditBalance: r.data.user.credit_balance || 0 }));
    }).catch(() => {});
  }, []);

  return (
    <AppLayout>
      <Title level={4}>儀表板</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="剩餘額度" value={stats.creditBalance || 0} suffix="封" prefix={<DollarOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="Campaign 總數" value={stats.totalCampaigns || 0} prefix={<MailOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="本月送達" value={stats.delivered || '-'} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="本月開信" value={stats.opened || '-'} prefix={<EyeOutlined />} /></Card>
        </Col>
      </Row>
      <Card title="最近 Campaign">
        <Table dataSource={campaigns} rowKey="id" pagination={false} size="small"
          columns={[
            { title: '名稱', dataIndex: 'name', key: 'name' },
            { title: '狀態', dataIndex: 'status', key: 'status', render: s => ({ draft: '草稿', scheduled: '已排程', sending: '發送中', sent: '已發送', paused: '已暫停' }[s] || s) },
            { title: '收件數', dataIndex: 'total_recipients', key: 'total' },
            { title: '建立時間', dataIndex: 'created_at', key: 'created', render: d => new Date(d).toLocaleDateString() },
          ]}
        />
      </Card>
    </AppLayout>
  );
}
