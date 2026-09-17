---
title: "DICOM / PACS"
date: 2026-09-17
tags: ["healthcare-it", "dicom", "pacs", "medical-imaging"]
draft: false
---
**의료영상 AI 시스템** 의 개념적인 흐름
**CT 촬영  
→ DICOM 생성  
→ PACS 저장  
→ 플랫폼에서 영상 수집  
→ AI 분석 job 생성  
→ AI 분석  
→ 결과 저장/상태 관리  
→ 의료진에게 결과 제공**

### Question?
□ Digital Imaging and Communications in Medicine  
□ 의료영상의 저장/전송 표준  
□ 영상뿐 아니라 metadata도 포함  
□ Patient / Study / Series / Instance 관계  
□ CT 한 검사에 여러 image(instance)가 존재할 수 있음
□ Picture Archiving and Communication System  
□ 의료영상 저장/조회/전송 시스템  
□ CT/MRI/X-ray 등의 의료영상을 관리


---
### DICOM
- Digital Imaging and Communications in Medicine
- 의료영상을 저장하고 주고받기 위한 표준
```
영상 데이터
+
환자 정보
+
검사 정보
+
촬영 장비 정보
+
촬영 조건
+
각종 식별자(UID)
```
- 예를 들면 아래와 같은 metadata가 있어.
```
PatientID
StudyInstanceUID
SeriesInstanceUID
SOPInstanceUID
Modality
StudyDate
```
- DICOM = 의료영상 + 관련 metadata + 이를 저장/전송하는 표준


### Patient / Study / Series / Instance
- 환자 한 명이 CT를 찍었다고 해보자.
```
Patient 
  ↓
Study
  ↓
Series
  ↓
Instance
```

- Patient : 환자
- Study : 한 번의 검사 단위 
	- 2026-09-16 Chest CT 검사
	- 하나의 StudyInstanceUID로 식별
- Series : 한 검사 안에서도 여러 촬영 시리즈가 생길수 있다.
	```
	Study
	├─ Series 1: 얇은 slice
	├─ Series 2: 두꺼운 slice
	├─ Series 3: contrast phase
	└─ Series 4: reconstruction
	```
- Instance : Series 안의 개별 DICOM 객체
	- 전통적인 single-frame CT에서는 보통 각 slice image가 하나의 instance이다. 다만 multi-frame DICOM에서는 하나의 instance에 여러 frame을 담을 수 있으므로, instance와 slice가 항상 1:1인 것은 아니다.
	```
	Series
	├─ Instance 1
	├─ Instance 2
	├─ Instance 3
	├─ ...
	└─ Instance 300
	```
	- CT 한 검사에는 수백 장의 DICOM image가 존재할 수 있다.


### UID
- DICOM에서 각각의 객체를 구분하려고 UID를 많이 사용
```
Study
StudyInstanceUID = A

  ├─ Series
  │   SeriesInstanceUID = B
  │
  │   ├─ Instance
  │   │   SOPInstanceUID = C1
  │   ├─ Instance
  │   │   SOPInstanceUID = C2
  │   └─ Instance
  │       SOPInstanceUID = C3
```
- 같은 DICOM instance가 두 번 들어왔다 => 중복 처리
- 그럼, SOPInstanceUID 같은 식별자를 이용해서 동일 객체인지 판단하는 설계가 가능할 수 있지.물론 실제 시스템에서 어떤 UID 조합을 유일성 기준으로 쓸지는 요구사항에 따라 달라져.


### PACS
- Picture Archiving and Communication System
- 병원에서 의료영상을 저장하고 조회하고 전송하는 시스템
- CT, MRI, X-ray 같은 장비에서 영상이 만들어지면 PACS에 보관하고 의료진이 조회할 수 있다.


### 의료 영상 AI 시스템 흐름
```
환자
 ↓
CT 촬영
 ↓
CT 장비가 DICOM 생성
 ↓
PACS로 전송
 ↓
PACS에 저장


CT / MRI / X-ray
       ↓
	DICOM 생성
       ↓
	PACS
       ↓
	영상 저장
	영상 조회
	영상 전송
	
	
EMR
→ 환자 진료정보

OCS
→ 검사/처방 workflow

PACS
→ 의료영상 관리


CT 촬영
   ↓
DICOM 생성
   ↓
PACS 저장
   ↓
AI 플랫폼이 영상 수집
   ↓
분석 대상 Study / Series 확인
   ↓
AI Analysis Job 생성
   ↓
AI 분석
   ↓
결과 저장
   ↓
의료진에게 결과 제공
```


