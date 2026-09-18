---
title: "Kookmin Wallet 멀티체인 RPC 운영기: Provider 구성과 Rate Limit 설계"
date: 2026-09-18
tags: [backend, blockchain, wallet, rpc, rate-limit, redis]
draft: false
---

멀티체인 지갑 서버를 운영하면 체인 연동 자체보다 외부 RPC와 API를 안정적으로 다루는 일이 더 큰 과제가 된다. 체인마다 호출 방식과 장애 유형이 다르고, 같은 Provider라도 메서드별 비용이 다르다. 무료 공개 Endpoint는 호출 한도가 명확하지 않은 경우도 많다.

Kookmin Wallet 서버에서는 EVM, Solana, TRON, XRP, TON과 UTXO 계열 체인을 함께 지원한다. 이 글에서는 여러 Provider를 어떻게 나누어 사용했고, 자체 Rate Limiter와 Fallback을 어떤 기준으로 설계했는지 정리한다.

> 이 글에 나오는 수치는 특정 시점의 프로젝트 운영 기준값이다. 각 Provider가 공식적으로 보장하는 최신 한도가 아니며, 실제 적용 전에는 사용 중인 요금제와 공식 문서를 다시 확인해야 한다.

## 한 Provider로 모든 체인을 처리하기 어려운 이유

처음에는 체인마다 RPC URL 하나만 연결하면 충분해 보인다. 실제 운영에서는 다음 문제가 생긴다.

- 같은 체인에서도 잔액 조회, 트랜잭션 전송, 수수료 계산에 적합한 API가 다르다.
- JSON-RPC Provider가 주소별 UTXO 인덱스를 제공하지 않는 경우가 있다.
- 하나의 API Key가 여러 체인의 처리량을 공유할 수 있다.
- 공개 Endpoint는 한도가 공개되지 않았거나 상업 트래픽을 보장하지 않는다.
- Provider마다 timeout, 오류 코드, 응답 형식과 재시도 조건이 다르다.

그래서 Kookmin Wallet은 체인별로 주 Provider와 보조 Provider를 나누고, 기능에 따라 REST API와 JSON-RPC를 함께 사용한다.

## 체인별 Provider 구성

| 체인 계열 | 주 Provider | 보조 또는 기능별 Provider | 주요 용도 |
|---|---|---|---|
| EVM | Alchemy | 운영 DB에 등록된 후보 | 잔액, 컨트랙트 조회, 가스 추정, 거래 조회·전송 |
| Solana | Alchemy | 운영 DB에 등록된 후보 | SOL·SPL 조회, 수수료 계산, 거래 조회·전송 |
| TRON | Alchemy JSON-RPC | TronGrid | TRC-20 조회와 TRON 고유 기능 분리 |
| XRP | Tatum XRP Gateway | 공개 XRPL 후보 | 계정, 수수료, 거래 조회·전송 |
| TON | TonAPI | TonCenter | TON·Jetton 조회, 수수료 시뮬레이션, 거래 전송 |
| BTC | mempool.space | Tatum Gateway | 주소·UTXO 인덱스와 JSON-RPC 역할 분리 |
| LTC | LitecoinSpace | Tatum Gateway | 주소·UTXO 인덱스와 JSON-RPC 역할 분리 |
| DOGE | BlockCypher | Tatum Gateway | 주소·UTXO 조회와 JSON-RPC 역할 분리 |

Provider 후보는 다음 우선순위로 구성한다.

1. 체인의 기본 RPC URL
2. 같은 체인에 등록된 추가 RPC URL
3. 운영 DB에서 활성 상태이고 Health Check를 통과한 Provider

DB 후보는 우선순위 순서로 추가한다. 환경변수만 확인하면 실제 운영 후보 전체를 알 수 없는 이유다. 운영 장애를 분석할 때는 배포 환경과 Provider 테이블을 함께 확인해야 한다.

## EVM과 Solana: 공통 Provider를 사용할 때의 주의점

