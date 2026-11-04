# GiveChain Hardhat 프로젝트

제공된 GiveChain 자료의 통합 설계를 실행 가능한 Hardhat 프로젝트로 옮긴 코드입니다.

## 준비

- Node.js 22.13.0 이상
- npm

## 컴파일과 자동 검증

```bash
npm install
npm run compile
npm test
```

`npm test`는 캠페인 생성, 다중 캠페인 독립성, 기부 장부와 실제 ETH 잔액, SUCCESS/FAILED 상태 전이, 출금/환불 권한, 이벤트 인자, 중복 환불과 재진입 공격 시나리오를 검증합니다. 실패한 캠페인의 환불에서는 donor의 실제 ETH 잔액이 정확히 증가하는지도 함께 검증합니다.

## 로컬 노드와 배포

터미널을 두 개 사용합니다.

터미널 1:

```bash
npm run node
```

터미널 2:

```bash
npm run deploy:localhost
```

노드는 `http://127.0.0.1:8545`, chain ID `31337`을 사용합니다. MetaMask에서 이 네트워크를 추가하고, `npm run node`가 출력하는 테스트 계정을 가져오면 로컬 지갑으로 호출할 수 있습니다. 출력된 개인키는 로컬 테스트 전용이며 실제 네트워크에서 사용하면 안 됩니다.

## MetaMask 연동 화면

로컬 노드와 배포를 마친 뒤, 세 번째 터미널에서 다음을 실행합니다.

```bash
npm run web
```

브라우저에서 `http://localhost:4173`을 열고 다음 순서로 진행합니다.

1. **MetaMask 연결**을 누릅니다. 앱은 `eth_requestAccounts`와 `eth_chainId`로 지갑 주소와 네트워크를 확인합니다.
2. **Hardhat Local로 전환**을 누릅니다. MetaMask에 없다면 RPC `http://127.0.0.1:8545`, chain ID `31337`, 통화 `ETH`로 추가합니다.
3. `npm run deploy:localhost`가 출력한 GiveChain 주소를 입력하고 저장합니다.
4. 캠페인 조회·생성·기부·마감·출금·환불을 실행합니다. 모든 상태 변경은 MetaMask에서 사용자가 직접 서명합니다.

개인키는 웹 화면이나 저장소에 입력하지 않습니다. Hardhat이 출력한 공개 테스트 계정의 개인키만 MetaMask에 가져오고, 실제 자산이나 Mainnet 계정에는 사용하지 마세요.

## 주요 파일

- `contracts/GiveChain.sol`: 다중 캠페인 통합 컨트랙트
- `contracts/RefundAttacker.sol`: 환불 재진입 검증용 테스트 컨트랙트
- `test/GiveChain.ts`: Mocha + ethers v6 자동 검증
- `scripts/deploy.ts`: 로컬 네트워크 배포 스크립트
- `hardhat.config.ts`: Hardhat 3와 로컬 `solc 0.8.20` 설정

## 자료 범위 반영

- 다중 캠페인 데이터 모델과 `createCampaign`, `donate`, `finalizeCampaign`, `withdraw`, `refund` 생명주기는 `contracts/GiveChain.sol`에 구현되어 있습니다.
- 역할별 signer, 테스트 격리, 상태 전이, 이벤트, 접근 제어, 중복 환불, 실제 잔액, 재진입 공격 검증은 `test/GiveChain.ts`에 포함되어 있습니다.
- `scripts/deploy.ts`는 로컬 Hardhat 노드에 배포할 수 있습니다. `npm run node`를 실행한 뒤 별도 터미널에서 `npm run deploy:localhost`를 실행하세요.
- `frontend/`는 MetaMask 연결과 GiveChain 호출을 위한 정적 브라우저 화면입니다. `window.ethereum.request(...)`로 주소와 chain ID를 확인하며, 개인키를 다루지 않습니다.
