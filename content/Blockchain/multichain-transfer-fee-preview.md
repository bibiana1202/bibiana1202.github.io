---
title: "멀티체인 지갑의 수수료 조회: EVM부터 XRP까지"
date: "2026-10-08T10:30:00+09:00"
tags: [blockchain, wallet, backend, transaction, fee]
draft: false
description: "멀티체인 지갑의 수수료 조회를 구현하며 정리한 체인별 계산 흐름과 테스트 기록."
---

멀티체인 지갑의 수수료 조회를 구현하면서 정리한 테스트 결과와 체인별 계산 흐름이다.

## 테스트

- XRP — rippled RPC fee — 1 XRP 전송 → 0.00001 XRP (10 drops) ✅
- BTC — fee rate × vBytes — 0.00001 BTC 전송 → 0.00000452 BTC (2 sat/vByte) ✅
- LTC — fee rate × vBytes — 0.1 LTC 전송 → 0.00000226 LTC (1 litoshi/vByte) ✅
- DOGE — fee rate × vBytes — 1 DOGE 전송 → 0.106896 DOGE (48,177 koinu/vByte) ✅
- TON 네이티브 — TonCenter v2 `/estimateFee` 시뮬레이션 — 1 TON 전송 → 약 0.00039 TON ✅
- TON Jetton — TonCenter v2 `/estimateFee` 시뮬레이션 — 1 USDT 전송 → 약 0.00049 TON ✅
- SOL 네이티브 — `getFeeForMessage` 조회 — 0.01 SOL 전송 → 0.000005 SOL ✅
- SOL USDC — `getFeeForMessage` + ATA rent — 0.04 USDC 전송 → 0.00204428 SOL ✅
- POL 네이티브 — `estimateGas` + `getFeeData` (EVM) — 0.1 POL 전송 → 예상 0.0060765 / 최대 0.0079010 POL ✅
- POL USDT — `estimateGas` + `getFeeData` (EVM) — 1 USDT 전송 → 예상 0.0141269 / 최대 0.0155181 POL ✅

수수료는 네트워크 상태와 전송 조건에 따라 달라질 수 있다.

## EVM

현재 네트워크 상태와 해당 트랜잭션 형태를 기준으로 ethers를 통해 계산한 수수료 추정값을 가져온다.

### 1. EVM 네이티브 전송 미리보기

1. `amount`를 wei로 변환한다.
2. 수수료를 추정한다. 구현 당시 정리한 `estimatePreparedTransactionFee()`의 계산 흐름은 다음과 같다.
   - `estimateGas()`로 gasLimit 추정
   - `getFeeData()`로 gasPrice, maxFeePerGas 조회
   - `estimatedFeeNative = gasLimit × 현재 feePerGas`
   - `maxFeeNative = gasLimit × maxFeePerGas`
3. 발신자의 네이티브 잔액을 조회한다.
4. 전송 금액과 최대 가스비를 합쳐 필요한 잔액을 계산한다.
5. `canCoverTotalCost`로 잔액이 충분한지 확인한다.

네이티브 전송은 보내는 금액과 가스비를 같은 코인으로 낸다.

```text
requiredNative = 전송 금액 + 최대 가스비
```

핵심 필드의 의미는 다음과 같다.

| 필드 | 의미 |
|---|---|
| `estimatedFeeNative` | 예상 수수료 |
| `maxFeeNative` | 최대 가스비 |
| `canCoverTotalCost` | 전송 금액과 최대 가스비를 모두 감당할 수 있는지 |

### 2. ERC-20 토큰 전송 미리보기

ERC-20 토큰 전송을 실제로 보낼 형태 그대로 한 번 시뮬레이션해서 가스비를 계산한다.

1. **송신자 주소 검증:** `from`이 유효한 EVM 주소인지 확인한다.
2. **토큰 정보 조회:** ERC-20 컨트랙트의 `decimals()`를 조회한다.
3. **전송 수량 변환:** 사용자가 입력한 `amount`를 토큰 최소 단위로 변환한다. 예를 들어 USDC 1.5개는 decimals가 6이면 `1500000`이다.
4. **실제 전송 calldata 생성:** `transfer(toAddress, amountInWei)` 호출 데이터를 만든다.
5. **가스량·단가·잔액 병렬 조회:** 아래 세 가지를 함께 조회한다.

| 호출 | 조회 내용 |
|---|---|
| `estimateGas(...)` | 이 ERC-20 전송에 필요한 gas 추정 |
| `getFeeData()` | 현재 gasPrice, maxFeePerGas, maxPriorityFeePerGas |
| `getBalance(fromAddress)` | 송신자가 가스비를 낼 네이티브 잔액 |