### DICOM 수집/저장/전송 기능 개발 및 유지보수
```
DICOM 수신
↓
metadata parsing
↓
Study / Series / Instance 식별
↓
DB 저장
↓
파일 저장
↓
AI job 생성
↓
상태 관리
↓
다른 시스템으로 전달
```
- 영상이 안전하게 들어오고, 저장되고, 어떤 검사인지 식별되고, 분석 작업으로 연결되고, 결과가 다시 서비스에 연결되는 전체 backend workflow
- JPG는 픽셀 데이터 중심이지만 DICOM은:
```
Header / Metadata
+
Pixel Data
```

```
PatientID
Modality = CT
StudyDate
StudyInstanceUID
SeriesInstanceUID
SOPInstanceUID
...
Pixel Data
```

- 그래서 AI 분석 시스템도 단순히 이미지 픽셀만 볼 게 아니라 metadata를 이용해서 이 영상이 누구 것인지, 어떤 검사인지, 어떤 Series인지, 중복인지, 분석 대상인지 를 판단할 수 있다.
- DICOM 통신 : DICOM은 파일 포맷뿐 아니라 통신 표준도 포함한다.
```
C-STORE
→ DICOM 객체 전송/저장

C-FIND
→ 검색

C-MOVE / C-GET
→ 영상 조회/전송
```
- 이 영상을 저장해줘~
```
CT 장비
  │
  │ C-STORE
  ↓
PACS
```

### 마무리

> DICOM과 PACS의 차이

> DICOM은 의료영상의 저장/전송 형식과 통신 방식을 정의한 표준이고, PACS는 그 DICOM 의료영상을 실제로 저장·조회·전송하는 시스템입니다.

> DICOM이 뭔가요?

> **“DICOM은 의료영상과 관련 metadata를 저장하고 전송하기 위한 의료영상 표준입니다. CT, MRI, X-ray 등의 영상뿐 아니라 Patient, Study, Series, Instance를 식별할 수 있는 정보도 포함합니다.”**

> PACS는요?

> **“PACS는 Picture Archiving and Communication System으로, 병원에서 DICOM 기반 의료영상을 저장하고 조회하고 전송하기 위한 시스템입니다.”**

> Study / Series / Instance 설명해보세요.

> **“Patient 아래에 하나의 검사 단위인 Study가 있고, 한 Study 안에 촬영 방식이나 재구성 조건 등에 따라 여러 Series가 존재할 수 있습니다. 각 Series 안에는 개별 DICOM 객체인 Instance들이 포함됩니다. 예를 들어 CT 한 검사에는 수백 개의 image instance가 있을 수 있습니다.”**


> 같은 DICOM 영상이 두 번 들어오면 어떻게 하겠어요?

> **“먼저 어떤 식별자를 기준으로 동일 영상인지 정의하겠습니다. 예를 들어 SOPInstanceUID 같은 DICOM 고유 식별자를 이용할 수 있고, DB에 UNIQUE constraint를 두어 중복 저장을 막을 수 있습니다. 애플리케이션 체크만으로는 동시에 요청이 들어왔을 때 race condition이 생길 수 있기 때문에 DB constraint를 최종 방어선으로 두겠습니다.”**


### AI 분석 10분 문제

DICOM 수집 후:

```
DICOM 수신
 ↓
DB 저장
 ↓
AI job 생성
 ↓
Queue
 ↓
Worker
 ↓
AI 분석
 ↓
결과 저장
```

```
DICOM
→ 입력 데이터

UNIQUE / Idempotency
→ 중복 영상/중복 분석 방지

Transaction
→ 상태/metadata 저장 정합성

Queue / Worker
→ AI 분석 비동기 처리

Retry / Timeout
→ AI 서비스 장애 대응

PostgreSQL / MongoDB
→ metadata / job / 분석 결과 저장
```

> **“CT 장비에서 촬영하면 DICOM 형태의 영상과 metadata가 생성되고, 일반적으로 PACS 같은 시스템에 저장됩니다. 의료영상 AI 플랫폼에서는 해당 영상을 수집해 Study/Series/Instance 등의 정보를 식별하고 분석 job을 생성한 뒤, Worker나 AI 분석 시스템에서 비동기로 분석하고 결과와 상태를 저장해서 의료진이 확인할 수 있도록 제공하는 흐름으로 이해하고 있습니다.”**

### 참고 자료
- [DICOM Multi-frame Module](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.6.html)
