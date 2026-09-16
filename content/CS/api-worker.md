---
title: "API와 Worker"
date: 2026-09-16
tags: ["cs", "worker"]
draft: false
---

> 오래 걸리는 분석 작업의 스케줄링, 상태 관리, 비동기 처리 구조를 정리한다.

### Question?
□ API server 역할  
□ Worker 역할  
□ 오래 걸리는 작업을 API에서 바로 처리하면 어떤 문제?  
□ Background job  
□ Queue가 필요한 이유  
□ Worker를 여러 개 두면 어떻게 되는가?  
□ Worker가 작업 중 죽으면?  
□ Retry는 어떻게 할 것인가?

내가 Worker를 왜 분리했는가
□ Worker 두 개가 같은 job을 잡으면?  
□ API와 Worker가 동시에 같은 DB 데이터를 수정하면?  
□ Worker가 중간에 죽으면?  
□ Scheduler가 두 번 실행되면?


> AI 분석에 10분이 걸린다면 HTTP 요청을 10분 유지할 것인가?

답변 방향: **API 요청 → job 생성 → queue → worker 처리 → 상태 DB 저장 → client가 상태 조회**

---
### API Server vs Worker
- API Server : 사용자의 요청을 받음 -> 빠르게 응답해줘야함
- Worker : 오래 걸리거나 백그라운드에서 처리할 일을 수행


### 오래 걸리는 작업을 API에서 바로 처리한다면 ?
- HTTP connection을 오래 유지해야함
	- 중간에 client timeout,proxy timeout, load balancer timeout, network 끊김 같은 문제가 생길수 있음
- API 서버 자원을 오래 잡아먹을수 있다.
	- 특히 CPU-heavy 작업까지 API프로세스에서 직접 하면 Node 같은 경우 main thread를 막을 수도 있다.
- 장애 처리가 어렵다.
- 긴 작업은 보통 request-response 생명주기와 분리하는게 좋다.


### Background Job
- HTTP 요청은 몇백 ms나 몇 초안에 끝낼수 있고, 그후 실제 분석은 Background Worker가 한다.


### Job Queue
- 작업을 보관해 worker가 가져갈 수 있게함. 전달 순서는 queue 종류에 따라 다르며, 병렬 처리에서는 완료 순서도 달라질 수 있다.
- 처리 속도 차이를 흡수
- worker 여러개가 병렬 처리
- 실패한 작업 재처리, 부하조절


### Producer-Consumer 구조
- producer -> API server
- Queue -> 작업 보관
- consumer -> worker

### worker 병렬 처리
- worker가 동시에 같은 job을 처리할수 있다
- Race condition + Idempotency
- 하나의 job을 여러 worker가 동시에 처리하지 않도록 작업 획득을 원자적으로 제어해야 한다.


### worker가 작업중 죽으면 ?
- 복구 전략이 필요
- queue 시스템에 따라 ack/visibility timeout 같은 메커니즘을 제공한다. 결과를 안전하게 저장한 뒤 ack 또는 메시지 삭제를 수행한다.
- 오래 걸리는 작업은 visibility timeout/lease를 연장하고, 만료 후 재전달될 수 있으므로 멱등하게 처리한다. Queue 재전달만으로 DB의 RUNNING 상태가 자동 복구되는 것은 아니므로 상태 복구도 설계해야 한다.


### Retry
- 무조건 계속 retry 하면 안된다.
- 오히려 장애 중인 시스템을 더 공격할 수 있다.
- Exponential Backoff
```
1회 실패
↓
1초 대기

2회 실패
↓
2초 대기

3회 실패
↓
4초 대기

4회 실패
↓
8초 대기
```
- jitter를 추가해서 여러 worker가 동시에 retry하지 않도록 할수 있다.
- 최대 횟수도 정하고, 이후 운영자가 확인하거나 별도 실패 QUEUE/DLQ로 보낼수 있다.
- retry에는 멱등성이 필수 : 같은 job을 다시 실행해도 중복 결과나 잘못된 side effect가 생기지 않도록 멱등하게 설계


### 상태관리
- AI 작업에서는 보통 이런 상태
```
PENDING
→ RUNNING
→ SUCCESS

PENDING
→ RUNNING
→ FAILED
→ RETRYING
→ RUNNING
→ SUCCESS
```



### API 역할
- 요청 validation
- DICOM / 분석 요청 확인
- 중복 job인지 확인
- job 생성
- queue 에 전달
- jobId 반환
- 실제 AI 분석 : worker 역할로 넘긴다.
- DB에 job을 저장한 뒤 queue 전송만 실패할 수 있으므로, 전달 누락 복구가 필요하다. 예를 들어 job과 outbox 기록을 같은 DB 트랜잭션에 저장하고 별도 전달자가 queue로 보내도록 할 수 있다.