조회 결과로 수수료를 계산한다.

```text
estimatedFeeWei = gasEstimate × 현재 feePerGas
maxFeeWei = gasEstimate × maxFeePerGas
```

이를 네이티브 단위로 바꿔 `estimatedFeeNative`, `maxFeeNative`로 반환한다.

ERC-20 전송은 토큰을 보내지만, 가스비는 ETH 같은 네이티브 코인으로 낸다. 따라서 `canCoverFeeWithBalance`에서는 다음 조건을 확인한다.

```text
네이티브 잔액 >= 최대 가스비
```

## SOL

Solana 관련 라이브러리는 다음과 같이 사용한다.

- `@solana/web3.js`: `Connection`, `PublicKey`, `SystemProgram`, `Transaction` 등으로 RPC 연결과 트랜잭션 구성, `getFeeForMessage` 호출을 처리한다.
- `@solana/spl-token`: `getAssociatedTokenAddress`, `createTransferInstruction`, `getMint`, `getAccount` 등으로 SPL 토큰 전송을 처리한다.

### 1. SOL 네이티브 전송 수수료 미리보기

1. `from`, `to` 주소를 `PublicKey`로 변환한다.
2. 보낼 `amount`를 lamports로 변환한다.
3. 최신 blockhash를 조회한다.
4. 실제 SOL 전송과 똑같이 `feePayer = from`과 `SystemProgram.transfer(...)`를 넣은 트랜잭션 메시지를 생성한다.
5. `getFeeForMessage()`를 호출해 이 메시지의 네트워크 수수료가 몇 lamports인지 조회한다.
6. 조회한 값을 `fee`, `estimatedFeeNative`로 반환한다.

이 기본 전송 미리보기에서는 EVM처럼 별도의 최대 가스비 필드를 계산하지 않고, 메시지에 대한 예상 수수료를 내려준다.

즉, 실제 SOL 전송 메시지를 미리 만든 뒤 그 메시지의 네트워크 fee를 보여주는 함수다.

### 2. SPL 토큰 전송 때 필요한 SOL 비용 미리보기

1. `from`, `mint`, `to` 주소를 `PublicKey`로 변환한다.
2. 토큰 mint 정보를 읽어서 decimals를 조회한다.
3. 사용자가 입력한 토큰 수량을 최소 단위로 변환한다.
4. 송신자 ATA와 수신자 ATA 주소를 계산한다.
5. 최신 blockhash를 조회한 뒤 트랜잭션 객체를 생성한다.
6. 수신자 ATA가 이미 있는지 확인한다. 있으면 그대로 진행하고, 없으면 다음 작업을 추가한다.
   - `requiresRecipientAtaCreation = true`
   - ATA 생성에 필요한 rent-exempt lamports 조회
   - `createAssociatedTokenAccountInstruction(...)` 추가
7. 마지막에 실제 토큰 이동을 위한 `createTransferInstruction(...)`을 추가한다.
8. `getFeeForMessage()`로 트랜잭션의 네트워크 fee를 조회한다.
9. 총 필요 SOL을 계산하고, 송신자의 SOL 잔액을 조회한다.

```text
총 필요 SOL = networkFeeLamports + ataCreationCostLamports
```

위 계산은 lamports 단위로 수행하고, 표시할 때 SOL 단위로 변환한다. 반환 필드는 다음과 같다.

- `estimatedFeeNative`
- `networkFeeNative`
- `ataCreationCostNative`
- `requiresRecipientAtaCreation`
- `canCoverFeeWithBalance`

SPL 토큰 전송 비용은 네트워크 fee만 보면 부족하다. 수신자 ATA가 없으면 송신자가 ATA 계정 생성에 필요한 rent-exempt 잔액도 함께 부담해야 한다.

그래서 이 함수는 **네트워크 수수료와 ATA 생성 비용을 합쳐 실제로 준비해야 할 SOL을 계산한다.** 실제 SPL 전송에 필요한 instruction들을 구성한 뒤, 필요한 경우 ATA 생성비까지 포함하는 방식이다.

## TON

TonCenter API v2의 `/estimateFee`로 시뮬레이션한다.

- 실제 wallet transfer body를 구성해 POST 요청으로 시뮬레이션한다.
- 응답의 `result.source_fees` 항목을 합산한다: `in_fwd_fee + storage_fee + gas_fee + fwd_fee`.
- 네이티브 전송의 시뮬레이션 성공 시에는 추정값에 최소값 보정을 하지 않고 최대값 제한만 적용한다.
- 네이티브 전송의 시뮬레이션 실패 시에는 최근 온체인 수수료의 중앙값을 사용하고, 샘플도 없으면 기본값 5,000,000 nanoton을 사용한다. 이 fallback에는 최소·최대값 제한을 적용한다.

