-- SendBlast Database Schema
-- PostgreSQL

-- Platform Admins (韋瀚團隊)
CREATE TABLE IF NOT EXISTS platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients (外部公司/客戶)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255),  -- TRC-20 wallet (optional)
    credit_balance INTEGER DEFAULT 0,
    total_purchased INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',  -- active, suspended
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Transactions (額度異動記錄)
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,  -- 'recharge' (買額度) | 'spend' (發信扣點) | 'adjust' (手動調整)
    amount INTEGER NOT NULL,    -- 異動數量（正數=增加，負數=減少）
    balance_after INTEGER NOT NULL, -- 異動後餘額
    order_id UUID REFERENCES orders(id),
    campaign_id UUID,
    note VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_client ON credit_transactions(client_id, created_at DESC);

-- Client Users (客戶公司成員)
CREATE TABLE IF NOT EXISTS client_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'operator',  -- admin, operator
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Packages (額度套裝)
CREATE TABLE IF NOT EXISTS credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    credits INTEGER NOT NULL,
    price_usdt DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',  -- active, inactive
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE credit_packages ADD CONSTRAINT credit_packages_name_unique UNIQUE (name);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Orders (USDT 訂單)
CREATE SEQUENCE IF NOT EXISTS order_deposit_index_seq;

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    package_id UUID REFERENCES credit_packages(id),
    credits INTEGER NOT NULL,
    usdt_amount DECIMAL(10,2) NOT NULL,
    trc20_address VARCHAR(255) NOT NULL,  -- 衍生地址或固定地址
    expected_amount VARCHAR(255) NOT NULL,  -- expected USDT amount
    tx_hash VARCHAR(255),                  -- 區塊鏈交易 hash
    status VARCHAR(50) DEFAULT 'pending',  -- pending, confirmed, failed
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sending Domains (寄件網域 - 共用資源池)
CREATE TABLE IF NOT EXISTS sending_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    from_name_default VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',  -- pending, verified, failed
    dkim_status VARCHAR(50) DEFAULT 'pending',
    spf_status VARCHAR(50) DEFAULT 'pending',
    dmarc_status VARCHAR(50) DEFAULT 'pending',
    resend_domain_id VARCHAR(255),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Lists (名單)
CREATE TABLE IF NOT EXISTS contact_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    contact_count INTEGER DEFAULT 0,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts (聯絡人)
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',  -- active, unsubscribed, bounced
    unsubscribe_token VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, email)
);

-- Contact List Members
CREATE TABLE IF NOT EXISTS contact_list_members (
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (contact_id, list_id)
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT,
    body_text TEXT,
    list_id UUID REFERENCES contact_lists(id),
    sending_domain_id UUID REFERENCES sending_domains(id),
    from_name VARCHAR(255),
    from_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft',  -- draft, scheduled, sending, sent, paused
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    bounce_count INTEGER DEFAULT 0,
    complaint_count INTEGER DEFAULT 0,
    resend_campaign_id VARCHAR(255),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Events (追蹤)
CREATE TABLE IF NOT EXISTS email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,  -- sent, delivered, open, click, bounce, complaint
    email_hash VARCHAR(255),         -- for matching without exposing email
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_client_id ON contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contact_lists_client_id ON contact_lists(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_contact_id ON email_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_client_users_client_id ON client_users(client_id);


-- Idempotent upgrades for existing deployments
CREATE SEQUENCE IF NOT EXISTS order_deposit_index_seq;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_path VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_index BIGINT UNIQUE;
