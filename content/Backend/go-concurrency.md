---
title: "Go"
date: 2026-09-17
tags: ["backend", "go", "goroutine", "channel", "concurrency"]
draft: false
---
> “Go 실무 경험은 없습니다. 현재는 Node.js 기반으로 Backend를 개발하고 있습니다. 다만 이번 포지션을 준비하면서 Go의 기본 문법과 goroutine/channel을 이용한 동시성 모델을 공부하고 있습니다. 기존 Backend 경험을 기반으로 Go로 전환할 의향이 있습니다.”

### Question?
□ Go가 어떤 언어인가?  
□ 정적 타입 / 컴파일 언어  
□ Garbage Collection  
□ Goroutine  
□ Channel  
□ Go가 서버 개발에 많이 사용되는 이유  
□ Goroutine과 OS Thread가 같은 것이 아니라는 것  
□ 동시성에 강하다고 하는 이유


---
### Go는 어떤 언어인가?
- Go는 Google에서 만든 정적 타입(static typing), 컴파일 언어이다.
- Node.js의 JavaScript랑 비교
```
JavaScript / Node.js
- 동적 타입
- 보통 실행 시점에 타입이 결정됨
- V8 엔진이 실행

Go
- 정적 타입
- 컴파일 시점에 타입 검사
- 실행 파일로 컴파일해서 실행
```
- Go는 컴파일 전에 타입 오류를 잡아주는 정적 타입 언어다.
- 컴파일 언어란 : Go 코드를 작성하면 그대로 실행하는게 아니라 컴파일해서 실행 가능한 바이너리로 만든다. 배포할때 단일 실행 파일 형태로 가져가기 쉬운 편이다. 이것이 서버 개발시에 꽤 편리하다.


### Garbage Collection
- Go는 C/C++ 처럼 개발자가 직접 malloc,free를 관리하는 방식은 아니고, 사용하지 않는 메모리를 runtime이 자동으로 회수하는 Garbage Collection(GC)를 제공한다.
- 메모리 관리는 자동화 되어있지만 ,GC 비용이 완전히 없는 건 아니다.


### Goroutine
- Go는 동시성 처리를 쉽게 하기 위해 goroutine이라는 실행 단위를 제공한다.
```
go doSomething()
```
- 이렇게 쓰면 doSomething()을 goroutine으로 실행한다.
```
main goroutine
   ↓

go taskA()
go taskB()
go taskC()

→ 여러 작업을 동시에 진행 가능
```


### Goroutine = Thread 인가?
- 아닙니다. Goroutine은 OS Thread 보다 훨씬 가벼운 실행 단위고, Go runtime이 여러 goroutine을 여러 OS thread 위에 스케줄링 합니다.
```
Goroutine 1 ─┐
Goroutine 2 ─┼──→ OS Thread A
Goroutine 3 ─┤
             │
Goroutine 4 ─┼──→ OS Thread B
Goroutine 5 ─┘
```
- Go rountime 이 중간에서 조율한다. 이걸 M:N scheduling 이라고 표현
- 여러 gorountine(M)을 여러 OS thread(N)에 매핑해서 실행하는 구조.
- goroutine이 가볍다고 하는 이유 : OS Thread는 생성/전환 비용이 상대적으로 더 크고 stack도 비교적 크게 시작하는 편이다. 반면, goroutine은 생성 비용이 작고, 초기 stack도 작고, runtime이 필요에 따라 stack을 늘릴 수 있고, scheduling도 Go runtime이 담당 한다. 그래서 아주 많은 동시 작업을 만들기 쉽다.


### Node.js와 비교
- I/O 중심으로 많은 요청을 효율적으로 처리한다.
```
JavaScript Main Thread
   ↓
Event Loop
   ↓
비동기 I/O
```
- 여러 goroutine을 통해 동시 작업을 처리한다.
```
Goroutine
Goroutine
Goroutine
   ↓
Go Runtime Scheduler
   ↓
OS Threads
```
- Node 는 event loop 기반 비동기 모델이 핵심이고, Go는 goroutine 기반 동시성 모델 이 핵심


