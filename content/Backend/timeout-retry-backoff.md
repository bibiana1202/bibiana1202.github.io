---
title: "Timeout / Retry / Backoff"
date: 2026-09-16
tags: ["backend", "timeout", "retry", "backoff", "jitter", "circuit-breaker"]
draft: false
---
### Question?
□ Timeout이 필요한 이유  
□ Connection timeout / Read timeout 개념  
□ Retry를 아무 오류에나 하면 안 되는 이유  
□ Exponential Backoff  
□ Jitter  
□ Circuit Breaker 기본 개념  
□ Rate Limit과 Timeout은 다른 문제

**문제**

> 평소 200ms 걸리던 외부 API가 갑자기 1분씩 걸립니다. 우리 서버까지 장애가 전파되지 않도록 어떻게 하겠습니까?

답변 순서:

**Timeout → 제한적인 Retry → Exponential Backoff/Jitter → 지속 장애 시 Circuit Breaker/격리 → 실패 상태 저장/후처리**

이번에는 Redis rate limit부터 얘기하지 않기.

---
### 1분씩 걸리면 왜 위험한가? cascading failure
- Node에서는 네트워크 I/O를 기다리는 동안 main thread 자체가 막히는 건 아니지만, 그렇다고 비용이 0인것은 아니다.
- 열려 있는 요청, socket, 메모리, connection pool, 외부 API connection 등 자원이 계속 점유 될수 있다.
```
외부 API 장애
    ↓
우리 서버의 pending 요청 증가
    ↓
자원 소진
    ↓
우리 API도 느려짐
    ↓
우리 서비스 장애
```
- 결국 장애 전파(cascading failure)가 생길수 있다.


### Timeout
- 외부 시스템을 무한정 기다리지 않는다.
- Connection Timeout : 외부 서버와 연결 자체를 맺는데 얼마나 기다릴 것인가, 서버와 연결을 수립하는 데 허용하는 최대 시간
- Read Timeout : 응답 데이터를 기다리는 시간을 제한한다. 정확한 측정 범위는 사용하는 HTTP 클라이언트마다 확인해야 한다. 예를 들어 Python Requests에서는 서버가 보내는 데이터 사이의 대기 시간을 제한하며, 응답 전체를 받는 총 시간 제한과 같지 않다.


### Retry
- timeout이 났으면 바로 retry? retry는 모든 오류에 하면 안된다 !
- retry는 일시적이고 재시도로 회복 가능성 있는 오류에 제한적으로 적용해야 한다.
```
일시적인 network 오류
HTTP 503
temporary timeout
```
- 바로 3번 연속 retry하면 안되는 이유...Backoff가 필요함


### Exponential Backoff
- 재시도 간격을 점점 늘리는 방식
```
delay = base × 2^retry_count
```
- 장애 난 외부 시스템에 재시도 트래픽을 몰아넣지 않고 회복할 시간을 주는 것


### thundering herd 문제
- 서버가 100대일때 동일한 시간에 실패하면 또 동시에 몰리게 된다.
- 그래서 Jitter를 넣는다!


### Jitter
- Backoff 시간에 약간의 랜덤 값을 추가한다.
- 서버마다 backoff 시간을 다르게 줘서 분산 시킨다. 그러면 재시도 요청이 한 순간에 몰리지 않는다.
- Jitter는 여러 클라이언트가 동시에 retry해서 다시 부하가 몰리는 것을 방지하기 위해 재시도 간격에 임의성을 추가하는 방식이다.


### Circuit Breaker
- 외부 API가 계속 실패하면 "지금 죽어있다." 라고 판단해서 아예 일정 시간 요청을 보내지 않는 것이다
```
CLOSED
정상 호출
   ↓

장애 발생
   ↓

OPEN
호출 차단
   ↓

시간 경과
   ↓

HALF-OPEN
시험 호출
   ↓
성공 → CLOSED
실패 → OPEN
```
- 이미 장애가 지속되는 외부 시스템을 계속 호출해서 우리 자원까지 소모하지 않도록 장애를 격리 하는것


### 마무리
> 평소 200ms 걸리던 외부 API가 갑자기 1분씩 걸립니다. 우리 서버까지 장애가 전파되지 않도록 어떻게 하겠습니까?

> 우선 외부 API 호출에 적절한 timeout을 설정해서 느린 요청이 우리 서버의 connection이나 자원을 장시간 점유하지 않도록 하겠습니다. Timeout이나 일시적인 5xx처럼 재시도로 회복 가능성이 있는 오류에 대해서만 제한적으로 retry하고, exponential backoff와 jitter를 적용해 외부 서버에 재시도 부하가 몰리지 않도록 하겠습니다. 장애가 지속된다면 circuit breaker를 적용해서 일정 시간 호출을 차단하고 빠르게 실패 처리하도록 하겠습니다. 필요한 작업이라면 실패 상태를 저장하고 background job이나 queue를 통해 후처리 할수 있게 하겠습니다.

### 전체 시간 예산과 재시도
- 연결 및 read timeout과 별도로, 재시도와 backoff 대기까지 포함한 전체 작업의 deadline을 정한다.
- 예를 들어 전체 예산이 10초라면 각 시도의 소요 시간과 대기 시간을 누적하고, 남은 시간 안에서만 다음 시도를 허용한다. 최대 재시도 횟수만 정해 두는 것으로 전체 응답 시간이 제한되지는 않는다.
- timeout은 호출자가 기다리기를 중단했다는 뜻이지, 상대 서버에서 작업이 실행되지 않았거나 취소됐다는 보장은 아니다. 변경 작업을 재시도할 때는 멱등 키나 결과 조회로 중복 효과를 막아야 한다.

### 참고 자료
- [Requests — Timeouts](https://docs.python-requests.org/en/latest/user/advanced/#timeouts)
