import { useState, useEffect } from 'react';
import { Table, Tag, Typography } from 'antd';
import AppLayout from '../components/AppLayout';
import AdminLayout from '../components/AdminLayout';
import api, { getUser } from '../utils/api';

const { Title } = Typography;

const statusMap = { pending: '待付款', confirmed: '已確認', failed: '失敗' };
const statusColor = { pending: 'orange', confirmed: 'green', failed: 'red' };

export default function Orders() {
  const user = getUser();
  const isAdmin = user?.type === 'platform_admin';
  const Layout = isAdmin ? AdminLayout : AppLayout;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(isAdmin ? '/admin/orders' : '/orders')
      .then(r => setOrders(r.data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <Title level={4}>訂單記錄</Title>
      <Table dataSource={orders} rowKey="id" loading={loading}
        columns={[
          ...(isAdmin ? [{ title: '客戶', dataIndex: 'company_name', key: 'client' }] : []),
          { title: '套裝', dataIndex: 'package_name', key: 'package', render: v => v || '-' },
          { title: '封數', dataIndex: 'credits', key: 'credits', render: v => v?.toLocaleString() },
          { title: '金額', dataIndex: 'usdt_amount', key: 'amount', render: v => `$${v} USDT` },
          { title: '狀態', dataIndex: 'status', key: 'status', render: s => <Tag color={statusColor[s]}>{statusMap[s] || s}</Tag> },
          { title: 'TRC-20 地址', dataIndex: 'trc20_address', key: 'address', ellipsis: true, render: v => v || '-' },
          { title: '交易 Hash', dataIndex: 'tx_hash', key: 'tx', ellipsis: true, render: v => v || '-' },
          { title: '建立時間', dataIndex: 'created_at', key: 'created', render: d => new Date(d).toLocaleDateString() },
        ]}
      />
    </Layout>
  );
}
