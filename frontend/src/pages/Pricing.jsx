import { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Typography, message, Modal, Descriptions, Table, Tag, Statistic, Space } from 'antd';
import { ArrowUpOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../components/AppLayout';
import api from '../utils/api';

const { Title, Text } = Typography;

export default function Pricing() {
  const [packages, setPackages] = useState([]);
  const [balance, setBalance] = useState(0);
  const [orders, setOrders] = useState([]);
  const [buyOpen, setBuyOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [orderResult, setOrderResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pkgRes, meRes] = await Promise.all([
        api.get('/orders/packages'),
        api.get('/auth/me'),
      ]);
      setPackages(pkgRes.data.packages || []);
      setBalance(meRes.data.user?.credit_balance || 0);
    } catch {}
    try {
      const ordersRes = await api.get('/orders/me');
      setOrders(ordersRes.data.orders || []);
    } catch {}
  };

  const handleBuy = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/orders', { package_id: selected.id });
      setOrderResult(data.order);
      message.success('訂單已建立，請完成轉帳');
      loadData(); // refresh balance
    } catch (err) {
      message.error(err.response?.data?.error || '建立訂單失敗');
    } finally {
      setLoading(false);
    }
  };

  const orderColumns = [
    { title: '時間', dataIndex: 'created_at', render: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '套裝', dataIndex: 'package_name', render: v => v || '—' },
    { title: '金額', dataIndex: 'usdt_amount', render: v => `${v} USDT` },
    {
      title: '狀態',
      dataIndex: 'status',
      render: s => {
        const map = { pending: <Tag color="orange">待付款</Tag>, confirmed: <Tag color="green">已到帳</Tag>, cancelled: <Tag>已取消</Tag> };
        return map[s] || <Tag>{s}</Tag>;
      }
    },
    { title: 'TRC-20 地址', dataIndex: 'trc20_address', ellipsis: true, render: v => <Text copyable style={{ fontSize: 11 }}>{v}</Text> },
    { title: '交易 hash', dataIndex: 'tx_hash', ellipsis: true, render: v => v ? <Text copyable style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary">—</Text> },
  ];

  return (
    <AppLayout>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 餘額卡片 */}
        <Card>
          <Row gutter={32} align="middle">
            <Col>
              <Statistic title="目前餘額" value={balance} suffix="封" valueStyle={{ color: '#1677ff', fontSize: 28 }} />
            </Col>
            <Col>
              <Text type="secondary">客戶用額度發送行銷郵件，每封扣 1 點</Text>
            </Col>
          </Row>
        </Card>

        {/* 套裝卡片 */}
        <div>
          <Title level={5}>選擇方案</Title>
          <Row gutter={[16, 16]}>
            {packages.map(pkg => (
              <Col xs={24} sm={12} md={6} key={pkg.id}>
                <Card
                  hoverable
                  style={{ textAlign: 'center', borderColor: selected?.id === pkg.id ? '#1677ff' : undefined, cursor: 'pointer' }}
                  onClick={() => { setSelected(pkg); setBuyOpen(true); setOrderResult(null); }}
                >
                  <Title level={4}>{pkg.name}</Title>
                  <Title level={2} style={{ color: '#1677ff' }}>
                    {pkg.credits.toLocaleString()}<Text style={{ fontSize: 14 }}> 封</Text>
                  </Title>
                  <Title level={3} type="secondary">${pkg.price_usdt} USDT</Title>
                  <Text type="secondary">每封 ${(pkg.price_usdt / pkg.credits).toFixed(4)}</Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* 訂單歷史 */}
        <div>
          <Title level={5}>訂單歷史</Title>
          <Table columns={orderColumns} dataSource={orders} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
        </div>
      </Space>

      <Modal
        title="確認購買"
        open={buyOpen}
        onCancel={() => { setBuyOpen(false); setOrderResult(null); setSelected(null); }}
        footer={orderResult ? [
          <Button key="close" onClick={() => { setBuyOpen(false); setOrderResult(null); setSelected(null); loadData(); }}>
            完成
          </Button>
        ] : [
          <Button key="cancel" onClick={() => { setBuyOpen(false); setOrderResult(null); }}>
            取消
          </Button>,
          <Button key="buy" type="primary" loading={loading} onClick={handleBuy} icon={<ArrowUpOutlined />}>
            確認購買
          </Button>,
        ]}
      >
        {selected && !orderResult && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="套裝">{selected.name}</Descriptions.Item>
            <Descriptions.Item label="獲得額度">{selected.credits.toLocaleString()} 封</Descriptions.Item>
            <Descriptions.Item label="實付">${selected.price_usdt} USDT</Descriptions.Item>
            <Descriptions.Item label="備註">系統自動確認到帳後立即入帳</Descriptions.Item>
          </Descriptions>
        )}
        {orderResult && (
          <Card style={{ background: '#fafafa' }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="套裝">{selected.name}</Descriptions.Item>
              <Descriptions.Item label="獲得額度">{selected.credits?.toLocaleString() || selected.package_credits?.toLocaleString()} 封</Descriptions.Item>
              <Descriptions.Item label="實付">{orderResult.usdt_amount} USDT</Descriptions.Item>
            </Descriptions>
            <hr style={{ margin: '12px 0' }} />
            <p><strong>請轉帳至以下 TRC-20 地址：</strong></p>
            <Text copyable style={{ wordBreak: 'break-all', display: 'block', background: '#fff', padding: 8, border: '1px solid #d9d9d9', borderRadius: 4 }}>
              {orderResult.trc20_address}
            </Text>
            <p style={{ marginTop: 12, color: '#888', fontSize: 12 }}>
              ⚠️ 請轉帳準確金額 {orderResult.usdt_amount} USDT，系統確認後自動入帳（約 1-5 分鐘）
            </p>
          </Card>
        )}
      </Modal>
    </AppLayout>
  );
}
