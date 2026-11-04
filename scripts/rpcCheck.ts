const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const GIVECHAIN_ADDRESS = process.env.GIVECHAIN_ADDRESS;

type JsonRpcResponse<T> = { result?: T; error?: { code: number; message: string } };
let requestId = 0;

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = (await response.json()) as JsonRpcResponse<T>;
  if (payload.error) throw new Error(`RPC ${payload.error.code}: ${payload.error.message}`);
  if (payload.result === undefined) throw new Error(`RPC ${method} returned no result`);
  return payload.result;
}

const decimal = (hex: string) => BigInt(hex).toString();

async function main() {
  const chainHex = await rpc<string>("eth_chainId");
  const blockHex = await rpc<string>("eth_blockNumber");
  const accounts = await rpc<string[]>("eth_accounts");
  console.log(`RPC URL: ${RPC_URL}`);
  console.log(`Chain ID(hex): ${chainHex}`);
  console.log(`Chain ID(decimal): ${decimal(chainHex)}`);
  console.log(`Block Number: ${decimal(blockHex)}`);
  console.log(`Account: ${accounts[0] ?? "none"}`);
  if (accounts[0]) {
    const balance = await rpc<string>("eth_getBalance", [accounts[0], "latest"]);
    console.log(`Balance(wei): ${decimal(balance)}`);
  }
  if (GIVECHAIN_ADDRESS) {
    const code = await rpc<string>("eth_getCode", [GIVECHAIN_ADDRESS, "latest"]);
    console.log(`GiveChain Address: ${GIVECHAIN_ADDRESS}`);
    console.log(`Contract Code Exists: ${code !== "0x"}`);
  } else {
    console.log("GiveChain Address: not provided (set GIVECHAIN_ADDRESS to check code)");
  }
}

main().catch((error) => { console.error(`RPC check failed: ${error.message ?? error}`); process.exitCode = 1; });
