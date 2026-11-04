import { BrowserProvider, Contract, ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.17.0/+esm";

const EXPECTED_CHAIN_ID = 31337n;
const EXPECTED_CHAIN_HEX = "0x7a69";
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const CONTRACT_STORAGE_KEY = "givechain.local.contractAddress";
const RPC_STORAGE_KEY = "givechain.local.rpcUrl";
const giveChainAbi = [
  "function campaignCount() view returns (uint256)",
  "function campaigns(uint256) view returns (address owner, string title, uint256 goal, uint256 raised, address beneficiary, uint8 stage)",
  "function createCampaign(string title, uint256 goal, address beneficiary) returns (uint256)",
  "function donate(uint256 id) payable", "function finalizeCampaign(uint256 id)", "function withdraw(uint256 id)", "function refund(uint256 id)",
];
const el = {
  connectionState: document.querySelector("#connection-state"), connectionLabel: document.querySelector("#connection-label"), account: document.querySelector("#account-value"), chain: document.querySelector("#chain-value"), balance: document.querySelector("#balance-value"), rpcValue: document.querySelector("#rpc-value"), badge: document.querySelector("#network-badge"), walletAlert: document.querySelector("#wallet-alert"), connect: document.querySelector("#connect-button"), switchNetwork: document.querySelector("#switch-network-button"), copyAccount: document.querySelector("#copy-account-button"), rpcUrl: document.querySelector("#rpc-url"), contractAddress: document.querySelector("#contract-address"), saveAddress: document.querySelector("#save-address-button"), rpcBadge: document.querySelector("#rpc-badge"), runCheck: document.querySelector("#run-check-button"), rpcResults: document.querySelector("#rpc-results"), readForm: document.querySelector("#read-campaign-form"), readId: document.querySelector("#read-campaign-id"), campaignOutput: document.querySelector("#campaign-output"), createForm: document.querySelector("#create-campaign-form"), campaignName: document.querySelector("#campaign-name"), campaignGoal: document.querySelector("#campaign-goal"), beneficiary: document.querySelector("#beneficiary-address"), donateForm: document.querySelector("#donate-form"), donateId: document.querySelector("#donate-id"), donationAmount: document.querySelector("#donation-amount"), actionCampaignId: document.querySelector("#action-campaign-id"), actionButtons: document.querySelectorAll("[data-action]"), log: document.querySelector("#activity-log"), clearLog: document.querySelector("#clear-log-button"),
};
let browserProvider; let signer; let connectedAccount;

function log(message, kind = "") { const item = document.createElement("li"); item.textContent = `${new Date().toLocaleTimeString()} · ${message}`; if (kind) item.classList.add(kind); el.log.prepend(item); }
function setConnectionState(state, label) { el.connectionState.dataset.state = state; el.connectionLabel.textContent = label; }
function setBadge(node, text, kind) { node.textContent = text; node.className = `badge ${kind}`; }
function setWalletAlert(text, kind = "info") { el.walletAlert.textContent = text; el.walletAlert.className = `inline-alert ${kind}`; }
function setNetworkStatus(chainId) {
  const isExpected = chainId === EXPECTED_CHAIN_ID;
  el.chain.textContent = chainId === undefined ? "확인 전" : `${chainId} ${isExpected ? "(GiveChain Local)" : "(불일치)"}`;
  setBadge(el.badge, isExpected ? "GiveChain Local 연결됨" : "31337 필요", isExpected ? "good" : "bad");
  if (chainId === undefined) setConnectionState("idle", "연결 대기"); else if (isExpected && connectedAccount) setConnectionState("good", "지갑 + 체인 확인됨"); else setConnectionState("bad", "네트워크 확인 필요");
}
function ethereum() { if (!window.ethereum) throw new Error("MetaMask를 찾을 수 없습니다. 브라우저 확장 프로그램을 설치하거나 활성화하세요."); return window.ethereum; }
function rpcUrl() { const value = el.rpcUrl.value.trim(); if (!value) throw new Error("RPC URL을 입력하세요."); try { new URL(value); } catch { throw new Error("유효한 RPC URL을 입력하세요."); } return value; }
async function rpcRequest(method, params = []) {
  const response = await fetch(rpcUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }) });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const data = await response.json(); if (data.error) throw new Error(`RPC ${data.error.code}: ${data.error.message}`); return data.result;
}
async function syncWallet() {
  const wallet = ethereum();
  const [accounts, chainHex] = await Promise.all([wallet.request({ method: "eth_accounts" }), wallet.request({ method: "eth_chainId" })]);
  const chainId = BigInt(chainHex); connectedAccount = accounts[0]; el.account.textContent = connectedAccount ?? "연결되지 않음"; el.copyAccount.disabled = !connectedAccount; setNetworkStatus(chainId);
  if (connectedAccount) {
    browserProvider = new BrowserProvider(wallet); signer = await browserProvider.getSigner(); if (!el.beneficiary.value) el.beneficiary.placeholder = connectedAccount;
    const balance = await browserProvider.getBalance(connectedAccount); el.balance.textContent = `${Number(ethers.formatEther(balance)).toFixed(4)} ETH`;
    setWalletAlert(chainId === EXPECTED_CHAIN_ID ? "지갑과 GiveChain Local 네트워크가 일치합니다." : "다른 네트워크가 선택되어 있습니다. GiveChain Local로 전환하세요.", chainId === EXPECTED_CHAIN_ID ? "good" : "bad");
  } else { signer = undefined; browserProvider = undefined; el.balance.textContent = "확인 전"; setWalletAlert("MetaMask 연결을 승인하면 계정과 Chain ID를 확인합니다."); }
}
async function connectWallet() { const wallet = ethereum(); await wallet.request({ method: "eth_requestAccounts" }); await syncWallet(); log("MetaMask 계정을 연결했습니다.", "success"); }
async function switchToHardhat() {
  const wallet = ethereum();
  try { await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: EXPECTED_CHAIN_HEX }] }); } catch (error) {
    if (error.code !== 4902) throw error;
    await wallet.request({ method: "wallet_addEthereumChain", params: [{ chainId: EXPECTED_CHAIN_HEX, chainName: "GiveChain Local", rpcUrls: [DEFAULT_RPC_URL], nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 } }] });
  }
  el.rpcUrl.value = DEFAULT_RPC_URL; localStorage.setItem(RPC_STORAGE_KEY, DEFAULT_RPC_URL); await syncWallet(); log("GiveChain Local 네트워크를 선택했습니다.", "success");
}
function saveRpcUrl() { const value = rpcUrl(); localStorage.setItem(RPC_STORAGE_KEY, value); el.rpcValue.textContent = value; }
function saveContractAddress() { const address = el.contractAddress.value.trim(); if (!ethers.isAddress(address)) throw new Error("유효한 GiveChain 컨트랙트 주소를 입력하세요."); localStorage.setItem(CONTRACT_STORAGE_KEY, address); el.contractAddress.value = address; log("GiveChain 컨트랙트 주소를 저장했습니다.", "success"); }
function getContractAddress() { const address = el.contractAddress.value.trim(); if (!ethers.isAddress(address)) throw new Error("GiveChain 컨트랙트 주소를 저장하세요."); return address; }
function getCampaignId(input) { const value = input.value.trim(); if (!/^\d+$/.test(value)) throw new Error("0 이상의 정수 캠페인 ID를 입력하세요."); return BigInt(value); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }

