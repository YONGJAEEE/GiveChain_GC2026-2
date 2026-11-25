const connectButton = document.querySelector("#connect-button");
const accountValue = document.querySelector("#account-value");
const chainValue = document.querySelector("#chain-value");
const message = document.querySelector("#message");

async function connectWallet() {
  if (!window.ethereum) {
    message.textContent = "MetaMask를 찾을 수 없습니다.";
    message.className = "message error";
    return;
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const chainId = await window.ethereum.request({
      method: "eth_chainId",
    });

    accountValue.textContent = accounts[0] ?? "계정 없음";
    chainValue.textContent = `${chainId} (= ${parseInt(chainId, 16)})`;
    message.textContent = "MetaMask 계정과 Chain ID를 확인했습니다.";
    message.className = "message ok";
  } catch (error) {
    message.textContent = error.message ?? "지갑 연결에 실패했습니다.";
    message.className = "message error";
  }
}

connectButton.addEventListener("click", connectWallet);
