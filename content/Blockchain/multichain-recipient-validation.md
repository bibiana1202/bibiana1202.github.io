---
title: "멀티체인 지갑의 전송 전 수신자 검증"
date: "2026-10-08T16:00:00+09:00"
tags: [blockchain, wallet, backend, transaction, validation]
draft: false
description: "EVM, SOL, TON, TRON, XRP, UTXO의 수신자 상태와 토큰 전송 제한을 확인하는 방법."
---

멀티체인 지갑에서 전송 전에 확인하는 수신자 검증을 체인별로 정리했다. 네이티브 코인과 토큰은 확인할 항목이 다르고, 토큰의 동결이나 블랙리스트도 체인과 컨트랙트에 따라 처리 방식이 다르다.

## EVM

### 1. 네이티브 ETH 전송 수신자 선검증

**1) 컨트랙트 주소 처리**

초기 구현에서는 수신자가 컨트랙트 주소이면 전송을 차단했다. 컨트랙트 주소 자체가 위험해서가 아니라, 당시 wallet-util이 컨트랙트 수신자에게 네이티브 코인을 보낼 때 필요한 gasLimit과 fee option 전달을 안정적으로 지원하지 못했기 때문이다.

현재 코드는 주소 형식을 확인하고, 컨트랙트 주소도 일괄 차단하지 않는다. 실제 전송 가능 여부는 다음 단계의 가스 추정에서 확인한다.

**2) Native value transfer 시뮬레이션**

`estimateNativeTransferFee()`에서 `provider.estimateGas()`를 호출한다. 현재 상태에서 실제 전송이 실행 가능한지 시뮬레이션하면서 gasLimit을 추정한다.

수신 컨트랙트가 전송을 거절하는 등 실행이 실패하면 `EVM_NATIVE_RECIPIENT_REJECTED`로 처리한다.

### 2. ERC-20 토큰 전송 수신자 선검증

표준 ERC-20에는 수신자 지갑의 락 여부를 조회하는 함수가 없다. 따라서 실제 `transfer`가 현재 상태에서 성공 가능한지 `eth_call`로 시뮬레이션한다.

락, 블랙리스트, paused, freeze 같은 제한은 토큰 컨트랙트별 구현이다. 다음 함수들은 ERC-20 표준 ABI에 포함된 공통 함수가 아니다. [ERC-20 표준](https://eips.ethereum.org/EIPS/eip-20)

```solidity
isLocked(address)
isBlacklisted(address)
paused()
frozen(address)
```

토큰마다 함수 이름과 인자도 다르다. 어떤 토큰은 다음 형태를 사용한다.

```solidity
function paused() external view returns (bool);
function isBlacklisted(address account) external view returns (bool);
```

다른 토큰은 다음과 같은 이름을 사용한다.

```solidity
function blacklist(address account) external view returns (bool);
function frozen(address account) external view returns (bool);
function isFrozen(address account) external view returns (bool);
```

별도 조회 함수 없이 `transfer()` 안에서만 전송을 막는 토큰도 있다. 따라서 제한 상태를 직접 조회하려면 토큰별 ABI에 맞춰 확인해야 한다.

### 3. 토큰별 제한 조회를 추가하는 방법

**1) 기본은 transfer 시뮬레이션**

별도의 락 조회 함수가 없어도, 실제 전송을 막는 조건은 `transfer` 시뮬레이션에서 확인할 수 있다. 현재 코드는 호출이 revert되는 경우뿐 아니라 `transfer`가 `false`를 반환하는 경우도 거절로 처리한다.

**2) 알려진 토큰·ABI만 추가 조회**

특정 토큰의 제한 사유를 더 자세히 확인해야 한다면 해당 ABI에 맞는 함수를 추가로 조회할 수 있다.

```text
paused()
isBlacklisted(address)
blacklisted(address)
isFrozen(address)
frozen(address)
```

**3) 선택적 조회와 전송 검증을 구분**

없는 함수를 호출하면 revert되거나 빈 결과가 나올 수 있다. 선택적으로 확인하는 제한 조회의 실패만으로 정상 토큰의 전송까지 막지 않도록, 지원하는 토큰에 한해 확인하는 best-effort 방식으로 사용한다. 실제 `transfer` 시뮬레이션의 거절을 무시한다는 뜻은 아니다.

없는 함수까지 반복해서 호출하면 RPC 요청이 늘어난다. 토큰별 ABI, 프록시, 커스텀 revert 처리에 따라 오탐이 생길 수도 있다.

