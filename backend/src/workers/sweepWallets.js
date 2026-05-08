require('dotenv').config();
const db = require('../db/pool');

let TronWeb;
let ethers;
try {
  TronWeb = require('tronweb');
  ethers = require('ethers');
} catch (err) {
  console.warn('[sweep] tronweb/ethers not installed; sweep disabled');
}

const TRC20_USDT = process.env.TRC20_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const FULL_HOST = process.env.TRONGRID_BASE || 'https://api.trongrid.io';
const TREASURY = process.env.TRON_TREASURY_ADDRESS;
const INTERVAL_MS = Number(process.env.SWEEP_INTERVAL_MS || 5 * 60 * 1000);
const MIN_USDT_TO_SWEEP = Number(process.env.SWEEP_MIN_USDT || 1); // skip dust

function getMnemonic() {
  const m = (process.env.TRON_MNEMONIC || '').trim();
  return m && m.split(/\s+/).length >= 12 ? m : null;
}

function getTron(privateKey) {
  if (!TronWeb) return null;
  const Tron = TronWeb.TronWeb || TronWeb.default || TronWeb;
  return new Tron({
    fullHost: FULL_HOST,
    privateKey,
    headers: process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {},
  });
}

function deriveKey(index) {
  const mnemonic = getMnemonic();
  if (!mnemonic || !ethers || !TronWeb) return null;
  const path = `m/44'/195'/0'/0/${Number(index)}`;
  const node = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
  const privateKey = node.privateKey.replace(/^0x/, '');
  const Tron = TronWeb.TronWeb || TronWeb.default || TronWeb;
  const address = Tron.address.fromPrivateKey(privateKey);
  return { privateKey, address, path };
}

async function ensureSchema() {
  await db.query(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS swept_at TIMESTAMP;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS sweep_tx_hash VARCHAR(255);
  `);
}

async function sweepOnce() {
  if (!TREASURY) {
    console.warn('[sweep] TRON_TREASURY_ADDRESS not set; skipping');
    return { skipped: true };
  }
  if (!getMnemonic() || !TronWeb || !ethers) {
    console.warn('[sweep] mnemonic or libs missing; skipping');
    return { skipped: true };
  }

  const { rows } = await db.query(
    `SELECT id, deposit_index, trc20_address
     FROM orders
     WHERE status='confirmed'
       AND swept_at IS NULL
       AND deposit_index IS NOT NULL
     ORDER BY paid_at ASC
     LIMIT 20`
  );
  if (!rows.length) return { swept: 0 };

  let swept = 0;
  for (const order of rows) {
    try {
      const key = deriveKey(order.deposit_index);
      if (!key || key.address !== order.trc20_address) {
        console.warn(`[sweep] order ${order.id}: derived address mismatch`);
        continue;
      }
      const tron = getTron(key.privateKey);
      const contract = await tron.contract().at(TRC20_USDT);
      const balanceRaw = await contract.balanceOf(order.trc20_address).call();
      const balance = Number(balanceRaw.toString());
      if (balance < MIN_USDT_TO_SWEEP * 1e6) {
        console.log(`[sweep] order ${order.id}: balance ${balance / 1e6} USDT below threshold`);
        continue;
      }
      const txId = await contract.transfer(TREASURY, balanceRaw.toString()).send();
      await db.query(
        `UPDATE orders SET swept_at=NOW(), sweep_tx_hash=$1 WHERE id=$2`,
        [txId, order.id]
      );
      console.log(`[sweep] order ${order.id}: swept ${balance / 1e6} USDT tx=${txId}`);
      swept++;
    } catch (err) {
      console.error(`[sweep] order ${order.id} error:`, err.message);
    }
  }
  return { swept };
}

async function loop() {
  try { await sweepOnce(); } catch (err) { console.error('[sweep] loop error:', err.message); }
  setTimeout(loop, INTERVAL_MS);
}

if (require.main === module) {
  ensureSchema().then(() => {
    console.log(`[sweep] started interval=${INTERVAL_MS}ms treasury=${TREASURY || '(not set)'}`);
    loop();
  });
}

module.exports = { sweepOnce };
