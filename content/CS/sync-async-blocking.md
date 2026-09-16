---
title: 동기,비동기 & Blocking,Non-blocking
date: 2026-09-16
tags:
  - cs
  - 동기
  - 비동기
  - blocking
  - non-blocking
  - synchronous
  - asynchronous
draft: false
---
### Question?
□ synchronous / asynchronous 차이  
□ blocking / non-blocking 차이  
□ 둘이 왜 같은 개념이 아닌가?  
□ I/O 작업이란?  
□ CPU-bound / I/O-bound 차이

**반드시 대답할 수 있어야 하는 질문**

> Blocking과 Non-blocking 차이는?

> 비동기와 Non-blocking은 같은 건가요?

> DB 조회/API 호출은 왜 I/O 작업인가요?

---

### Blocking
- 작업이 끝날 때까지 현재 실행 흐름을 기다리며 다음 작업으로 진행하지 못하는 것

### Non-blocking
- 현재 실행 흐름을 붙잡아두지 않는 것
- Node 가 I/O 작업에 잘 맞는 이유 중 하나가 I/O를 기다리는 동안 메인 JavaScript 실행 흐름을 계속 붙잡아두지 않는 구조를 가지고 있기 때문이다. Node.js 와 Java

> 호출한 실행 흐름을 붙잡아 두느냐?


### Synchronous (동기)
- 앞 작업의 결과를 중심으로 순서가 맞춰진 흐름

### asynchronous (비동기)
- 앞 작업이 끝나는 동안 호출한 쪽이 다른 일을 진행 할수 있고, 결과가 준비되면 나중에 callback/Promise/event 같은 방식으로 후속 처리를 이어가는 구조

> 작업 완료와 후속 처리를 어떤 방식으로 조율하느냐?


### I/O
- CPU가 계산하는 것 자체가 아니라 외부 장치나 시스템과 데이터를 주고받는 작업

### CPU-bound vs I/O-bound
- CPU-bound : 시간 대부분을 CPU 계산에 쓰는 작업
	- 영상처리, 이미지 변환, 압축, 암호화, 대규모 수학 계산 , AI interface
- I/O-bound : 시간 대부분을 외부 결과를 기다리는데 쓰는 작업
	- DB, Network, File, External API



### 마무리
> Blocking 과 Non-blocking의 차이가 무엇인가요?
> : Blocking은 어떤 작업이 완료될 때 까지 현재 실행 흐름이 기다리면서 다음 작업을 진행하지 못하는 방식이고, Non-blocking은 작업 완료를 기다리는 동안 현재 실행 흐름이 다른 작업을 수행할 수 있는 방식이다.

> 비동기와 Non-blocking은 같은 건가요?
> : 같은 개념은 아닙니다. Blocking/Non-blocking은 호출한 실행 흐름이 작업 완료까지 막히는지에 대한 개념이고, 동기/비동기는 작업 완료와 후속 처리를 어떤 방식으로 조율하는지에 대한 개념입니다. 실무에서는 비동기와 Non-blocking이 함께 사용되는 경우가 많아서 비슷하게 느껴질수 있습니다.

> async/await를 쓰면 blocking 인가요?
> : 아닙니다. await을 만나면 해당 async 함수의 후속 실행은 Promise가 완료될때 까지 중단되지만, Node의 메인 실행 흐름 전체를 blocking 하는 것은 아닙니다. 그동안 이벤트 루프는 다른 요청이나 작업을 처리할 수 있습니다.

**`async/await = non-blocking` ❌**

**`async/await = Promise 기반 비동기 코드를 다루는 문법` ⭕**

**`non-blocking인지 여부 = 실제 작업이 메인 실행 흐름을 점유하느냐` ⭕**

> DB 조회/API 호출은 왜 I/O 작업인가요?
> : CPU 내부에서 계산만으로 결과를 만드는 작업이 아니라 네트워크를 통해 DB나 외부 서버와 데이터를 주고 받고 그 결과를 기다리는 작업이기 때문에 I/O 작업입니다.