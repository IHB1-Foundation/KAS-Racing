#!/usr/bin/env tsx
/**
 * Simple kaspa-wasm test with isomorphic-ws
 */

async function main() {
  console.log('Setting up WebSocket...');
  const isomorphicWs = await import('isomorphic-ws');
  // @ts-expect-error - isomorphic-ws is compatible with W3C WebSocket
  globalThis.WebSocket = isomorphicWs.default;
  console.log('WebSocket installed');

  console.log('Loading kaspa-wasm...');
  const kaspa = await import('kaspa-wasm');
  console.log('kaspa-wasm loaded');

  console.log('Encoding.Borsh:', kaspa.Encoding.Borsh);
  console.log('NetworkType.Testnet:', kaspa.NetworkType.Testnet);

  // Test PrivateKey
  const pk = new kaspa.PrivateKey('0000000000000000000000000000000000000000000000000000000000000001');
  console.log('PrivateKey created:', pk.toString().slice(0, 10) + '...');

  // Test RpcClient defaultPort
  const port = kaspa.RpcClient.defaultPort(kaspa.Encoding.Borsh, kaspa.NetworkType.Testnet);
  console.log('Default port for testnet:', port);

  // Create RpcClient - try different constructor forms
  console.log('Creating RpcClient...');
  try {
    const url = 'wss://wrpc-tn11.kaspa.org:17210';
    console.log('URL:', url);

    // Try: RpcClient(Encoding, URL) as shown in documentation
    console.log('Trying (Encoding, URL) form...');
    // @ts-expect-error - trying alternative constructor signature
    const client = new kaspa.RpcClient(kaspa.Encoding.Borsh, url);
    console.log('RpcClient created successfully!');

    console.log('Connecting...');
    await client.connect(undefined);
    console.log('Connected!');

    // Get server info
    console.log('Getting server info...');
    const info = await client.getServerInfo();
    console.log('Server info:', info);

    await client.disconnect();
    console.log('Disconnected');
  } catch (e) {
    console.error('RpcClient test failed:', e);
  }
}

main().catch(console.error);