### Channel
```
channel
= goroutine 사이에서 데이터를 주고받는 통로
+ 필요하면 실행 타이밍도 맞춰주는 동기화 수단
```
- goroutine 끼리 데이터를 주고 받을 때 사용하는 통신 수단
- 예:
```
ch := make(chan string)

goroutine A가:
ch <- "hello" 보내고,

goroutine B가:
msg := <-ch 받을 수 있어.

개념적으로:
Goroutine A

"hello"
   │
   ↓
Channel
   │
   ↓
Goroutine B
```
- 왜 channel을 쓰냐? : 여러 goroutine이 같은 메모리를 공유하면, race condition이 생길수 있다. 그래서 Go에서는 메모리를 공유해서 통신하기보다, 통신을 통해 데이터를 공유하라라는 철학을 가지고 있다.
- 물론 Go에서도 mutex를 쓸수 있다.
```
Channel
→ goroutine 간 데이터 전달 / 동기화

Mutex
→ shared memory 보호
```
-  Channel도 Blocking 될 수 있다.
```
예를 들어 unbuffered channel에서는:
ch <- "hello"

를 보내려는데 받을 goroutine이 없으면 sender가 기다릴 수 있어.
즉 channel 자체가 동기화 수단 역할도 해.

개념적으로:

A: 데이터 보낼게
       ↓
    Channel
       ↓
B: 받을게

서로 맞아야 진행
```


### Go가 서버 개발에 많이 사용되는 이유
- 동시성 처리 : goroutine이 가볍고 많이 만들기 쉬워서 네트워크 서버나 background worker 같은 동시 작업 처리에 유리하다.
- 성능 : 컴파일 언어라 일반적으로 좋은 실행 성능을 기대할수 있다.
- 배포 편의성 : 단일 바이너리로 배포하기 쉬움
- 언어 자체가 비교적 단순 : 문법이 비교적 단순하고 표준 도구가 잘 갖춰져 있다.
- 서버/클라우드 생태계 : Docker,Kubernetes 같은 인프라 도구들이 Go로 만들어졌을 정도로 서버/클라우드 환경에서 널리 사용됨.


### 동시성
- goroutine과 channel, runtime scheduler 같은 기능을 언어 차원에서 제공해서 동시성 코드를 비교적 간단하게 작성할 수있다.
- race condition도 여전히 생길수 있다.
- 그래서 mutex, channel, atomic operation 같은 동시성 제어가 필요하다.


### Worker
- 예를 들어 AI 작업 여러 개가 들어왔다고 해보자.
```
Job 1
Job 2
Job 3
Job 4
```
- Go에서는 처럼 worker pool 구조를 만들기 쉬워.
```
goroutine 1 → Job 1
goroutine 2 → Job 2
goroutine 3 → Job 3
goroutine 4 → Job 4
```
- 또 같은 형태도 흔히 생각할 수 있어.
```
Queue
  ↓
Channel
  ↓
여러 Worker goroutine
```
-  즉, AI 작업 스케줄링 / 비동기 처리 / worker 와 Go의 goroutine/channel 모델이 잘 맞는 편이야.


### 마무리
- Goroutine vs OS Thread : 같은 것이 아님.
```
Goroutine
→ Go runtime이 관리하는 경량 실행 단위

OS Thread
→ 운영체제가 관리하는 실제 Thread
```
- Goroutine vs Worker : 다른 개념.
```
Goroutine
→ 언어/runtime 레벨 실행 단위

Worker
→ 시스템에서 작업을 처리하는 역할/프로세스/구성요소
```
- Worker 하나 안에서도 goroutine 여러 개를 돌릴 수 있어.
```
Worker Process

 ├─ goroutine 1
 ├─ goroutine 2
 ├─ goroutine 3
 └─ goroutine 4
```


> **“Go는 정적 타입의 컴파일 언어이고 Garbage Collection을 지원합니다. 서버 개발에서는 goroutine이라는 경량 실행 단위와 channel을 이용해 동시성 처리를 비교적 간단하게 구현할 수 있다는 장점이 있습니다. Goroutine은 OS Thread 자체가 아니라 Go runtime이 여러 OS Thread 위에 스케줄링하는 실행 단위입니다. 또한 단일 바이너리 배포가 편하고 성능과 서버 운영 측면의 장점 때문에 Backend나 인프라 영역에서 많이 사용됩니다.”**


> **“Go 실무 경험은 없습니다. 현재는 Node.js 기반으로 Backend를 개발하고 있습니다. 다만 이번 포지션을 준비하면서 Go의 기본 문법과 goroutine/channel을 이용한 동시성 모델을 공부하고 있습니다. 기존 Backend 경험을 기반으로 Go로 전환할 의향이 있습니다.”**

