---
title: Node.js 동작 원리
date: 2026-09-16
tags:
  - cs
  - node
  - java
draft: false
---
### Question?
□ Node.js는 왜 single-thread라고 하는가?  
□ 그런데 어떻게 여러 요청을 동시에 처리하는가?  
□ Event Loop  
□ Call Stack  
□ Event Queue  
□ I/O 처리는 누가 하는가?  
□ async/await의 동작  
□ `await`한다고 thread가 멈추는 게 아니라는 것  
□ CPU 연산이 오래 걸리면 Node 서버에 무슨 일이 생기는가?

**반드시 대답할 수 있어야 하는 질문**

> Node.js는 single-thread인데 어떻게 동시에 여러 요청을 처리하나요?

> async/await은 어떻게 동작하나요?

> await을 만나면 thread가 기다리는 건가요?

---
## Node.js

- Single Thread: Node.js 전체가 스레드 하나뿐이라는 뜻이 아니라, JavaScript 코드를 실행하는 메인 스레드가 기본적으로 하나라는 뜻
- JavaScript 코드는 기본적으로 메인 스레드 1개에서 실행
- 동기 JavaScript 코드는 메인 스레드에서 순차적으로 실행
- DB / Network / File 같은 I/O는 비동기적으로 처리 가능
- I/O를 기다리는 동안 Event Loop는 다른 작업을 처리할 수 있음
- 그럼 java는 ? Java SpringBoot

### Promise

- "비동기 작업의 미래 결과"를 표현하는 객체
- 작업이 아직 끝나지 않아도 Promise 객체는 즉시 반환될 수 있음

상태:
Pending → Fulfilled
        → Rejected
```
             Promise
                │
             pending
            (처리 중)
             /    \
            /      \
           ↓        ↓
      fulfilled   rejected
        성공         실패
```

```
비동기 작업
   ↓
Promise 객체
"결과를 나중에 줄게"

   ↓

pending
   ↓
성공 → fulfilled → 결과값
실패 → rejected  → 에러


결과를 받는 방법

Promise
 ├─ .then() / .catch()
 │
 └─ async/await
```
### async

- async 함수는 항상 Promise를 반환
- async를 붙인다고 코드를 별도 Thread에서 실행하는 것은 아님 ★


### await

- Promise가 완료될 때까지 "현재 async 함수의 이후 실행"을 잠시 중단
- Node의 메인 Thread 전체를 Blocking하는 것은 아님 ★
- 기다리는 동안 Event Loop는 다른 작업을 처리할 수 있음

즉:
await = 비동기 코드를 동기 코드처럼 순차적으로 작성할 수 있게 해주는 문법

await ≠ Blocking
await ≠ 실제 동기 처리



### Call Stack
- javascript가 지금 어떤 함수를 실행하고 있는지 관리하는 구조
```
             ┌──────────────┐
             │  Call Stack  │
             │ JS 코드 실행   │
             └──────▲───────┘
                    │
                    │
              Event Loop
                    │
                    │
             ┌──────┴───────┐
             │ 실행 대기 작업    │
             │    Queue     │
             └──────────────┘
```

### Event Loop
- 지금 실행할 수 있는 JavaScript 작업이 있는지 계속 확인하고, 실행 가능한 작업을 Call Stack에서 실행 될수 있도록 연결하는 매커니즘
- 비동기 작업이 완료되어 후속 JavaScript 작업을 실행할 수 있게 되었을 때, 그 작업이 Main JS Thread에서 실행될 수 있도록 Node의 실행 흐름을 조율한다.
```
MariaDB
   ↓
결과 도착
   ↓
후속 작업이 실행 가능해짐
   ↓
Queue 등에서 실행 시점을 기다림
   ↓
Event Loop
   ↓
JavaScript에서 후속 처리
```


### Event Queue
- 비동기 작업이 완료되면 관련 callback이나 후속 작업이 실행 가능한 상태가 되고, Event Loop가 적절한 시점에 JavaScript가 실행되도록 조율한다.
- 실제 Node에는 큐가 하나만 있는 건 아니고 Event Loop의 여러 phase와 queue, Promise용 microtask queue 등이 있다.
```
 실행 가능한 작업들
        │
        ↓
   [대기하는 곳]
        │
        ↓
   Event Loop
        │
        ↓
Main JS Thread에서 실행
```


### 이해하면 좋은 전체 과정
```
app.get("/users", async (req, res) => {

    const users =
        await db.query("SELECT * FROM users");

    res.json(users);
});
```