### 마무리

> AI 분석에 10분이 걸린다면 HTTP 요청을 10분 유지하겠습니까?
> : 아니오. 분석처럼 오래 걸리는 작업은 HTTP 요청과 분리하겠습니다. API에서는 분석 job을 생성하고 queue에 전달한 뒤 jobId를 빠르게 반환하고, worker가 비동기로 실제 분석을 수행하도록 설계하겠습니다. 작업 상태는 PENDING,RUNNING,SUCCESS,FAILED 등으로 DB에 관리하고 Client는 jobId로 상태를 조회할 수 있게 하겠습니다.


> Worker가 죽으면요?
> : RUNNING 상태의 job이 영구적으로 남지 않도록 heartbeat나 timeout, queue의 visibility timeout 같은 방식으로 비정상 작업을 감지하고 재처리할 수 있도록 하겠습니다.


> Retry는요?
> : 모든 오류를 무조건 재시도하지 않고 일시적 오류처럼 retry가 의미 있는 경우만 제한된 횟수로 재시도하고, exponential backoff와 jitter를 적용하겠습니다. 최대 횟수를 넘으면 FAILED 또는 DLQ 같은 별도 실패 처리 경로로 보내겠습니다.


> Worker 여러 개면 같은 job 두 번 처리될 수 있지 않나요?
> : 네. 그래서 job claim을 atomic하게 처리하거나 queue의 메시지 소비 보장을 활용하고, DB UNIQUE constraint와 멱등성도 같이 설계해서 중복 실행이 발생하더라도 최종 결과가 중복 반영되지 않도록 해야 합니다.



API Server + scheduler/worker 를 분리했고,

주기적으로:

```
주기적인 데이터 확인
알림 발송
외부 API 데이터 갱신
```

같은 걸 돌렸다.


> **“API의 request-response 생명주기와 백그라운드 작업의 생명주기를 분리하고 싶었습니다. API 서버 재배포나 scale-out 시 scheduler가 중복 실행되는 문제도 줄이고, 장애를 격리하기 위해 별도 Worker로 분리했습니다.”**


내가 왜 worker를 분리했는가.
> 초기에는 API서버에서 scheduler도 같이 실행했습니다. 이후 사용자 요청을 처리하는 API와 주기적으로 실행되는 background 작업의 생명주기를 분리하기 위해 worker를 별도로 구성했습니다. 트래픽 때문이라기보다는 장애 격리와 운영 편의성이 주된 이유였고, API 서버를 여러 instance로 확장했을 때 scheduler가 중복 실행되는 문제도 고려했습니다.


Worker 두 개가 같은 job을 잡으면?
> 같은 job이 중복 처리될 수 있기 때문에 job claim을 atomic하게 처리하거나 queue의 소비 보장을 이용해야 합니다. DB 기반이라면 상태를 `PENDING → RUNNING`으로 변경하는 과정에서 lock이나 조건부 update를 사용하고, 최종 결과는 UNIQUE constraint와 멱등성으로 한 번만 반영되도록 설계하겠습니다.
    
API와 Worker가 동시에 같은 DB 데이터를 수정하면?
> 같은 row를 동시에 수정하면 race condition이나 lost update가 발생할 수 있어서 transaction, lock, 조건부 update 같은 동시성 제어가 필요합니다. 중요한 데이터라면 DB constraint를 최종 방어선으로 두겠습니다.
    
Worker가 중간에 죽으면?
> RUNNING 상태가 영구적으로 남지 않도록 timeout, heartbeat, lease 같은 방식으로 비정상 작업을 감지하고 재처리할 수 있게 해야 합니다. 재시도 시에는 같은 job이 다시 실행될 수 있으므로 작업 자체도 멱등하게 설계하는 게 중요합니다.
    
Scheduler가 두 번 실행되면?
> 같은 작업이 중복 실행될 수 있습니다. 그래서 scheduler 자체를 단일 worker에서만 실행하거나 distributed lock을 두고, 실제 작업 생성 단계에서도 unique key나 idempotency를 적용해서 중복 실행이 최종 데이터에 영향을 주지 않도록 하겠습니다.

Worker를 분리하는 것만으로 scheduler 중복 실행이 방지되지는 않는다. Scheduler 실행 주체와 작업 생성의 중복 방지 키를 별도로 관리해야 한다. Lease 만료 뒤 이전 worker가 계속 동작할 수도 있으므로 결과 저장 시 현재 소유권이나 버전을 확인하고, 중복 반영을 막는다.

### 참고 자료
- [Amazon SQS visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html)
- [Transactional outbox 패턴](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