### 1. 네이티브 TON 전송 로직

1. **발신 지갑 상태 조회:** 잔액, `seqno`, 지갑 배포 여부, 계정 상태를 확인한다.
2. **금액 변환:** 보낼 TON 금액을 nanoton으로 변환한다.
3. **내부 메시지 생성:** 실제 전송과 같은 수신자 주소, 전송 금액, bounce 여부, 빈 body를 넣는다.
4. **Wallet transfer body 생성:** 이미 배포된 지갑이면 일반 transfer body를 만들고, 미배포 지갑이면 첫 전송에 필요한 `stateInit`을 포함한다.
5. **수수료 시뮬레이션:** TonCenter `/estimateFee`로 source fee와 destination fee를 구하고 총수수료를 계산한다.

시뮬레이션이 성공하면 다음과 같이 계산한다.

```text
estimatedFeeNative = 시뮬레이션 총수수료
totalRequired = 보낼 TON + 예상 수수료
canCoverTotalCost = 현재 잔액으로 전송 금액과 수수료를 감당할 수 있는지
```

시뮬레이션이 실패하면 최근 온체인 거래의 수수료 샘플을 가져와 중앙값을 사용한다. 샘플도 없으면 기본 추정 수수료를 사용한다. 지갑이 비활성 상태라면 추정값이 너무 낮아지지 않도록 하한값도 적용한다.

최종 응답에는 다음 항목을 담는다.

- `estimatedFeeNative`
- `totalRequired`
- `canCoverTotalCost`
- `estimateMode`
- 세부 수수료 breakdown

실제 TON 전송 메시지를 먼저 만들어 `/estimateFee`로 시뮬레이션하고, 실패하면 최근 온체인 수수료를 기반으로 보수적으로 fallback하는 구조다.

### 2. Jetton 전송 로직

1. **발신 지갑 상태 조회:** TON 잔액, `seqno`, 지갑 배포 여부를 확인한다.
2. **Jetton 정보 조회:** decimals와 실제 master contract 주소를 확인한다.
3. **전송 수량 변환:** 입력한 Jetton 수량을 최소 단위로 변환한다.
4. **발신자의 Jetton wallet 주소 조회:** 먼저 API로 조회하고, 없으면 Jetton master contract에서 직접 계산한다.
5. **Jetton transfer body 생성:** 전송할 Jetton 양, 수신자 주소, 응답 주소, `forward_ton_amount` 등을 body에 직렬화한다.
6. **내부 메시지 생성:** 수신 대상은 발신자의 Jetton wallet이다. Jetton transfer 실행을 위해 `JETTON_TRANSFER_ATTACHED_NANOTON`만큼의 TON을 함께 첨부한다.
7. **Wallet transfer body 생성:** 발신 TON wallet에서 Jetton wallet으로 보낼 전송을 담은 외부 메시지를 생성한다. 지갑이 미배포 상태면 `stateInit`을 포함한다.
8. **TonCenter `/estimateFee` 시뮬레이션:** Jetton 전송에 필요한 source fee, destination fee, total fee를 계산한다.
9. **총 필요 TON 계산:** 첨부할 TON과 추정 수수료를 합산한다.

```text
총 필요 TON = attached TON + simulated fee
```

| 응답 필드 | 의미 |
|---|---|
| `estimatedFeeNative` | 예상 네트워크 수수료 |
| `attachedValue` | Jetton 실행을 위해 함께 붙이는 TON |
| `totalRequired` | 발신자의 TON 잔액에 준비돼 있어야 하는 총량 |
| `canCoverTotalCost` | TON 잔액으로 총 필요 금액을 감당할 수 있는지 |

Jetton은 토큰만 보내는 것이 아니라 Jetton wallet 컨트랙트를 실행시키기 위해 TON도 함께 붙여 보낸다. 그래서 네트워크 수수료와 첨부 TON을 함께 확인해야 한다.

## TRON

TRX 수수료 추정에 쓰는 세 가지 조회는 모두 TronGrid 네이티브 API를 사용한다.

| 조회 | 사용 API |
|---|---|
| 체인 파라미터 | `getChainParameters` → TronGrid |
| 계정·리소스 | `getAccount` / `getAccountResources` → TronGrid |
| 수신자 활성화 여부 | `getAccount(toAddress)` → TronGrid |

이 구성에서 Alchemy는 `eth_call` 계열의 잔액·토큰 정보 조회를 담당하고, 수수료 추정에는 관여하지 않는다.

