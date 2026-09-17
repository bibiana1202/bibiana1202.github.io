---
title: Transaction
date: 2026-09-16
tags: ["database", "transaction", "acid", "locking", "isolation", "deadlock"]
draft: false
---
### Question?
□ Transaction이란?  
□ ACID  
□ COMMIT / ROLLBACK  
□ 데이터 정합성이란?  
□ 동시에 같은 row를 수정하면?  
□ Lock  
□ Deadlock 기본 개념  
□ Isolation Level은 **종류가 있다는 정도 + 왜 필요한지**


---
### Transaction
- 여러 DB 작업을 하나의 논리적인 작업 단위로 묶어서, 전체 작업의 일관성과 신뢰성을 보장하기 위한 기능
- 업무상 함께 성공하거나 실패해야 하는 DB 작업의 경계. HTTP 요청과 transaction은 반드시 1:1 관계가 아니다.
- 여러 DB 작업을 하나의 논리적인 작업 단위로 묶는다.

### COMMIT / ROLLBACK
- commit은 transaction에서 수행한 변경을 확정하는 것이고, rollback은 문제가 발생했을 때 transaction의 변경사항을 취소하는 것

### 데이터 정합성
- 서로 관련된 데이터들이 정해진 규칙과 관계에 맞게 모순 없이 유지되는 상태


### DB 동시성 제어 - Lock
- 서로 상관없는 Transaction은 동시에 처리하고, 서로 충돌할 수 있는 부분만 제어하자.
- Lock : 해당 row에 적절한 lock, DB 전체를 한번에 한 transaction만 사용하게 하는 것 보다 훨씬 효율적이다.
- transaction은 여러 DB 작업을 하나의 논리적인 작업 단위로 묶는 것이고, lock은 여러 transaction이 동시에 같은 데이터에 접근할 때 발생할 수 있는 충돌을 제어하는 방법이다.


### SELECT ... FOR UPDATE
- 이 데이터를 그냥 조회만 하는게 아니라, 이 Transaction에서 수정할 거니까 잠금이 필요한 방식으로 읽을것
- transaction이 끝나면 관련 lock도 해제되어 동시에 같은 row에 대해 충돌하는 작업이 들어왔을때 적절히 순서를 제어할 수 있다.


### DeadLock (교착 상태)
```
A                           B

Data 1 🔒                   Data 2 🔒

Data 2 기다림 ──────→      가지고 있음
가지고 있음        ←────── Data 1 기다림


A: B가 풀어야 진행
B: A가 풀어야 진행

        ↓

     Deadlock
```
- DBMS는 일반적으로 이런 deadlock을 감지하면 transaction 중 하나를 rollback 시켜 교착 상태를 해소 할수 있다.
- lock 획득 순서를 통일한다, transaction을 필요이상으로 길게 유지하지 않는다.


### ACID
- transaction이 신뢰성을 갖기 위한 특성
- Atomicity (원자성) : transaction 안의 작업을 하나의 단위로 취급해 모두 반영되거나 모두 반영되지 않도록 하는 특성
- Consistency (일관성) : transaction 수행 전후로 데이터가 정의된 제약조건과 비즈니스 규칙을 만족하는 유효한 상태를 유지해야한다.
- Isolation (격리성) : transaction이 동시에 실행될 때 서로의 중간 상태 때문에 이상한 결과가 발생하지 않도록 transaction 간 영향을 적절히 격리하는 것이다.
- Durability (지속성) : commit 성공했다고 db 가 사용자에게 알려줬으면, 이후 장애가 발생하더라도 그 변경 결과가 지속되어야 한다는 특성


### Isolation Level
- 동시에 실행되는 transaction들이 서로의 데이터를 어느 정도까지 볼 수 있고 영향을 받을 수 있게 할 것인지와 관련된것이 isolation(격리) 이다.
```
READ UNCOMMITTED
        ↓
READ COMMITTED
        ↓
REPEATABLE READ
        ↓
SERIALIZABLE

대체로 아래로 갈수록
격리 수준 ↑
동시성/성능 비용 ↑ 가능
```


### 마무리
```
Transaction
"여러 DB 작업을 하나로 묶자"
          │
          ↓
그런데 Transaction 여러 개는
동시에 실행될 수 있음
          │
          ↓
같은 데이터를 동시에 건드릴 수도 있음
          │
          ↓
	동시성 문제
          │
          ↓
	Lock / Isolation 등의
	동시성 제어 필요
          │
          ↓
	Lock을 사용하다 보면
	Deadlock도 발생 가능
```


> Transaction 이 뭔가요?
> : Transaction은 여러 DB 작업을 하나의 논리적인 작업 단위로 묶어서 처리하는 것입니다. 모든 작업이 성공하면 COMMIT하고, 중간에 실패하면 ROLLBACK해서 데이터가 부분적으로만 반영되는 것을 방지 할수 있습니다. 대표적인 특성으로 ACID가 있습니다.

### PostgreSQL Read Committed와 동시 갱신
- PostgreSQL의 기본 격리 수준은 Read Committed이다. 일반 SELECT는 각 명령이 시작할 때까지 커밋된 데이터를 보므로, 같은 transaction에서 SELECT를 두 번 실행해도 사이에 다른 transaction이 커밋했다면 결과가 달라질 수 있다.
- 예를 들어 A와 B가 모두 잔액 100을 읽고, 각각 10과 20을 차감한 값인 90과 80을 저장하면 한쪽 변경을 덮어쓰는 lost update가 생길 수 있다. transaction으로 묶는 것만으로 이런 애플리케이션의 읽기-계산-쓰기 패턴이 안전해지는 것은 아니다.
- 단순 차감은 `UPDATE accounts SET balance = balance - 10 WHERE id = 1 AND balance >= 10`처럼 조건부 갱신하고 영향받은 행 수를 확인할 수 있다. 복잡한 판단은 같은 transaction 안에서 먼저 `SELECT ... FOR UPDATE`로 잠근 뒤 최신 값을 읽고 처리하거나, version 조건을 이용한 낙관적 잠금을 고려한다.
- PostgreSQL에서는 Read Uncommitted도 Read Committed처럼 동작한다. Serializable에서도 직렬화 실패가 발생하면 전체 transaction을 재시도할 수 있도록 설계해야 한다.

### 참고 자료
- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
