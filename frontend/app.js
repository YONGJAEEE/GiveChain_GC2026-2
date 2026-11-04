const CHAIN_ID = 31337n;
const CHAIN_HEX = "0x7a69";
const RPC_URL = "http://127.0.0.1:8545";
const ADDRESS_KEY = "givechain.local.contractAddress";

const el = {
  nodeStatus: document.querySelector("#node-status"), walletStatus: document.querySelector("#wallet-status"), connect: document.querySelector("#connect-button"), switchNetwork: document.querySelector("#switch-network-button"), account: document.querySelector("#account-value"), chain: document.querySelector("#chain-value"), balance: document.querySelector("#balance-value"), message: document.querySelector("#wallet-message"), contract: document.querySelector("#contract-address"), save: document.querySelector("#save-address-button"), runCheck: document.querySelector("#run-check-button"), results: document.querySelector("#rpc-results"),
};
let account;

function setStatus(node, text, kind = "neutral") { node.textContent = text; node.className = `status ${kind}`; }
function ethereum() { if (!window.ethereum) throw new Error("MetaMask가 설치되어 있지 않습니다."); return window.ethereum; }
function message(text, kind = "") { el.message.textContent = text; el.message.className = `message ${kind}`; }
function logError(error) { message(error.shortMessage ?? error.message ?? "요청을 처리하지 못했습니다.", "bad"); }

async function connectWallet() {
  try {
    const wallet = ethereum();
    const accounts = await wallet.request({ method: "eth_requestAccounts" });
    const chainHex = await wallet.request({ method: "eth_chainId" });
    account = accounts[0];
    const chainId = BigInt(chainHex);
    el.account.textContent = account ?? "연결되지 않음";
    el.chain.textContent = `${chainId} (${chainHex})`;
    if (account) {
      const balanceHex = await wallet.request({ method: "eth_getBalance", params: [account, "latest"] });
      el.balance.textContent = `${(Number(BigInt(balanceHex)) / 1e18).toFixed(4)} ETH`;
    }
    const ok = chainId === CHAIN_ID;
    setStatus(el.walletStatus, ok ? "확인 완료" : "Chain ID 불일치", ok ? "good" : "bad");
    message(ok ? "Account와 Chain ID가 GiveChain Local 설정과 일치합니다." : "MetaMask에서 Chain ID 31337 / 0x7a69 네트워크를 선택하세요.", ok ? "good" : "bad");
  } catch (error) { logError(error); }
}

async function switchNetwork() {
  try {
    const wallet = ethereum();
    try { await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] }); } catch (error) {
      if (error.code !== 4902) throw error;
      await wallet.request({ method: "wallet_addEthereumChain", params: [{ chainId: CHAIN_HEX, chainName: "GiveChain Local", rpcUrls: [RPC_URL], nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 } }] });
    }
    await connectWallet();
  } catch (error) { logError(error); }
}

async function rpc(method, params = []) {
  const response = await fetch(RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }) });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const result = await response.json();
  if (result.error) throw new Error(`RPC ${result.error.code}: ${result.error.message}`);
  return result.result;
}

function addResult(title, detail, good) { const item = document.createElement("li"); item.className = good ? "good" : "bad"; item.innerHTML = `<strong>${title}</strong>${detail}`; el.results.append(item); }
async function runCheck() {
  el.results.replaceChildren(); setStatus(el.nodeStatus, "확인 중", "neutral");
  try {
    const chainHex = await rpc("eth_chainId"); const chainId = BigInt(chainHex);
    addResult("Chain ID", `${chainId} / ${chainHex} · ${chainId === CHAIN_ID ? "expected와 일치" : "expected 31337 / 0x7a69"}`, chainId === CHAIN_ID);
    const blockHex = await rpc("eth_blockNumber"); addResult("Block Number", `${BigInt(blockHex)} (${blockHex}) · RPC 응답 정상`, true);
    if (account) { const balance = await rpc("eth_getBalance", [account, "latest"]); addResult("Account Balance", `${(Number(BigInt(balance)) / 1e18).toFixed(4)} ETH`, true); } else addResult("Account Balance", "MetaMask 연결 후 확인할 수 있습니다.", false);
    const address = el.contract.value.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(address)) { const code = await rpc("eth_getCode", [address, "latest"]); addResult("GiveChain Contract", code !== "0x" ? `${address} · code exists` : `${address} · code가 없습니다`, code !== "0x"); } else addResult("GiveChain Contract", "주소를 입력하면 eth_getCode를 확인합니다.", false);
    const allGood = [...el.results.children].every((item) => item.classList.contains("good")); setStatus(el.nodeStatus, allGood ? "정상" : "확인 필요", allGood ? "good" : "bad");
  } catch (error) { setStatus(el.nodeStatus, "연결 실패", "bad"); addResult("RPC 요청 실패", `${error.message} · HardHat Node 실행 여부를 확인하세요.`, false); }
}

el.connect.addEventListener("click", connectWallet); el.switchNetwork.addEventListener("click", switchNetwork); el.runCheck.addEventListener("click", runCheck);
el.save.addEventListener("click", () => { const address = el.contract.value.trim(); if (!/^0x[0-9a-fA-F]{40}$/.test(address)) { addResult("주소 형식", "유효한 컨트랙트 주소를 입력하세요.", false); return; } localStorage.setItem(ADDRESS_KEY, address); el.contract.value = address; addResult("주소 저장", "브라우저에 저장했습니다.", true); });
el.contract.value = localStorage.getItem(ADDRESS_KEY) ?? "";
if (window.ethereum) { window.ethereum.on("accountsChanged", connectWallet); window.ethereum.on("chainChanged", connectWallet); } else { setStatus(el.walletStatus, "MetaMask 필요", "bad"); message("MetaMask가 감지되지 않았습니다. 지갑 연결 기능을 사용하려면 설치하세요.", "bad"); }
