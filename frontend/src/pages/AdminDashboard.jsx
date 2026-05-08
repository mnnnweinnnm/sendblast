import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { TeamOutlined, MailOutlined, DollarOutlined } from '@ant-design/icons';
import AdminLayout from '../components/AdminLayout';
import api from '../utils/api';

const { Title } = Typography;

export default function AdminDashboard() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <AdminLayout>
      <Title level={4}>管理員儀表板</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="總客戶數" value={stats.total_clients || 0} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="總發送量" value={stats.total_sent || 0} prefix={<MailOutlined />} suffix="封" /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="累計營收" value={stats.total_revenue_usdt || 0} prefix={<DollarOutlined />} suffix="USDT" /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="總 Campaign" value={stats.total_campaigns || 0} prefix={<MailOutlined />} /></Card>
        </Col>
      </Row>
    </AdminLayout>
  );
}