async function runNodeCheck() {
  const url = rpcUrl(); el.rpcValue.textContent = url; localStorage.setItem(RPC_STORAGE_KEY, url); setBadge(el.rpcBadge, "점검 중", "warning"); el.rpcResults.replaceChildren();
  const checks = []; const add = (label, value, good, detail) => { checks.push({ good }); el.rpcResults.insertAdjacentHTML("beforeend", `<div class="check-row ${good ? "good" : "bad"}"><span class="check-icon">${good ? "✓" : "!"}</span><span><strong>${escapeHtml(label)}: ${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></span></div>`); };
  try {
    const chainHex = await rpcRequest("eth_chainId"); const chainId = BigInt(chainHex); add("Chain ID", `${chainId} / ${chainHex}`, chainId === EXPECTED_CHAIN_ID, chainId === EXPECTED_CHAIN_ID ? "Hardhat Local과 일치합니다." : "expected 31337 / 0x7a69");
    const blockHex = await rpcRequest("eth_blockNumber"); add("Block", `${BigInt(blockHex)} (${blockHex})`, true, "노드가 JSON-RPC 요청에 응답했습니다.");
    if (connectedAccount) { const balanceHex = await rpcRequest("eth_getBalance", [connectedAccount, "latest"]); add("Account balance", `${Number(ethers.formatEther(BigInt(balanceHex))).toFixed(4)} ETH`, true, connectedAccount); } else add("Account balance", "건너뜀", false, "MetaMask 연결 후 다시 점검하세요.");
    const address = el.contractAddress.value.trim(); if (ethers.isAddress(address)) { const code = await rpcRequest("eth_getCode", [address, "latest"]); add("GiveChain code", code !== "0x" ? "exists" : "0x", code !== "0x", code !== "0x" ? address : "해당 주소에 배포된 코드가 없습니다."); } else add("GiveChain code", "건너뜀", false, "컨트랙트 주소를 입력하면 바이트코드를 확인합니다.");
    const failed = checks.filter((check) => !check.good).length; setBadge(el.rpcBadge, failed ? "확인 필요" : "정상", failed ? "bad" : "good"); log(failed ? "RPC 점검에서 확인이 필요한 항목이 있습니다." : "RPC 점검을 완료했습니다.", failed ? "" : "success");
  } catch (error) { setBadge(el.rpcBadge, "연결 실패", "bad"); el.rpcResults.insertAdjacentHTML("beforeend", `<div class="check-row bad"><span class="check-icon">!</span><span><strong>RPC 요청 실패</strong><small>${escapeHtml(error.message ?? "RPC에 연결할 수 없습니다.")} · Hardhat 노드가 실행 중인지 확인하세요.</small></span></div>`); throw error; }
}
async function getContract() { if (!signer || !browserProvider) throw new Error("먼저 MetaMask를 연결하세요."); const network = await browserProvider.getNetwork(); if (network.chainId !== EXPECTED_CHAIN_ID) throw new Error("GiveChain Local(31337) 네트워크로 전환하세요."); const address = getContractAddress(); if (await browserProvider.getCode(address) === "0x") throw new Error("이 주소에는 컨트랙트가 없습니다. 노드와 배포 주소를 확인하세요."); return new Contract(address, giveChainAbi, signer); }
async function refreshCampaign() { const contract = await getContract(); const id = getCampaignId(el.readId); const count = await contract.campaignCount(); if (id >= count) throw new Error(`캠페인 ${id}은(는) 없습니다. 현재 캠페인 수: ${count}`); const campaign = await contract.campaigns(id); const stages = ["NONE", "OPEN", "SUCCESS", "FAILED"]; el.campaignOutput.textContent = JSON.stringify({ id:id.toString(), owner:campaign.owner, title:campaign.title, goalEth:ethers.formatEther(campaign.goal), raisedEth:ethers.formatEther(campaign.raised), beneficiary:campaign.beneficiary, stage:stages[Number(campaign.stage)] ?? String(campaign.stage) }, null, 2); log(`캠페인 ${id}을 조회했습니다.`, "success"); }
async function sendTransaction(label, callback) { const contract = await getContract(); log(`${label} 트랜잭션을 MetaMask에 요청했습니다.`); const tx = await callback(contract); log(`${label} 전송: ${tx.hash}`); await tx.wait(); log(`${label} 완료`, "success"); await refreshCampaign().catch(() => undefined); }
async function handle(action) { try { await action(); } catch (error) { log(error.shortMessage ?? error.message ?? "요청을 처리하지 못했습니다.", "error"); } }