EVM 계열은 Ethereum, Base, BNB Chain, Polygon, Arbitrum, Optimism, Avalanche, Blast, zkSync, Linea, Scroll, Celo 등을 하나의 Provider 계정으로 묶어 운영할 수 있다. Solana도 같은 Provider 계정을 사용할 수 있다.

이 구성은 관리가 단순하지만, 모든 요청이 계정 단위 처리량을 공유한다. Ethereum 트래픽이 급증하면 Polygon이나 Solana 호출에도 영향을 줄 수 있다. 따라서 limiter 카운터를 체인별로 따로 두면 실제 Provider의 계정 한도를 초과할 수 있다.

Kookmin Wallet은 같은 자격 증명을 공유하는 요청을 Provider 단위 카운터로 합산한다.

```text
Ethereum ─┐
Polygon  ─┼─> alchemy 공통 카운터 ─> Alchemy
Solana   ─┘
```

## TRON: JSON-RPC와 Native API 분리

TRON은 한 Provider로 모든 기능을 처리하지 않는다.

- JSON-RPC: `eth_call` 기반의 TRC-20 잔액과 메타데이터 조회
- TronGrid: 계정, bandwidth, energy, chain parameter, 거래 조회와 전송
- 전송 사전 검증: Constant Contract 호출을 이용한 시뮬레이션

TRC-20은 EVM과 비슷한 인터페이스를 제공하지만, 수수료와 계정 리소스 계산은 TRON 고유 API가 필요하다. Provider를 체인 단위로만 추상화하면 이 차이를 숨기기 어렵다. 실제 구현에서는 기능 단위로 호출 경로를 분리하는 편이 안전했다.

## TON: URL 교체만으로는 Fallback이 되지 않는다

TON은 TonAPI와 TonCenter를 함께 사용한다. 두 서비스는 Endpoint와 응답 형식이 다르므로 단순히 URL 배열을 순회하는 방식으로 교체할 수 없다.

예를 들어 수수료 계산은 다음처럼 서비스 코드에서 각각 처리한다.

1. TonAPI의 지갑 에뮬레이션 API 호출
2. 실패 시 TonCenter의 수수료 추정 API 호출
3. Provider별 응답을 내부 공통 형식으로 변환

Fallback은 URL 교체가 아니라 서로 다른 API를 같은 비즈니스 결과로 변환하는 과정까지 포함해야 한다.

## UTXO 계열: 주소 인덱서와 JSON-RPC의 역할 분리

Bitcoin Core 계열 JSON-RPC는 임의 주소의 잔액과 UTXO 목록을 바로 제공하는 주소 인덱서가 아니다. 따라서 BTC, LTC, DOGE는 주소 인덱싱 API와 JSON-RPC Gateway를 나누어 사용한다.

| 역할 | 사용 예시 |
|---|---|
| 주소 인덱싱 | 주소 잔액, UTXO 목록, 거래 내역 조회 |
| 수수료 조회 | 네트워크 수수료 추정 |
| 원시 거래 조회 | 이전 거래와 입력 정보 확인 |
| 거래 전송 | 서명된 Raw Transaction 전파 |

이 구조 덕분에 주소 기반 조회는 Esplora 계열이나 BlockCypher를 사용하고, Core JSON-RPC가 필요한 작업은 별도 Gateway로 보낼 수 있다.

## 자체 Rate Limit 기준

외부 Provider의 제한에 도달한 뒤 대응하면 이미 사용자 요청이 실패한 상태다. 서버 내부에서 더 보수적인 한도를 적용해 급격한 호출 증가를 먼저 차단했다.

아래 값은 1초 Fixed Window를 기준으로 사용한 프로젝트 설정 예시다.

