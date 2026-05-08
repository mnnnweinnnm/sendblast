import { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Typography, message, Modal, Descriptions } from 'antd';
import AppLayout from '../components/AppLayout';
import api from '../utils/api';

const { Title, Text } = Typography;

export default function Pricing() {
  const [packages, setPackages] = useState([]);
  const [buyOpen, setBuyOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [orderResult, setOrderResult] = useState(null);

  useEffect(() => {
    api.get('/orders/packages').then(r => setPackages(r.data.packages || [])).catch(() => {});
  }, []);

  const handleBuy = async () => {
    try {
      const { data } = await api.post('/orders', { package_id: selected.id });
      setOrderResult(data.order);
      message.success('訂單已建立，請完成轉帳');
    } catch (err) {
      message.error(err.response?.data?.error || '建立訂單失敗');
    }
  };

  return (
    <AppLayout>
      <Title level={4}>購買額度</Title>
      <Row gutter={[16, 16]}>
        {packages.map(pkg => (
          <Col xs={24} sm={12} md={6} key={pkg.id}>
            <Card hoverable style={{ textAlign: 'center', borderColor: selected?.id === pkg.id ? '#1677ff' : undefined }}
              onClick={() => { setSelected(pkg); setBuyOpen(true); }}>
              <Title level={3}>{pkg.name}</Title>
              <Title level={2} style={{ color: '#1677ff' }}>{pkg.credits.toLocaleString()} <Text style={{ fontSize: 14 }}>封</Text></Title>
              <Title level={3} type="secondary">${pkg.price_usdt} USDT</Title>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal title="確認購買" open={buyOpen} onCancel={() => { setBuyOpen(false); setOrderResult(null); }} onOk={handleBuy} okText="確認購買">
        {selected && !orderResult && (
          <Descriptions column={1}>
            <Descriptions.Item label="套裝">{selected.name}</Descriptions.Item>
            <Descriptions.Item label="封數">{selected.credits.toLocaleString()} 封</Descriptions.Item>
            <Descriptions.Item label="金額">${selected.price_usdt} USDT</Descriptions.Item>
          </Descriptions>
        )}
        {orderResult && (
          <Card>
            <p><strong>TRC-20 轉帳地址：</strong></p>
            <Text copyable style={{ wordBreak: 'break-all' }}>{orderResult.trc20_address}</Text>
            <p style={{ marginTop: 16 }}><strong>金額：</strong>{orderResult.usdt_amount} USDT</p>
            <p>請轉帳至上方地址，系統確認後自動入帳。</p>
          </Card>
        )}
      </Modal>
    </AppLayout>
  );
}
