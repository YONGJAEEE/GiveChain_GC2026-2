# GiveChain Hardhat 프로젝트

GiveChain의 ETH-only V1과 ETH/ERC-20 이중 자산 V2를 함께 포함한 Hardhat 프로젝트입니다. V2의 GVT는 결제 완료 후 서비스 소유자가 `mintForCharge`로 발행하는 온디맨드 토큰입니다.

## 준비

- Node.js 22.13.0 이상
- npm

```bash
npm install
npm run compile
npm test
```

현재 자동 테스트는 V1/V2를 합쳐 18개이며, V2에서는 mint 권한, approve 없는 기부 실패, ERC-20 장부와 실제 잔액, ETH/ERC-20 자산 타입 분기, SUCCESS 출금, FAILED 환불, 중복 출금, 캠페인 권한과 수혜자 변경을 검증합니다.

## V2 로컬 실행

터미널 1에서 노드를 시작합니다.

```bash
npm run node
```

터미널 2에서 토큰과 체인을 배포합니다. 출력된 두 주소를 다음 명령에 사용합니다.

```bash
npm run deploy:v2:localhost
```

충전 발행과 전체 SUCCESS/FAILED 시나리오를 실행합니다.

```bash
TOKEN_ADDRESS=0x... CHARGE_USER=0x... CHARGE_AMOUNT=50000 npm run charge:gvt

TOKEN_ADDRESS=0x... \
GIVECHAIN_ADDRESS=0x... \
npm run scenario:v2
```

`scenario:v2`는 donor에게 1,000 GVT를 발행한 뒤 600 GVT 성공 캠페인과 100 GVT 실패 캠페인을 각각 만들고, approve → donate → finalize → withdraw/refund를 실행합니다. 마지막 결과는 donor 400 GVT, GiveChain 0 GVT입니다.

## Sepolia 배포

Sepolia 테스트 ETH와 RPC URL이 필요합니다. 비밀키를 파일이나 저장소에 넣지 않고 Hardhat 암호화 keystore에 저장합니다.

```bash
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npm run deploy:sepolia
```

Sepolia 네트워크 ID는 `11155111`입니다. 배포 계정에는 Sepolia ETH가 있어야 하며, Mainnet 개인키를 사용하면 안 됩니다. 배포 후 출력된 `GiveTokenV2`와 `GiveChainV2` 주소를 보관하고, 필요하면 같은 주소를 `charge:gvt`와 `scenario:v2`의 환경변수로 전달합니다.

Sepolia에서 충전 발행을 할 때는 네트워크만 바꿔 실행합니다.

```bash
TOKEN_ADDRESS=0x... CHARGE_USER=0x... CHARGE_AMOUNT=50000 npm run charge:sepolia
```

## 주요 파일

- `contracts/GiveTokenV2.sol`: OpenZeppelin ERC-20 + Ownable 기반 충전 발행 토큰
- `contracts/GiveChainV2.sol`: ETH/ERC-20 캠페인, SafeERC20 전송, 자산별 장부와 정산
- `contracts/GiveChain.sol`: 기존 ETH-only V1
- `test/GiveChainV2.ts`: V2의 권한·승인·기부·정산 자동 검증
- `scripts/deployV2.ts`: GiveTokenV2 → GiveChainV2 순서의 배포
- `scripts/chargeGVT.ts`: 서비스 충전 완료 후 GVT 발행 시뮬레이션
- `scripts/scenarioV2.ts`: V2 성공/실패 캠페인 엔드투엔드 시뮬레이션
- `hardhat.config.ts`: 로컬 네트워크와 Sepolia 설정

## MetaMask 지갑 확인

```bash
npm run web
```

`http://localhost:4173`에서 `frontend/wallet-check.html`을 열면 MetaMask 계정과 Chain ID를 확인할 수 있습니다. 로컬 노드는 RPC `http://127.0.0.1:8545`, chain ID `31338` (`0x7a6a`)입니다. 개인키는 웹 화면에 입력하지 말고, Hardhat이 출력하는 로컬 테스트 계정만 로컬 MetaMask에 가져오세요.
