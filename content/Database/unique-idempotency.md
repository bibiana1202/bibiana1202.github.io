---
title: "Unique & Idempotency & 중복 처리"
date: 2026-09-16
tags: ["database", "unique-constraint", "idempotency", "concurrency"]
draft: false
---
### Question?
□ UNIQUE constraint  
□ Idempotency(멱등성)란?  
□ 동일 요청 두 번 들어오면?  
□ DB unique key를 이용한 중복 방지  
□ Application에서 체크만 하면 race condition이 생길 수 있는 이유


---
### UNIQUE constraint
- 특정 column 또는 column 조합의 값이 중복되지 않도록 DB가 강제하는 제약조건
- 애플리케이션이 아니라 DB가 최종적으로 보장


### Idempotency (멱등성)
- 같은 요청을 여러 번 수행해도 최종 결과가 한 번 수행했을 때와 같도록 만드는 성질
- 중복 요청이 들어와도 중복 효과가 발생하지 않도록 만드는 것
- UNIQUE constraint는 멱등성을 구현하는 강력한 도구 중 하나


### check-then-act race condition
- 사이에 다른 요청이 끼어들수 있다.
- 그래서 DB UNIQUE가 중요하다.


### 복합 UNIQUE constraint
> 동일한 DICOM 영상이 두 번 들어왔습니다. AI 분석 작업이 두 번 생성되지 않게 하려면?

```
StudyInstanceUID
SeriesInstanceUID
SOPInstanceUID
```
- DICOM 영상에는 일반적으로 식별자가 있다.
- 예를 들어 AI 분석 단위가 DICOM instance라고 가정해보면
```
SOPInstanceUID = 1.2.840.123456...

첫번째 영상이 들어옴
DICOM
UID = ABC123

AI job
job_id = 100
dicom_uid = ABC123
status = **PENDING**

그런데 같은 영상이 다시 들어왔다.
DICOM
UID = ABC123

그대로 INSERT하면 AI 분석이 두번 실행 될수도 있다.
job 100 → ABC123
job 101 → ABC123
```
- 가장 기본적인 방법은 AI job 테이블에 UNIQUE(dicom_uid)를 두는것이다.
- AI 분석이 영상 하나당 무조건 한번만 가능한 시스템이 아닐수도 있다. 그럼 대신 UNIQUE(dicom_uid,model_version) 처럼 만들수 있다. -> 이것이 복합 UNIQUE constraint
- 실제 설계에서는 무엇을 같은 요청 이라고 정의 할것인지가 중요하다.

### Idempotency Key
- API 요청 자체에 고유한 키를 붙일수 있다.


### 마무리
```
중복 여부
→ UNIQUE

두 작업 모두 성공 여부
→ Transaction

동시 요청 충돌
→ UNIQUE / Lock / concurrency control

같은 요청을 여러 번 처리해도 결과 하나
→ Idempotency
```


> 동일한 DICOM 영상이 동시에 두 번 들어오면 AI 분석 작업 중복 생성을 어떻게 막겠습니까?

처음부터 너무 복잡하게 말하지 말고:

> **“먼저 시스템에서 동일 영상과 동일 분석 작업을 식별할 수 있는 고유 기준을 정의하겠습니다. 예를 들어 DICOM UID와 모델 버전 조합이 동일한 작업을 중복으로 보지 않는다면 해당 값에 UNIQUE constraint를 두어 DB 레벨에서 중복 생성을 막을 수 있습니다. 애플리케이션에서도 기존 작업을 먼저 확인할 수 있지만, 동시에 요청이 들어오면 둘 다 존재하지 않는다고 판단하는 race condition이 생길 수 있기 때문에 DB UNIQUE constraint를 최종 방어선으로 두겠습니다. 중복 요청이 들어온 경우에는 새 작업을 만들지 않고 기존 job을 반환하도록 멱등하게 처리하겠습니다.”**

```
UNIQUE
→ DB가 중복 값을 허용하지 않음


Idempotency
→ 동일한 요청을 여러 번 해도
   최종 효과가 한 번 처리한 것과 같음


Application check만 사용
→ 동시에 두 요청이 check하면
   둘 다 "없음"이라고 판단 가능
→ Race Condition


그래서

Application check
+
DB UNIQUE

를 함께 사용할 수 있음
```


> **“블록체인 transaction 처리에서도 transaction의 고유 식별자를 기준으로 중복 반영되지 않도록 처리한 경험이 있습니다. 같은 원리로 의료영상 분석 job도 시스템에서 유일성을 판단할 key를 정의하고 DB constraint와 application logic을 같이 활용할 수 있다고 생각합니다.”**