그래서 기본은 `transfer eth_call`로 두고, 운영 중 특정 토큰의 실패 사유를 파악하기 어렵거나 같은 문제가 반복되면 그 토큰의 ABI에 맞는 restriction check를 설정으로 추가하는 순서로 접근한다.

## SOL

### 1. 네이티브 SOL 전송 수신자 선검증

**1) 신규 계정의 최소 전송 금액 확인**

현재 구현은 수신자 잔액이 0이면 신규 계정으로 보고, 전송 금액이 rent-exempt 기준 이상인지 확인한다. 잔액이 있는 계정이면 이 신규 계정 최소 금액 검사를 통과한다.

최소 금액은 고정 숫자로 두지 않고 `getMinimumBalanceForRentExemption(0)`으로 조회한다. 일반 SOL 계정은 데이터 크기 0을 기준으로 하며, SPL 토큰 계정인 ATA를 만들 때 필요한 잔액과 구분한다. 이 RPC는 계정의 데이터 크기에 맞는 최소 잔액을 반환한다. [Solana 최소 잔액 조회](https://solana.com/docs/rpc/http/getminimumbalanceforrentexemption)

### 2. SPL 토큰 전송 수신자 선검증

**1) Frozen ATA 확인**

수신자의 ATA가 이미 존재하고 `isFrozen === true`이면 토큰 전송을 거절한다.

Mint에는 decimals, 총 발행량, freeze authority 같은 토큰 정보가 담겨 있다. 토큰 잔액은 각 token account에 저장되며, 여기서는 지갑별 ATA(Associated Token Account)를 사용한다.

```text
Mint — USDC 토큰 정보
├─ 지갑 A의 ATA → 잔액 100
├─ 지갑 B의 ATA → 잔액 50, isFrozen: true
└─ 지갑 C의 ATA → 잔액 200
```

**2) Freeze authority와 동결 대상**