```
① Client
     │
     │ GET /users
     ↓

② Node Main JS Thread

   /users JS 실행
     │
     │
     ↓
   db.query()
     │
     │ SQL 요청
     │
     └──────────────────────┐
                            ↓

③                     MariaDB Process

                       SQL 실행
                       ███████
                       ███████

					   Node에서는
					   await 이후 실행 중단
					
					   하지만 Main Thread는
					   다른 JS 처리 가능
					
					   Request B
					   Request C
					   ...

                            │
④                     SQL 완료
                            │
       결과                  │
   ←────────────────────────┘

⑤ Node에 결과 도착

   Promise 완료
       ↓
   await 이후 코드가
   실행 가능한 상태
       ↓
   Event Loop를 통한
   실행 흐름 조율
       ↓
   Main JS Thread
       ↓

⑥ res.json(users)
```

### libuv
- Node가 하는 작업 중에서 일부 파일 시스템이나 crypto처럼 libuv Thread Pool을 활용하는 작업이 있다.
```
비동기 I/O
    │
    ├─ Network → OS의 비동기 I/O 기능
    │
    ├─ DB → Network → DB 프로세스/서버가 실제 처리
    │
    └─ 일부 File/Crypto 등 → libuv Thread Pool 활용
```


### CPU 작업
```
app.get("/calculate", (req, res) => {

    let result = 0;

    for (let i = 0; i < 100000000000; i++) {
        result += i;
    }

    res.json(result);
});

Main JS Thread

████ CPU 계산 ████
████ CPU 계산 ████
████ CPU 계산 ████

Request B → 기다림
Request C → 기다림
DB 후속 JS → 기다림
Timer callback → 기다림
```
- for문을 실행하는것은 : Node Main JS Thread
- 다른 프로세스 에게 넘긴게 아니니까 Main Thread를 계속 점유
- 그래서 Event Loop가 실행시키고 싶은 다른 JS 작업이 있어도 Main Thread가 바쁘니까 밀리게 된다.

### 전체 그림
```
                    Node.js Process

               JavaScript Main Thread
                        │
                   Call Stack
                        │
                   JavaScript 실행
                        │
              ┌─────────┴─────────┐
              │                   │
         동기/CPU 작업          비동기 I/O
              │                   │
        여기서 직접 실행       외부에 작업 요청
              │                   │
      오래 걸리면 문제!      OS / DB / libuv 등
                                  │
                                  │ 완료
                                  ↓
                         실행 가능한 후속 작업
                                  │
                             Event Loop
                                  │
                                  ▼
                         JavaScript 실행 재개
```

| 주체                      | 역할                                  |
| ----------------------- | ----------------------------------- |
| **Node Main JS Thread** | JavaScript 코드 실행                    |
| **MariaDB Process**     | 실제 SQL 처리                           |
| **OS / libuv 등**        | 종류에 따라 비동기 I/O를 지원                  |
| **Event Loop**          | 완료된 비동기 작업 이후의 JS가 적절한 시점에 실행되도록 조율 |

> **Node가 Single Thread라는 것은 JavaScript를 실행하는 Main Thread가 기본적으로 하나라는 뜻이지, 모든 작업을 그 Thread 혼자 한다는 뜻이 아니다.**


### 마무리
> Node.js는 single-thread인데 어떻게 여러 요청을 동시에 처리하나요?
> : Node.js는 JavaScript 코드를 기본적으로 하나의 메인 스레드에서 실행합니다. 하지만 DB나 네트워크 같은 I/O 작업은 메인 스레드가 직접 기다리지 않고 OS의 비동기 I/O기능을 활용합니다. I/O를 기다리는 동안 메인 스레드는 다른 요청을 처리할 수 있고, 작업이 완료되면 Event Loop를 후속 JavaScript 작업이 실행됩니다. 그래서 하나의 JavaScript 메인 스레드로도 많은 I/O 요청을 효율적으로 처리할 수 있습니다.

> async/await은 어떻게 동작하나요?
> : async 함수는 Promise를 반환하고, await을 만나면 해당 Promise가 완료될때 까지 그 async 함수의 후속 실행을 잠시 중단합니다. 하지만 메인 스레드 전체를 Blocking하는 것은 아니어서 그동안 Event Loop가 다른 작업을 처리할 수 있습니다. Promise가 완료되면 이후 코드가 다시 실행됩니다.

> await을 만나면 Thread가 기다리는 건가요?
> : 아닙니다. await를 만나면 Promise가 완료될 때까지 해당 async 함수의 후속 실행이 중단되지만 메인 스레드 자체를 Blocking 하지는 않습니다. 그동안 Event Loop가 다른 실행 가능한 작업들이 메인 스레드에서 실행되도록 조율할 수 있습니다. 이후 Promise가 완료되면 await 이후 코드도 다시 메인 스레드 에서 실행됩니다.

```
MariaDB → SQL 처리

A 함수 → await에서 중단

Main Thread → 다른 JS 실행 가능

Event Loop → 실행 가능한 JS 작업들의 실행을 조율

DB 완료
→ Promise fulfilled
→ A 함수의 후속 부분도 실행 가능
→ Main Thread에서 실행
```