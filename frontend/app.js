import { BrowserProvider, Contract, ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.17.0/+esm";

const HARDHAT_CHAIN_ID = 31337n;
const HARDHAT_CHAIN_HEX = "0x7a69";
const CONTRACT_STORAGE_KEY = "givechain.local.contractAddress";

const giveChainAbi = [
  "function campaignCount() view returns (uint256)",
  "function campaigns(uint256) view returns (address owner, string title, uint256 goal, uint256 raised, address beneficiary, uint8 stage)",
  "function createCampaign(string title, uint256 goal, address beneficiary) returns (uint256)",
  "function donate(uint256 id) payable",
  "function finalizeCampaign(uint256 id)",
  "function withdraw(uint256 id)",
  "function refund(uint256 id)",
];

const el = {
  account: document.querySelector("#account-value"),
  chain: document.querySelector("#chain-value"),
  badge: document.querySelector("#network-badge"),
  connect: document.querySelector("#connect-button"),
  switchNetwork: document.querySelector("#switch-network-button"),
  contractAddress: document.querySelector("#contract-address"),
  saveAddress: document.querySelector("#save-address-button"),
  readForm: document.querySelector("#read-campaign-form"),
  readId: document.querySelector("#read-campaign-id"),
  campaignOutput: document.querySelector("#campaign-output"),
  createForm: document.querySelector("#create-campaign-form"),
  campaignName: document.querySelector("#campaign-name"),
  campaignGoal: document.querySelector("#campaign-goal"),
  beneficiary: document.querySelector("#beneficiary-address"),
  donateForm: document.querySelector("#donate-form"),
  donateId: document.querySelector("#donate-id"),
  donationAmount: document.querySelector("#donation-amount"),
  actionCampaignId: document.querySelector("#action-campaign-id"),
  actionButtons: document.querySelectorAll("[data-action]"),
  log: document.querySelector("#activity-log"),
};

let browserProvider;
let signer;

function log(message, isError = false) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
  if (isError) item.classList.add("error");
  el.log.prepend(item);
}

function setNetworkStatus(chainId) {
  const isHardhat = chainId === HARDHAT_CHAIN_ID;
  el.chain.textContent = chainId === undefined ? "확인 전" : `${chainId} ${isHardhat ? "(Hardhat Local)" : ""}`;
  el.badge.textContent = isHardhat ? "Hardhat Local 연결됨" : "31337 필요";
  el.badge.className = `badge ${isHardhat ? "good" : "warning"}`;
}

function ethereum() {
  if (!window.ethereum) {
    throw new Error("MetaMask를 찾을 수 없습니다. 브라우저 확장 프로그램을 설치하거나 활성화하세요.");
  }
  return window.ethereum;
}

async function syncWallet() {
  const wallet = ethereum();
  const [accounts, chainHex] = await Promise.all([
    wallet.request({ method: "eth_accounts" }),
    wallet.request({ method: "eth_chainId" }),
  ]);
  const chainId = BigInt(chainHex);
  setNetworkStatus(chainId);
  el.account.textContent = accounts[0] ?? "연결되지 않음";

  if (accounts[0]) {
    browserProvider = new BrowserProvider(wallet);
    signer = await browserProvider.getSigner();
    if (!el.beneficiary.value) el.beneficiary.placeholder = accounts[0];
  } else {
    signer = undefined;
  }
}

async function connectWallet() {
  const wallet = ethereum();
  await wallet.request({ method: "eth_requestAccounts" });
  await syncWallet();
  log("MetaMask 계정을 연결했습니다.");
}

async function switchToHardhat() {
  const wallet = ethereum();
  try {
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HARDHAT_CHAIN_HEX }] });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: HARDHAT_CHAIN_HEX,
        chainName: "Hardhat Local",
        rpcUrls: ["http://127.0.0.1:8545"],
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      }],
    });
  }
  await syncWallet();
  log("Hardhat Local 네트워크를 선택했습니다.");
}

function saveContractAddress() {
  const address = el.contractAddress.value.trim();
  if (!ethers.isAddress(address)) throw new Error("유효한 GiveChain 주소를 입력하세요.");
  localStorage.setItem(CONTRACT_STORAGE_KEY, address);
  el.contractAddress.value = address;
  log("GiveChain 주소를 브라우저에 저장했습니다.");
}