el.connect.addEventListener("click", () => handle(connectWallet)); el.switchNetwork.addEventListener("click", () => handle(switchToHardhat)); el.copyAccount.addEventListener("click", () => handle(async () => { if (!connectedAccount) throw new Error("복사할 계정이 없습니다."); await navigator.clipboard.writeText(connectedAccount); log("MetaMask 계정 주소를 복사했습니다.", "success"); })); el.rpcUrl.addEventListener("change", () => handle(async () => saveRpcUrl())); el.saveAddress.addEventListener("click", () => handle(async () => saveContractAddress())); el.runCheck.addEventListener("click", () => handle(runNodeCheck)); el.clearLog.addEventListener("click", () => el.log.replaceChildren());
el.readForm.addEventListener("submit", (event) => { event.preventDefault(); handle(refreshCampaign); });
el.createForm.addEventListener("submit", (event) => { event.preventDefault(); handle(async () => { const title = el.campaignName.value.trim(); const goal = ethers.parseEther(el.campaignGoal.value.trim()); const beneficiary = el.beneficiary.value.trim() || connectedAccount; if (!title) throw new Error("캠페인 제목을 입력하세요."); if (!beneficiary || !ethers.isAddress(beneficiary)) throw new Error("유효한 수혜자 주소를 입력하세요."); await sendTransaction("캠페인 생성", (contract) => contract.createCampaign(title, goal, beneficiary)); }); });
el.donateForm.addEventListener("submit", (event) => { event.preventDefault(); handle(async () => { const id = getCampaignId(el.donateId); const amount = ethers.parseEther(el.donationAmount.value.trim()); await sendTransaction("기부", (contract) => contract.donate(id, { value: amount })); }); });
el.actionButtons.forEach((button) => button.addEventListener("click", () => handle(async () => { const id = getCampaignId(el.actionCampaignId); const action = button.dataset.action; const labels = { finalize:"캠페인 마감", withdraw:"출금", refund:"환불" }; await sendTransaction(labels[action], (contract) => contract[action === "finalize" ? "finalizeCampaign" : action](id)); })));
el.rpcUrl.value = localStorage.getItem(RPC_STORAGE_KEY) ?? DEFAULT_RPC_URL; el.rpcValue.textContent = el.rpcUrl.value; el.contractAddress.value = localStorage.getItem(CONTRACT_STORAGE_KEY) ?? ""; setNetworkStatus(undefined);
if (window.ethereum) { window.ethereum.on("accountsChanged", () => handle(syncWallet)); window.ethereum.on("chainChanged", () => handle(syncWallet)); handle(syncWallet); } else { setConnectionState("bad", "MetaMask 필요"); setWalletAlert("MetaMask가 감지되지 않았습니다. 브라우저 확장 프로그램을 설치하세요.", "bad"); }
