#!/usr/bin/env tsx
/**
 * Test kaspa-rpc-client (gRPC based)
 */

async function main() {
  console.log('Loading kaspa-rpc-client...');
  const { Client } = await import('kaspa-rpc-client');
  console.log('kaspa-rpc-client loaded');

  console.log('Creating client...');
  // Testnet gRPC endpoint
  const client = new Client({
    host: 'seeder1.kaspad-tn11.kaspanet.org:16210',
  });

  console.log('Connecting...');
  await client.connect();
  console.log('Connected!');

  // Get server info
  console.log('Getting server info...');
  const info = await client.getBlockDagInfo();
  console.log('BlockDagInfo:', JSON.stringify(info, null, 2));

  // Get UTXOs for an address
  console.log('\nGetting UTXOs...');
  const testAddress = 'kaspatest:qpumuen7l8wthtz45p3ftn58pvrs9xlumvkuu2xet8egzkcklqtes5z8rkmpd';
  try {
    const utxos = await client.getUtxosByAddresses([testAddress]);
    console.log('UTXOs:', JSON.stringify(utxos, null, 2));
  } catch (e) {
    console.log('No UTXOs found or error:', e);
  }

  await client.disconnect();
  console.log('Disconnected');
}

main().catch(console.error);
