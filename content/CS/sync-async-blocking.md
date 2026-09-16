---
title: "동기·비동기와 Blocking·Non-blocking 구분하기"
date: 2026-09-16
tags: ["cs", "async", "io"]
draft: false
---

동기/비동기와 Blocking/Non-blocking은 함께 등장하지만, 설명하는 관점이 다르다. 이 글에서는 **호출한 실행 흐름과 작업 완료 통지**를 기준으로 구분한다. 분야와 API 문서에 따라 용어 범위가 조금씩 다를 수 있다.

## 두 가지 질문으로 나누기

| 구분 | 확인할 질문 | 의미 |
| --- | --- | --- |
| Blocking | 호출이 실행 흐름을 붙잡는가? | 결과나 진행 조건을 기다리는 동안 호출한 스레드가 다음 코드를 실행하지 못함 |
| Non-blocking | 기다리지 않고 제어권을 돌려주는가? | 당장 완료할 수 없어도 반환하며, 결과가 아직 준비되지 않았음을 알릴 수도 있음 |
| 동기 | 호출 흐름 안에서 완료를 확인하는가? | 호출과 결과 처리가 직접 연결됨 |
| 비동기 | 완료를 나중에 전달받는가? | 콜백, Promise, 이벤트 등으로 후속 처리를 연결함 |

Non-blocking 호출이 반드시 최종 결과를 바로 주는 것은 아니다. 예를 들어 non-blocking 소켓 읽기는 데이터가 없을 때 아직 읽을 수 없다는 상태를 반환할 수 있다. 호출자는 준비 상태를 기다리거나 나중에 다시 시도한다.

Node.js의 비동기 파일 API와 동기 파일 API를 비교하면 실행 흐름의 차이가 보인다. [Node.js Blocking과 Non-blocking 설명](https://nodejs.org/en/learn/asynchronous-work/overview-of-blocking-vs-non-blocking)

```javascript
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

// 파일을 읽는 동안 현재 JavaScript 실행 흐름이 멈춘다.
const first = readFileSync('example.txt', 'utf8');

// Promise를 받아 두고, 완료 결과는 나중에 처리한다.
const pending = readFile('example.txt', 'utf8');
console.log('읽기 요청 후 다른 코드 실행');
const second = await pending;
```

이 예제는 `example.txt`가 있는 환경의 ES module에서 실행한다. 파일 읽기 오류 처리 코드는 생략했다.

## await은 무엇을 기다릴까?

`await`은 해당 async 함수의 후속 실행을 중단한다. Promise가 정착하면 후속 코드가 마이크로태스크로 재개되며, 실패하면 해당 지점에서 예외가 발생한다. 이미 완료된 Promise를 기다려도 후속 실행은 현재의 동기 실행과 분리된다. [MDN await 문서](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await)

따라서 비동기 I/O를 `await`하는 동안 다른 JavaScript 작업이 실행될 수 있다. 하지만 `await` 뒤에 적었다는 이유만으로 호출 대상이 non-blocking이 되는 것은 아니다.

```javascript
async function calculate() {
  // 이 계산은 첫 await 전에 현재 스레드에서 실행된다.
  let total = 0;
  for (let i = 0; i < 1_000_000; i++) total += i;
  return total;
}

await calculate();
```

`async`는 반환값을 Promise로 다루게 해 주는 문법이다. 계산을 다른 스레드로 자동 분리하지 않는다.

## I/O-bound와 CPU-bound

I/O는 파일, 네트워크, 외부 서버 등과 데이터를 주고받는 작업이다. 별도 DB 서버에 질의하는 애플리케이션은 요청과 응답을 주고받으므로 I/O를 수행한다. DB 서버 내부에서는 SQL 실행을 위해 CPU 계산과 저장장치 접근이 일어난다.

CPU-bound는 CPU 계산이 주된 병목인 상황이고, I/O-bound는 입출력 대기가 주된 병목인 상황이다. 작업 이름만으로 고정되는 속성은 아니다. DB 조회도 애플리케이션에서는 응답 대기가 길지만 DB 서버에서는 계산이 병목일 수 있다. AI 추론도 실행 환경에 따라 CPU, GPU, 메모리 등이 병목이 될 수 있다.

## 짧게 설명하기

> Blocking/Non-blocking은 호출이 실행 흐름을 막는지에 관한 구분이다. 동기/비동기는 작업의 완료와 후속 처리를 연결하는 방식에 관한 구분이다. `async/await`은 Promise 기반 흐름을 표현하며, 실제 작업의 non-blocking 여부는 호출한 API와 코드가 결정한다.

## 관련 글

[[CS/index|CS 학습 글 목록]]