| Provider 구분 | 프로젝트 한도 | 적용 이유 |
|---|---:|---|
| Alchemy | 250회/초 | Compute Unit 비용을 고려한 내부 추정값 |
| Tatum | 150회/초 | 여러 체인이 계정을 공유하므로 여유 구간 확보 |
| TronGrid | 10회/초 | 초당 한도와 일일 누적 한도를 함께 고려 |
| TonCenter | 8회/초 | 요금제 한도보다 낮은 보호값 적용 |
| TonAPI | 10회/초 | 사용 요금제의 처리량에 맞춘 기준값 |
| Ripple 공개 Endpoint | 10회/초 | 보장되지 않는 공개 자원 보호 |
| BlockCypher | 1회/초 | 시간당 누적 한도를 고려한 보수값 |
| 기타 공개 Provider | 5회/초 | 명시적 보장량이 없는 Endpoint 보호 |

이 숫자를 그대로 복사하는 것은 권장하지 않는다. 다음 데이터를 확인해 서비스별로 다시 산정해야 한다.

- Provider 대시보드의 실제 사용량
- 메서드별 비용과 고비용 호출 비율
- 내부 limiter가 거절한 요청 수
- Provider가 반환한 실제 `429` 빈도
- 시간당·일일 누적 Quota
- API 서버와 Worker를 합친 전체 트래픽

## Redis Fixed Window Limiter

API 서버와 Worker가 같은 Provider 한도를 공유할 수 있도록 Redis 카운터를 사용한다.

```text
rpc-limit:{provider}:{window-id}
```

요청 처리 순서는 다음과 같다.

1. 호출 대상 URL을 Provider 유형으로 분류한다.
2. Provider별 설정값을 읽는다.
3. Redis에서 현재 Window의 카운터를 증가시킨다.
4. 한도를 넘으면 외부 API를 호출하지 않고 즉시 오류를 반환한다.
5. 한도 이내면 실제 RPC 또는 REST API를 호출한다.

카운터 증가와 만료 시간 설정은 Lua Script로 원자 처리한다. 여러 서버 인스턴스가 동시에 첫 요청을 보내더라도 카운터와 TTL이 따로 적용되는 상황을 막기 위해서다.

```lua
local count = redis.call('INCR', KEYS[1])

if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end

return count
```

현재 방식은 초과 요청을 큐에 넣지 않고 즉시 거절한다. 사용자가 기다린 뒤 결국 timeout을 받는 상황을 줄이고, 상위 계층이 빠르게 재시도 여부를 결정하게 하기 위한 선택이다.

## Redis 장애 시 정책

Rate Limiter가 Redis에 의존하면 Redis 장애가 전체 RPC 장애로 이어질 수 있다. 그래서 세 가지 정책을 둘 수 있다.

| 정책 | 동작 | 특징 |
|---|---|---|
| Local fallback | 프로세스 메모리 카운터 사용 | 서비스는 유지되지만 인스턴스 전체 한도를 보장하지 못함 |
| Fail open | 제한 없이 요청 허용 | 가용성은 높지만 Provider Quota 초과 위험이 큼 |
| Fail closed | 모든 요청 거절 | Quota는 보호하지만 서비스가 중단됨 |

Kookmin Wallet은 Local fallback을 기본 정책으로 사용했다. 다만 이 경우 API 서버와 Worker의 카운터가 분리된다. 정상 상태에서는 모든 프로세스가 같은 Redis와 Key Prefix를 사용해야 전역 제한이 유지된다.

## Fallback, Retry, Timeout

모든 오류를 재시도하면 장애를 더 키울 수 있다. 네트워크 timeout, 연결 초기화, 일시적인 SSL 오류처럼 회복 가능성이 있는 오류만 재시도 대상으로 분류한다.

EVM 계열은 마지막으로 성공한 Provider를 일정 시간 캐시한다. 호출이 실패하면 캐시를 지우고 다음 후보를 선택하며, 한 요청에서 무제한으로 후보를 순회하지 않는다. Provider 상태를 확인하기 위한 Probe 요청도 외부 호출이므로 limiter 사용량에 포함한다.

체인별 기본 timeout은 호출 특성에 따라 다르게 둔다.