async function getContract() {
  if (!signer || !browserProvider) throw new Error("먼저 MetaMask를 연결하세요.");
  const network = await browserProvider.getNetwork();
  if (network.chainId !== HARDHAT_CHAIN_ID) throw new Error("Hardhat Local(31337) 네트워크로 전환하세요.");

  const address = el.contractAddress.value.trim();
  if (!ethers.isAddress(address)) throw new Error("GiveChain 컨트랙트 주소를 저장하세요.");
  const bytecode = await browserProvider.getCode(address);
  if (bytecode === "0x") throw new Error("이 주소에는 컨트랙트가 없습니다. 로컬 노드와 배포 주소를 확인하세요.");
  return new Contract(address, giveChainAbi, signer);
}

function getCampaignId(input) {
  const value = input.value.trim();
  if (!/^\d+$/.test(value)) throw new Error("0 이상의 정수 캠페인 ID를 입력하세요.");
  return BigInt(value);
}

async function refreshCampaign() {
  const contract = await getContract();
  const id = getCampaignId(el.readId);
  const count = await contract.campaignCount();
  if (id >= count) throw new Error(`캠페인 ${id}은(는) 없습니다. 현재 캠페인 수: ${count}`);

  const campaign = await contract.campaigns(id);
  const stages = ["NONE", "OPEN", "SUCCESS", "FAILED"];
  el.campaignOutput.textContent = JSON.stringify({
    id: id.toString(),
    owner: campaign.owner,
    title: campaign.title,
    goalEth: ethers.formatEther(campaign.goal),
    raisedEth: ethers.formatEther(campaign.raised),
    beneficiary: campaign.beneficiary,
    stage: stages[Number(campaign.stage)] ?? String(campaign.stage),
  }, null, 2);
}

async function sendTransaction(label, callback) {
  const contract = await getContract();
  log(`${label} 트랜잭션을 MetaMask에 요청했습니다.`);
  const tx = await callback(contract);
  log(`${label} 전송: ${tx.hash}`);
  await tx.wait();
  log(`${label} 완료`);
  await refreshCampaign().catch(() => undefined);
}

async function handle(action) {
  try {
    await action();
  } catch (error) {
    log(error.shortMessage ?? error.message ?? "요청을 처리하지 못했습니다.", true);
  }
}

el.connect.addEventListener("click", () => handle(connectWallet));
el.switchNetwork.addEventListener("click", () => handle(switchToHardhat));
el.saveAddress.addEventListener("click", () => handle(async () => saveContractAddress()));
el.readForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handle(refreshCampaign);
});
el.createForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handle(async () => {
    const title = el.campaignName.value.trim();
    const goal = ethers.parseEther(el.campaignGoal.value.trim());
    const beneficiary = el.beneficiary.value.trim() || signer.address;
    if (!title) throw new Error("캠페인 제목을 입력하세요.");
    if (!ethers.isAddress(beneficiary)) throw new Error("유효한 수혜자 주소를 입력하세요.");
    await sendTransaction("캠페인 생성", (contract) => contract.createCampaign(title, goal, beneficiary));
  });
});
el.donateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handle(async () => {
    const id = getCampaignId(el.donateId);
    const amount = ethers.parseEther(el.donationAmount.value.trim());
    await sendTransaction("기부", (contract) => contract.donate(id, { value: amount }));
  });
});
el.actionButtons.forEach((button) => {
  button.addEventListener("click", () => handle(async () => {
    const id = getCampaignId(el.actionCampaignId);
    const action = button.dataset.action;
    const labels = { finalize: "캠페인 마감", withdraw: "출금", refund: "환불" };
    await sendTransaction(labels[action], (contract) => contract[`${action === "finalize" ? "finalizeCampaign" : action}`](id));
  }));
});

el.contractAddress.value = localStorage.getItem(CONTRACT_STORAGE_KEY) ?? "";

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => handle(syncWallet));
  window.ethereum.on("chainChanged", () => handle(syncWallet));
  handle(syncWallet);
}