Freeze authority는 해당 Mint에 속한 특정 token account를 동결할 수 있는 권한이다. 기본 SPL Token의 freeze는 Mint 전체를 한 번에 동결하는 기능이 아니라, 개별 token account의 상태를 바꾼다. 동결된 계정은 해제되기 전까지 토큰을 받거나 전송할 수 없다. [Solana Freeze Account](https://solana.com/docs/tokens/basics/freeze-account)

예를 들어 토큰 발행사가 지갑 B의 USDC ATA를 동결하면 다음과 같은 상태가 된다.

```text
지갑 A의 USDC ATA → isFrozen: false
지갑 B의 USDC ATA → isFrozen: true  ← 이 계정의 입출금 제한
지갑 C의 USDC ATA → isFrozen: false
```

잔액이 많아도 동결된 계정은 전송이 제한된다. 반대로 잔액이 0이어도 동결 상태일 수 있다.

EVM 토큰의 `blacklist(address)`와 비교하면 전송을 제한한다는 결과는 비슷하지만, Solana에서는 독립된 token account의 상태를 확인한다는 차이가 있다.

## TON

### 1. 네이티브 TON 전송

TON에서는 Solana의 신규 계정 rent-exempt 검사와 같은 방식으로 수신자 최소 잔액을 검사하지 않는다. 미초기화 주소에도 TON을 보낼 수 있다.

다만 미초기화 주소에 보낼 때는 메시지의 bounce 설정을 맞춰야 한다. “미초기화 주소로 보낼 수 있다”는 것이 모든 주소와 메시지 조건에서 전송이 성공한다는 뜻은 아니다. [TON 주소와 계정 상태](https://docs.ton.org/foundations/addresses/overview)

### 2. Jetton 전송

Jetton 표준 TEP-74에는 Solana SPL의 `isFrozen`처럼 공통으로 조회할 수 있는 freeze·blacklist 인터페이스가 없다. 따라서 모든 Jetton에 같은 함수를 호출해 수신자의 제한 상태를 확인할 수는 없다. [Jetton 표준 TEP-74](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md)

USDT 같은 개별 토큰의 블랙리스트·전송 제한을 확인하려면 해당 컨트랙트의 구현과 조회 방법에 맞춰 별도 로직이 필요하다.

```text
Jetton 표준의 공통 제한 조회 함수 없음
    ↓
토큰 컨트랙트별 지원 기능 확인
    ↓
필요한 토큰에 한해 개별 검증 구현
```

이 프로젝트에서는 Jetton별 블랙리스트 조회를 공통 수신자 검사로 구현하지 않는다. EVM의 `eth_call`과 같은 방식을 그대로 적용할 수 없으며, 별도의 에뮬레이션을 활용하더라도 토큰과 메시지 흐름에 맞춘 처리가 필요하다.

## TRON

### 1. 네이티브 TRX 전송

별도의 수신자 활성화 검사를 중복해서 넣지 않는다. 수수료 조회 함수인 `estimateNativeTransferFee()` 안에서 `recipientActivated`를 이미 확인하기 때문이다.

비활성 수신자를 활성화하는 비용도 수수료 계산에 포함한다. 수신자 활성화 여부 확인과 비용 계산이 함께 이뤄지는 구조다.

### 2. TRC-20 전송

**1) Transfer 시뮬레이션**

TRON의 `triggerConstantContract`로 실제 `transfer` 호출을 시뮬레이션한다. EVM에서 `eth_call`로 전송 가능 여부를 확인하는 것과 비슷한 역할이다. [TRON TriggerConstantContract](https://developers.tron.network/reference/triggerconstantcontract)

USDT TRC-20의 블랙리스트처럼 토큰 컨트랙트가 전송을 거절하는 조건을 확인할 수 있다.

```text
triggerConstantContract로 transfer 호출
    ↓
실행 결과 확인
    ├─ 전송 거절 없음 → 다음 검증 단계 진행
    └─ 컨트랙트가 전송 거절 → TRON_TOKEN_RECIPIENT_REJECTED
```

실제 컨트랙트 코드를 실행해 보기 때문에, 단순한 주소 형식 검사보다 구체적인 전송 제한을 확인할 수 있다. 다만 시뮬레이션 시점의 상태에 대한 결과이므로 이후 상태 변화까지 보장하지는 않는다.

## XRP

### 1. 신규 수신 계정의 활성화 금액 확인

신규 주소에 XRP를 보내 계정을 활성화하려면 전송 금액이 해당 네트워크의 `base_reserve` 이상이어야 한다. 부족하면 `tecNO_DST_INSUF_XRP`로 거절될 수 있다.

현재 검증 흐름은 다음과 같다.

```text
account_info(destination)
    ↓
actNotFound이면 신규 계정
    ↓
전송 금액 < base_reserve
    ↓
422102 — XRP_RECIPIENT_NOT_ACTIVATED
```

`base_reserve`는 `server_info`에서 조회한다. 준비금은 네트워크 설정이므로 고정된 2 XRP로 설명하지 않고 조회값을 사용한다. [XRPL Reserves](https://xrpl.org/docs/concepts/accounts/reserves)

현재 코드는 이 검사를 preflight에서 실행한다. 계정 조회 실패 중 `actNotFound`만 신규 계정으로 판단하고, timeout 같은 RPC 오류는 따로 처리한다.

### 2. Deposit Authorization 확인

수신 계정이 `lsfDepositAuth` 플래그를 켜면 입금 인가 조건이 적용된다. 인가 조건을 충족하지 못한 전송은 `tecNO_PERMISSION`으로 실패할 수 있다. 사전 인가와 예외 조건은 XRPL 규칙에 따라 판단한다. [XRPL Deposit Authorization](https://xrpl.org/docs/concepts/accounts/depositauth)

프로젝트의 현재 구현은 아래 비트로 플래그를 확인한다.

```javascript
account_data.Flags & 0x01000000
```

플래그가 설정돼 있으면 `422110`, `XRP_RECIPIENT_DEPOSIT_AUTH`로 반환한다. 이 구현은 발신자의 실제 사전 인가 여부까지 조회하지 않고, Deposit Authorization이 설정된 수신자를 차단하는 정책이다.

## UTXO

### 1. 별도의 계정 활성화·동결 검사가 없는 이유

BTC·LTC·DOGE의 네이티브 전송에는 계정 기반 체인의 수신자 활성화·동결 검사를 그대로 적용하지 않는다.

- **계정 활성화 상태가 없다.** 주소 잔액이 0이어도 그 자체로 전송 대상에서 제외하지 않는다.
- **주소 동결 기능이 없다.** BTC·LTC·DOGE의 기본 프로토콜에는 토큰 발행사가 특정 주소를 동결하는 것과 같은 기능이 없다.
- **토큰 전송은 별도로 차단한다.** 이 프로젝트의 UTXO 서비스에서는 `UTXO_TOKEN_UNSUPPORTED`로 처리한다.
- **주소 형식은 검증한다.** API 레이어에서 잘못된 주소를 `422008`로 처리한다.

따라서 “수신자 검증이 필요 없다”는 것은 계정 활성화나 토큰 동결 검사를 따로 하지 않는다는 의미다. 주소 형식, 네트워크, 금액과 dust 조건 같은 전송 검증은 별도로 필요하다.