| 계열 | 기본 timeout 예시 |
|---|---:|
| EVM | 3초 |
| Solana | 3초 |
| TRON JSON-RPC | 3초 |
| UTXO API | 3초 |
| XRP | 10초 |
| TON API | 10초 |
| TON Metadata | 8초 |

Retry와 Fallback은 구분해서 보는 것이 좋다.

- Retry: 같은 작업을 다시 시도한다.
- Fallback: 다른 Provider나 다른 API 방식으로 작업을 수행한다.
- Backoff: 다음 시도까지 대기 시간을 늘린다.
- Cooldown: 문제가 발생한 Provider를 일정 시간 후보에서 제외한다.

현재 구조에서는 거래 상태를 갱신하는 Worker의 Backoff와 서버 RPC Provider의 Cooldown을 별도로 관리한다. 사용자 요청 경로와 비동기 작업 경로는 허용 가능한 지연 시간이 다르기 때문이다.

## RPC 외에 함께 관리해야 하는 API

지갑 서버는 RPC만으로 운영되지 않는다.

| 서비스 유형 | 예시 | 용도 |
|---|---|---|
| 입금 감지 | Moralis Streams, Tatum Notifications, TonAPI Webhook | 주소 구독과 입금 이벤트 수신 |
| 브리지 상태 | Chainlink CCIP Explorer | 메시지 처리 상태 조회 |
| 시세·메타데이터 | CoinGecko, CoinMarketCap | 토큰 정보와 가격 동기화 |
| DEX | 1inch | Swap 견적과 Transaction 생성 |

이 API들은 RPC Provider용 limiter의 적용 대상이 아닐 수 있다. Webhook 관리, 시세 동기화, DEX 호출은 각각 트래픽 특성이 다르므로 별도의 제한과 재시도 정책이 필요하다.

## Fixed Window 방식의 한계

현재 구조가 해결하지 못하는 문제도 있다.

- 시간당·일일 누적 Quota
- 메서드별 비용이 다른 Compute Unit 방식
- `Retry-After` 응답을 반영한 동적 대기
- 오류가 반복되는 Provider의 자동 Cooldown
- 하나의 Provider에서 여러 API Key를 사용할 때의 자격 증명별 Quota

다음 단계에서는 초당 카운터만 보는 방식에서 벗어나야 한다. Provider 응답 헤더와 실제 사용량을 수집하고, 메서드별 가중치와 장기 Quota를 함께 추적하는 방식이 필요하다.

## 운영하면서 얻은 기준

멀티체인 RPC 운영에서 중요했던 기준은 다음과 같다.

1. **체인이 아니라 실제 Quota 공유 단위로 제한한다.** 같은 API Key를 사용한다면 여러 체인의 요청을 하나로 합산해야 한다.
2. **기능에 맞는 API를 선택한다.** UTXO 주소 조회처럼 일반 JSON-RPC가 해결하지 못하는 작업은 인덱서 API를 사용한다.
3. **Fallback의 응답 형식까지 추상화한다.** URL만 바꾸는 것으로 끝나지 않는 Provider가 많다.
4. **Probe도 실제 요청으로 계산한다.** Health Check와 Provider 선택 과정도 Quota를 소비한다.
5. **공개 Endpoint에는 보수적인 한도를 둔다.** 공개 서비스의 미공개 한도를 서비스 용량으로 간주하면 안 된다.
6. **설정값은 관측 데이터로 계속 조정한다.** 문서나 요금제 표보다 실제 메서드 분포와 `429` 지표가 더 중요하다.

멀티체인 지갑의 안정성은 지원 체인 수보다 외부 의존성을 얼마나 명확하게 분리하고 제어하는지에 달려 있다. Provider 선택, Rate Limit, Timeout, Retry, Fallback을 하나의 운영 정책으로 관리해야 특정 Provider의 장애가 전체 지갑 서비스로 번지는 것을 막을 수 있다.

---

> 공개용 문서에는 API Key, Webhook Secret, 실제 운영 Endpoint, 내부 저장소 경로를 포함하지 않았다.
