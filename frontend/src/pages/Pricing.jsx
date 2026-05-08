import { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Typography, message, Modal, Descriptions, Table, Tag, Statistic, Space } from 'antd';
import { ArrowUpOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import AppLayout from '../components/AppLayout';
import api from '../utils/api';

const { Title, Text } = Typography;

export default function Pricing() {
  const [packages, setPackages] = useState([]);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [buyOpen, setBuyOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [orderResult, setOrderResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pkgRes, meRes, txRes] = await Promise.all([
        api.get('/orders/packages'),
        api.get('/auth/me'),
        api.get('/billing/transactions'),
      ]);
      setPackages(pkgRes.data.packages || []);
      setBalance(meRes.data.user?.credit_balance || 0);
      setTransactions(txRes.data.transactions || []);
    } catch (e) {
      // fallback: try orders endpoint
      try {
        const ordersRes = await api.get('/orders/me');
        const tx = (ordersRes.data.orders || []).map(o => ({
          id: o.id,
          type: 'recharge',
          amount: o.status === 'confirmed' ? (o.credits || 0) : 0,
          balance_after: 0,
          created_at: o.created_at,
          note: `購買 ${o.package_name || ''} (${o.usdt_amount} USDT)`,
        }));
        setTransactions(tx);
      } catch {}
    }
  };

  const handleBuy = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/orders', { package_id: selected.id });
      setOrderResult(data.order);
      message.success('訂單已建立，請完成轉帳');
      loadData();
    } catch (err) {
      message.error(err.response?.data?.error || '建立訂單失敗');
    } finally {
      setLoading(false);
    }
  };

  const typeTag = (t) => {
    const map = {
      recharge: <Tag color="green">充值</Tag>,
      spend: <Tag color="red">花費</Tag>,
      adjust: <Tag color="blue">調整</Tag>,
    };
    return map[t] || <Tag>{t}</Tag>;
  };

  const txColumns = [
    { title: '時間', dataIndex: 'created_at', render: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '類型', dataIndex: 'type', render: typeTag },
    {
      title: '變動',
      dataIndex: 'amount',
      render: (v, r) => {
        const color = r.type === 'spend' ? '#ff4d4f' : '#52c41a';
        const prefix = v > 0 ? '+' : '';
        return <Text style={{ color, fontWeight: 600 }}>{prefix}{v}</Text>;
      }
    },
    { title: '異動後餘額', dataIndex: 'balance_after', render: v => v?.toLocaleString() || '—' },
    {
      title: '說明',
      dataIndex: 'note',
      render: (v, r) => {
        if (v) return v;
        if (r.type === 'spend' && r.campaign_name) return `發送：${r.campaign_name}`;
        if (r.type === 'recharge' && r.order_package_name) return `購買額度：${r.order_package_name}`;
        return '—';
      }
    },
  ];

  const totalRecharge = transactions.filter(t => t.type === 'recharge').reduce((s, t) => s + t.amount, 0);
  const totalSpend = Math.abs(transactions.filter(t => t.type === 'spend').reduce((s, t) => s + t.amount, 0));

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

        {/* 額度歷史 */}
        <div>
          <Row justify="space-between" align="bottom" style={{ marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0 }}>額度歷史</Title>
            <Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                累計充值 <Text style={{ color: '#52c41a', fontWeight: 600 }}>+{totalRecharge.toLocaleString()}</Text>
                {'  '}累計花費 <Text style={{ color: '#ff4d4f', fontWeight: 600 }}>-{totalSpend.toLocaleString()}</Text>
              </Text>
              <Button size="small" onClick={loadData}>重整</Button>
            </Space>
          </Row>
          <Table
            columns={txColumns}
            dataSource={transactions}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 15 }}
            style={{ background: '#fff' }}
          />
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
