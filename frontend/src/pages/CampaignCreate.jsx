import { useState, useEffect } from 'react';
import { Steps, Form, Input, Select, Button, Card, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api from '../utils/api';

const { Title } = Typography;
const { TextArea } = Input;

export default function CampaignCreate() {
  const [step, setStep] = useState(0);
  const [lists, setLists] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  useEffect(() => {
    api.get('/lists').then(r => setLists(r.data.lists || [])).catch(() => {});
    api.get('/domains').then(r => setDomains((r.data.domains || []).filter(d => d.status === 'verified'))).catch(() => {});
  }, []);

  const handleCreate = async () => {
    const values = form.getFieldsValue();
    setLoading(true);
    try {
      const { data } = await api.post('/campaigns', values);
      message.success('Campaign 已建立');
      navigate(`/campaigns/${data.campaign.id}`);
    } catch (err) {
      message.error(err.response?.data?.error || '建立失敗');
    }
    setLoading(false);
  };

  const steps = [
    {
      title: '基本資訊',
      content: (
        <>
          <Form.Item name="name" label="Campaign 名稱" rules={[{ required: true }]}>
            <Input placeholder="例：五月促銷活動" />
          </Form.Item>
          <Form.Item name="subject" label="Email 主旨" rules={[{ required: true }]}>
            <Input placeholder="例：限時優惠 - 最高 50% 折扣" />
          </Form.Item>
          <Form.Item name="from_name" label="寄件人名稱">
            <Input placeholder="例：Your Company" />
          </Form.Item>
        </>
      )
    },
    {
      title: '內容',
      content: (
        <Form.Item name="body_html" label="Email 內容 (HTML)" rules={[{ required: true }]}>
          <TextArea rows={12} placeholder={'可用變數：{{first_name}} {{last_name}} {{email}} {{unsubscribe_url}}\n\n<h1>您好 {{first_name}}</h1>\n<p>這是您的專屬優惠...</p>\n<p><a href="{{unsubscribe_url}}">取消訂閱</a></p>'} />
        </Form.Item>
      )
    },
    {
      title: '選擇受眾',
      content: (
        <>
          <Form.Item name="list_id" label="名單" rules={[{ required: true }]}>
            <Select placeholder="選擇名單" options={lists.map(l => ({ label: `${l.name} (${l.contact_count} 人)`, value: l.id }))} />
          </Form.Item>
          <Form.Item name="sending_domain_id" label="寄件網域">
            <Select placeholder="選擇寄件網域" allowClear options={domains.map(d => ({ label: d.domain, value: d.id }))} />
          </Form.Item>
        </>
      )
    },
    {
      title: '確認',
      content: (
        <Card>
          <p><strong>名稱：</strong>{form.getFieldValue('name')}</p>
          <p><strong>主旨：</strong>{form.getFieldValue('subject')}</p>
          <p><strong>名單：</strong>{lists.find(l => l.id === form.getFieldValue('list_id'))?.name}</p>
          <Button type="primary" size="large" onClick={handleCreate} loading={loading}>建立 Campaign</Button>
        </Card>
      )
    }
  ];

  return (
    <AppLayout>
      <Title level={4}>建立 Campaign</Title>
      <Steps current={step} onChange={setStep} style={{ marginBottom: 24 }}
        items={steps.map(s => ({ title: s.title }))} />
      <Form form={form} layout="vertical">
        {steps[step].content}
      </Form>
      <div style={{ marginTop: 24 }}>
        {step > 0 && <Button style={{ marginRight: 8 }} onClick={() => setStep(step - 1)}>上一步</Button>}
        {step < steps.length - 1 && <Button type="primary" onClick={() => setStep(step + 1)}>下一步</Button>}
      </div>
    </AppLayout>
  );
}