### 1. 수수료 계산에 필요한 조회

**1) 체인 파라미터 — `getChainParameterMap`**

`tw.trx.getChainParameters()`로 TronGrid 네이티브 API를 호출한다.

- `getTransactionFee`: bandwidth 1byte당 SUN 단가
- `getEnergyFee`: energy 1unit당 SUN 단가
- `getCreateNewAccountFeeInSystemContract` / `getCreateAccountFee`: 계정 활성화 비용

**2) 계정 리소스 — `getAccountResources`**

`tw.trx.getAccount()`와 `tw.trx.getAccountResources()`로 다음을 조회한다.

- 현재 bandwidth 잔여량: frozen + free
- 현재 energy 잔여량
- TRX 잔액

**3) 수신자 활성화 여부 — `isAccountActivated`**

`tw.trx.getAccount(toAddress)`가 빈 객체를 반환하면 비활성 계정으로 판단한다. 비활성이면 활성화 비용을 반영하고, 문서에 정리한 TRC-20 로직에서는 추가 25,000 energy를 가산한다.

**4) Energy·Bandwidth 추정**

- TRX: `transactionBuilder.sendTrx()`로 unsigned transaction을 생성하고, `raw_data_hex.length / 2`로 byte 크기를 추정한다.
- TRC-20: `transactionBuilder.triggerConstantContract()`로 `energy_required`를 조회한다.

계산 흐름은 다음과 같다.

```text
부족한 리소스 × 단가 = 예상 수수료
feeLimitSun = clamp(예상 수수료 × 1.3, MIN, MAX)
```

`feeLimitSun`은 실제 전송에 사용할 파라미터다. 예상 수수료에 여유분을 적용한 뒤 운영 범위 안으로 제한한다.

### 2. TRX 네이티브 전송 미리보기

1. 발신자의 TRX 잔액과 bandwidth를 조회한다.
2. 체인 파라미터에서 계정 생성 비용과 bandwidth 부족 시 byte당 수수료를 조회한다.
3. 수신자 계정이 이미 활성화됐는지 확인한다.
4. 보낼 TRX를 SUN 단위로 변환한다.
5. 실제 전송용 unsigned transaction을 만들어 대략적인 byte 크기를 추정한다.
6. 현재 사용할 수 있는 bandwidth와 비교해 부족한 byte를 계산한다.
7. 계정 활성화 비용, bandwidth 부족에 따른 소각 비용, 비활성 계정이면서 bandwidth도 부족할 때의 추가 비용을 계산한다.
8. 현재 잔액으로 전송 금액과 예상 수수료를 감당할 수 있는지 확인한다.

| 응답 필드 | 의미 |
|---|---|
| `estimatedFeeNative` | 현재 상태에서 추가로 소각될 것으로 예상하는 TRX |
| `canCoverTotalCost` | 전송 금액과 예상 수수료를 합쳐 감당할 수 있는지 |

현재 계정 리소스와 수신자 활성화 상태를 보고, 이번 TRX 전송에 추가로 얼마나 TRX가 필요한지 계산하는 함수다.

### 3. TRC-20 전송 미리보기

1. 토큰 정보를 조회한다.
2. 발신자의 TRX 잔액, energy, bandwidth를 조회한다.
3. 수신자 계정의 활성화 여부를 확인한다.
4. 토큰 전송 금액을 최소 단위로 변환한다.
5. `triggerConstantContract()`로 실제 `transfer(address,uint256)` 호출에 필요한 energy를 추정한다.
6. 수신자가 비활성 계정이면 추가 25,000 energy를 반영한다.
7. 현재 사용할 수 있는 energy를 빼서 부족분을 계산한다.
8. `missingEnergy × getEnergyFee`로 예상 수수료를 계산한다.
9. 실제 전송용 내부 `feeLimitSun`을 계산한다.
10. 예상 수수료와 전송 상한을 각각 감당할 수 있는지 내부적으로 확인한다.

사용자에게 안내할 예상 수수료는 `estimatedFeeNative`이며, 현재 리소스를 기준으로 예상한 실제 소각 TRX를 뜻한다.

문서에서 정리한 미리보기 정책은 `feeLimitSun`과 `canCoverMaxFeeWithBalance`를 내부 전송 검증용으로 유지하고 사용자 미리보기에는 노출하지 않는 것이다.

실제 TRC-20 transfer가 필요로 할 energy를 먼저 추정한 뒤, 현재 가진 energy로 부족한 만큼만 TRX 소각 비용으로 환산하는 구조다.

## UTXO

UTXO는 fee rate를 조회한 뒤 트랜잭션 크기를 계산해 수수료를 추정한다.

