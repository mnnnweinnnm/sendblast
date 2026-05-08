const crypto = require('crypto');

let TronWeb;
let ethers;
try {
  TronWeb = require('tronweb');
  ethers = require('ethers');
} catch (err) {
  console.warn('[tron] tronweb/ethers not installed; HD wallet disabled');
}

const TRC20_USDT_CONTRACT = process.env.TRC20_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRONGRID_BASE = process.env.TRONGRID_BASE || 'https://api.trongrid.io';

function getTron() {
  if (!TronWeb) return null;
  const Tron = TronWeb.TronWeb || TronWeb.default || TronWeb;
  return new Tron({
    fullHost: TRONGRID_BASE,
    headers: process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {},
  });
}

function getMnemonic() {
  const mnemonic = process.env.TRON_MNEMONIC || process.env.SENDBLAST_TRON_MNEMONIC;
  if (!mnemonic || mnemonic.trim().split(/\s+/).length < 12) return null;
  return mnemonic.trim();
}

function deriveAddress(index) {
  const mnemonic = getMnemonic();
  if (!mnemonic || !ethers || !TronWeb) return null;
  const path = `m/44'/195'/0'/0/${Number(index)}`;
  const node = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
  const privateKey = node.privateKey.replace(/^0x/, '');
  const Tron = TronWeb.TronWeb || TronWeb.default || TronWeb;
  const address = Tron.address.fromPrivateKey(privateKey);
  return { address, path };
}

function validTronAddress(address) {
  const tron = getTron();
  if (!tron || !address) return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address || '');
  return tron.isAddress(address);
}

async function fetchIncomingUsdt(address) {
  const url = `${TRONGRID_BASE}/v1/accounts/${address}/transactions/trc20?only_to=true&limit=20&contract_address=${TRC20_USDT_CONTRACT}`;
  const headers = process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TronGrid ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

function txMatchesAmount(tx, expectedAmount) {
  if (!tx || tx.type !== 'Transfer' || !tx.value) return false;
  const expectedRaw = BigInt(Math.floor(Number(expectedAmount) * 1e6));
  try { return BigInt(tx.value) >= expectedRaw; } catch { return false; }
}

function makeWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  deriveAddress,
  validTronAddress,
  fetchIncomingUsdt,
  txMatchesAmount,
  makeWebhookSecret,
};
