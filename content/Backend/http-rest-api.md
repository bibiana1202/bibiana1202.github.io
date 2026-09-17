---
title: "HTTP & REST API"
date: 2026-09-17
tags: ["backend", "http", "rest", "api", "authentication", "authorization"]
draft: false
---
### Question?
□ GET  
□ POST  
□ PUT  
□ PATCH  
□ DELETE
□ 200 / 201 / 204  
□ 400 / 401 / 403 / 404  
□ 409  
□ 500 / 502 / 503
□ REST란?  
□ Resource 중심 URL  
□ HTTP method  
□ Stateless  
□ 적절한 status code

특히 **401 vs 403**, **PUT vs PATCH** 정도.

**Request → Validation → Business Logic → DB → Response**
흐름을 설명할 수 있게 준비.

---
### GET / POST / PUT / PATCH / DELETE

| Method | 보통 의미    | 예시           |
| ------ | -------- | ------------ |
| GET    | 조회       | 사용자 조회       |
| POST   | 생성       | 사용자 생성       |
| PUT    | 전체 수정/대체 | 사용자 정보 전체 변경 |
| PATCH  | 부분 수정    | 닉네임만 변경      |
| DELETE | 삭제       | 사용자 삭제       |

### PUT vs PATCH
- PUT : 해당 리소스 전체를 새로운 표현으로 대체한다는 의미
- PATCH : 리소스 중 일부 필드만 수정하는 의미

> **PUT은 리소스 전체를 대체하는 용도로 사용하고, PATCH는 리소스의 일부만 수정할 때 사용하는 것이 일반적입니다.**


### HTTP Status Code
- 2xx → 성공
	- 201 Created : 새로운 리소스를 성공적으로 생성했을 때.
	- 204 No Content : 요청은 성공했는데 응답 body를 줄 필요가 없을 때.
- 4xx → Client 쪽 요청 문제
	- 400 Bad Request : 클라이언트가 잘못된 요청을 보냈을 때. 또는 required field가 빠졌거나 요청 형식 자체가 잘못된 경우.
	- 401 Unauthorized : 인증이 안됐다.
	- 403 Forbidden : 누구인지 알겠으나, 이 작업을 할 권한이 없다.
	- 404 Not Found : 요청한 resource를 찾을 수 없음.
	- 409 Conflict : 현재 resource 상태와 요청이 충돌할 때 사용할수 있다.
- 5xx → Server 쪽 문제
	- 500 Internal Server Error : 우리 서버 내부에서 예상하지 못한 오류가 발생 또는 처리되지 않은 내부 예외.
	- 502 Bad Gateway : 우리 서버가 다른 upstream 서버에 요청했는데 이상한 응답을 받은 상황에서 gateway/proxy가 반환할 수 있다.
	- 503 Service Unavailable : 서버가 현재 요청을 처리할 수 없는 상태.
		- "서버 과부하, 점검, 의존 서비스 장애로 일시적으로 제공 불가"

| Code | 의미          | 기억법              |
| ---- | ----------- | ---------------- |
| 200  | 일반 성공       | OK               |
| 201  | 리소스 생성 성공   | Created          |
| 204  | 성공, body 없음 | No Content       |
| 400  | 잘못된 요청      | 요청 형식/validation |
| 401  | 인증 안 됨      | 너 누구야?           |
| 403  | 권한 없음       | 넌 아는데 안 돼        |
| 404  | resource 없음 | 못 찾음             |
| 409  | 현재 상태와 충돌   | 중복/Conflict      |
| 500  | 우리 서버 내부 오류 | Server error     |
| 502  | upstream 이상 | Gateway 문제       |
| 503  | 현재 서비스 불가   | 잠시 사용 불가         |


### REST
- 웹의 resource를 중심으로 API를 설계하는 architectural style.

>  REST는 URI를 통해 Resource를 표현하고 HTTP Method를 이용해서 Resouce에 대한 행위를 표한하는 API 설계 방식 입니다.

- URL에는 동사보다 Resouce(명사)를 중심으로 설계
- 행동은 HTTP method가 표현하도록.


### Stateless 
- 서버가 이전 요청의 상태에 의존해서 다음 요청을 처리하지 않고, 각 요청이 처리에 필요한 정보를 자체적으로 포함해야 한다.
- 요청마다 필요한 인증 정보등을 함께 보낸다는 개념
- Stateless = DB에 상태를 저장하면 안 된다 ❌  , Stateless = 서버에 아무 상태도 없어야 한다 ❌
- 클라이언트 요청 간 conversational state를 서버 세션에 의존하지 않는다는 의미에 더 가깝다.
- express-session을 사용하는 방식은 엄밀히 보면 서버 측 세션 상태에 의존하기 때문에 REST의 stateless 제약과는 거리가 있을수 있다.

### 마무리

> API 하나 설계하고 구현한 흐름을 설명해보세요.

라고 하면 네 경험 중 **블록체인 출금 요청 API** 같은 걸 활용하기 좋아.

구조를 단순화해서:

> **“API를 구현할 때는 먼저 Request의 파라미터와 인증 정보를 Validation하고, 이후 비즈니스 규칙을 검증합니다. 필요한 DB 변경은 Transaction과 constraint를 사용해 데이터 정합성을 보장하고, 외부 API 호출이나 오래 걸리는 작업이 있다면 Worker로 분리합니다. 마지막으로 처리 결과에 맞는 HTTP status code와 Response를 반환합니다.”**

그리고 네가 외울 흐름:

```
Request
   ↓
Validation
   ↓
Authentication / Authorization
   ↓
Business Logic
   ↓
DB
   ↓
필요하면 External API / Worker
   ↓
Response
```

**`401 = 인증`, `403 = 인가/권한`,
`PUT = 전체 대체`, `PATCH = 부분 수정`,
`201 = 생성`, `409 = 충돌`**