- BTC·LTC: Esplora, 즉 mempool.space 호환 REST API
- DOGE: BlockCypher

수수료율 조회에 사용하는 API와 필드는 다음과 같다. 구성된 REST 후보를 사용하고, 실패하면 JSON-RPC로 fallback한다.

| 조회 방식 | 메서드·필드 |
|---|---|
| BlockCypher REST | `medium_fee_per_kb` |
| Esplora REST | `/fee-estimates` |
| Bitcoin Core 호환 JSON-RPC | `estimatesmartfee` |

수수료 계산에 사용하는 크기 근사식은 다음과 같다.

```text
tx 크기 ≈ (input 수 × 148) + (output 수 × 34) + 10
수수료 ≈ 예상 크기 × fee rate (최소 단위/vByte)
```

위 크기는 입력·출력 수를 기준으로 한 근사치다. TRON처럼 계정의 온체인 리소스를 조회하는 대신, 외부 API에서 현재 네트워크 혼잡도에 따른 fee rate를 받아 예상 크기에 곱한다.

### 전송 수수료 계산 흐름

1. 보낼 금액을 최소 단위로 변환한다. BTC는 sats를 사용한다.
2. 현재 네트워크의 fee rate를 조회한다. BTC 기준 단위는 sat/vByte다.
3. 1 input·2 output 기준으로 대략적인 수수료를 계산한다. 이 값으로 잔액과 후보 UTXO의 조회 범위를 잡는다.
4. 발신자 잔액과 후보 UTXO를 조회한다.
5. 후보를 정렬해 큰 UTXO부터 사용한다.
6. UTXO를 하나씩 더하면서 선택된 input 수를 늘린다. input 수가 늘면 예상 크기도 증가하므로 수수료를 다시 계산한다.
7. 다음 조건을 만족하면 선택을 멈춘다.

```text
선택 UTXO 총액 >= 전송 금액 + 현재 fee
```

8. 최종 선택 결과를 기준으로 `virtualSize × feeRate`를 계산한다.
9. dust 여부를 확인한다.

반환 필드는 다음과 같다.

- `estimatedFeeNative`
- `feeSats`
- `feeRateSatsPerVByte`
- `virtualSize`
- `inputCount`
- `totalRequired`
- `canCoverTotalCost`

UTXO 전송은 입력 개수가 늘어날수록 트랜잭션 크기와 수수료가 함께 커진다. 그래서 실제로 고를 UTXO 조합을 대략 잡아본 뒤, 그 조합을 기준으로 수수료를 추정한다.

## XRP

XRP는 rippled JSON-RPC의 `fee` 메서드를 사용한다.

- `rpcCall('fee')`로 현재 open ledger fee를 drops 단위로 조회한다.
- `drops.open_ledger_fee`를 우선 사용하고, 없으면 `drops.base_fee`를 사용한다.
- 둘 다 없으면 기본값 12 drops를 사용한다.

```text
1 XRP = 1,000,000 drops
12 drops = 0.000012 XRP
```

네트워크가 제시하는 수수료를 조회하는 방식이다. TON처럼 메시지 실행을 시뮬레이션하거나 BTC처럼 트랜잭션 크기를 계산하지 않는다.

### 전송 수수료 조회 흐름

1. rippled의 `fee` 메서드로 현재 네트워크 수수료를 조회한다.
2. `open_ledger_fee` → `base_fee` → 기본값 12 drops 순으로 값을 선택한다.
3. 발신자의 XRP 잔액을 조회한다.
4. 전송 금액을 drops로 변환한다.
5. 전송 금액과 예상 수수료를 합산한다.
6. 필요한 잔액과 현재 잔액을 비교한다.

```text
전송 금액과 수수료 합계 = 보낼 금액 + 예상 수수료
잔액 비교 = balanceDrops >= totalRequiredDrops
```

반환 필드는 다음과 같다.

- `estimatedFeeNative`
- `feeDrops`
- `amountDrops`
- `balanceDrops`
- `totalRequiredDrops`
- `canCoverTotalCost`

예를 들어 1 XRP를 보내고 수수료가 12 drops라면 다음과 같다.

```text
보낼 금액: 1 XRP
현재 fee: 12 drops = 0.000012 XRP
전송 금액과 수수료 합계: 1.000012 XRP
```

이 합계와 별도로 계정에 남겨야 할 준비금도 잔액 검증에서 고려해야 한다.

XRP 수수료 조회 자체는 EVM처럼 가스를 추정하는 방식이 아니라, 현재 ledger fee를 가져와 예상 수수료로 사용하는 구조다.
