---
title: "Node.js는 하나의 JavaScript 스레드로 어떻게 여러 요청을 처리할까?"
date: 2026-09-16
tags: ["cs", "nodejs", "event-loop"]
draft: false
---

Node.js를 single-thread라고 부르는 것은 기본 JavaScript 실행 흐름을 가리키는 설명이다. Node.js 프로세스 전체에 스레드가 하나만 있다는 뜻은 아니다.

## 실행과 대기를 구분하기

하나의 JavaScript 실행 스레드에서는 동기 코드가 한 번에 하나씩 실행된다. 하지만 비동기 I/O를 기다리는 동안에는 다른 요청의 JavaScript를 실행할 수 있다. 여러 요청의 진행 시간이 겹치는 **동시성**과 여러 JavaScript 실행 흐름이 같은 순간에 실행되는 **병렬성**은 구분해야 한다.

CPU 계산을 JavaScript로 병렬 실행하려면 `worker_threads`나 별도 프로세스 같은 구성이 필요하다. [Node.js Worker 문서](https://nodejs.org/api/worker_threads.html)

## Promise, async, await

Promise는 나중에 성공 값 또는 실패 이유로 정착할 수 있는 결과를 나타낸다. 상태는 pending, fulfilled, rejected로 구분된다. Promise 객체 자체가 작업을 수행하는 별도 스레드는 아니다.

`async` 함수는 Promise를 반환한다. 함수의 코드는 첫 `await`에 도달하기 전까지 동기적으로 실행된다. `await`은 현재 async 함수의 후속 실행을 잠시 중단하고 호출자에게 제어권을 돌려준다. 남아 있는 동기 코드가 끝나야 다른 대기 작업도 실행될 기회를 얻는다.

```javascript
async function example() {
  console.log('A');
  await Promise.resolve();
  console.log('C');
}

example();
console.log('B');
// A → B → C
```

Promise가 이미 fulfilled여도 `await` 이후는 마이크로태스크로 재개된다. rejected이면 그 지점에서 예외가 발생하므로 `try/catch` 등으로 처리해야 한다. [MDN await 문서](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await)

## Event Loop와 Call Stack

Call Stack은 현재 실행 중인 함수 호출을 관리한다. Event Loop는 타이머나 I/O 등 준비된 콜백을 실행하는 반복적인 처리 흐름이다. 메인 스레드 옆에서 별도 스레드처럼 명령을 내리는 존재로 이해하면 혼동하기 쉽다.

Node.js에는 단 하나의 Event Queue만 있는 것이 아니다. poll, check 등 여러 phase가 있고, Promise 후속 처리는 마이크로태스크로 다뤄진다. `process.nextTick()`에도 별도 큐가 있다. 따라서 모든 비동기 작업이 하나의 FIFO 큐에 들어간다는 그림은 개념적인 단순화다. [Node.js Event Loop 문서](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)

## DB 조회는 누가 처리할까?

Promise를 반환하는 DB 드라이버를 사용한다고 가정하자.

```javascript
async function loadUsers(db) {
  const users = await db.query('SELECT id, name FROM users');
  return users;
}
```

```text
Node.js                         MariaDB
JS에서 db.query 호출 ─────────→ SQL 실행
함수는 await에서 중단             인덱스·데이터 접근
다른 요청의 JS 실행 가능          결과 생성
결과 수신·드라이버 처리 ←──────── 응답
Promise 정착
마이크로태스크로 함수 재개
```

실제 SQL 실행은 MariaDB 프로세스가 한다. Node.js는 통신을 하고, 응답을 드라이버에서 해석해 Promise 결과를 전달한다. DB가 Node.js의 Call Stack에 직접 함수를 넣는 것은 아니다. 결과를 파싱하거나 가공하는 Node.js 코드에도 CPU 시간이 든다.

## 모든 I/O가 libuv 스레드 풀로 갈까?

네트워크 I/O는 주로 OS의 비동기/준비 상태 통지 기능을 이용한다. 파일 시스템 비동기 API와 일부 crypto, DNS API 등은 libuv 스레드 풀을 사용한다. DB 통신을 한다고 SQL 계산이 libuv 스레드 풀에서 실행되는 것은 아니다. 실제 경로는 사용한 API에 따라 다르다. [Node.js Event Loop와 Worker Pool 설명](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)

## CPU 계산이 길면 왜 서버가 느려질까?

오래 걸리는 동기 반복문이 메인 스레드를 점유하면 다른 요청, 타이머 콜백, DB 응답의 후속 JavaScript도 기다린다. 이를 async 함수 안에 넣어도 같은 문제가 생긴다.

대응 방법은 작업에 따라 다르다. 계산 자체를 줄이거나 작은 단위로 나누고, 큰 CPU 작업은 Worker나 별도 작업 프로세스로 분리할 수 있다. 무한히 마이크로태스크만 이어 붙이는 방식도 I/O 처리를 굶길 수 있으므로 단순히 Promise를 추가하는 것으로 해결되지 않는다.

## 짧게 설명하기

> Node.js는 기본적으로 하나의 메인 스레드에서 JavaScript를 실행하지만, 비동기 I/O를 기다리는 동안 다른 요청을 진행할 수 있다. 작업이 완료되면 준비된 콜백과 Promise 후속 처리가 실행된다. 다만 오래 걸리는 동기 계산은 메인 스레드를 점유하므로 다른 요청까지 지연시킨다.

## 관련 글

[[CS/index|CS 학습 글 목록]]
