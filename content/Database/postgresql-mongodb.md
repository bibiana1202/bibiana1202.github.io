---
title: "PostgreSQL / MongoDB"
date: 2026-09-16
tags: ["database", "postgresql", "mongodb", "data-modeling", "transaction"]
draft: false
---
### Question?
□ RDB가 무엇인가  
□ PostgreSQL도 관계형 DB  
□ MariaDB와 공통점/차이가 있다는 정도  
□ Transaction / Index / JOIN
□ Document DB  
□ JSON/BSON 형태  
□ Collection / Document  
□ RDB와 어떤 점이 다른가  
□ 언제 document DB를 고려하는가

> PostgreSQL은 내가 아는 RDB의 연장선, MongoDB는 데이터 모델링 방식이 다름.
---
### RDB
- Relational Database, 관계형 데이터 베이스.
- 데이터를 table 형태로 저장하고, table 간 관계를 정의해서 관리하는 것.
- MaraiDB, Oracle, PostgreSQL
> “PostgreSQL 실무 경험은 많지 않지만 MariaDB와 Oracle 기반으로 SQL, JOIN, Index, Transaction, constraint를 사용한 경험이 있어서 관계형 DB 기본 개념은 익숙합니다. 데이터 모델링, SQL 작성, transaction, index 설계 같은 핵심 사고방식은 그대로 적용 가능하다.
- PostgreSQL은 표준 준수와 확장성이 강한편, JSON/JSONB 같은 반정형 데이터 기능도 강함, 다양한 index 타입과 고급 쿼리 기능이 풍부
- MariaDB/MySQL 계열은 웹 서비스에서 널리 쓰이고 익숙한 운영 생태계가 크다.


### MongoDB
- Document Database
- RDB 처럼 table-row 중심이 아니라, document 단위로 저장.
```
{
  "_id": 1,
  "name": "혜정",
  "email": "a@test.com",
  "skills": ["Node.js", "MariaDB"],
  "profile": {
    "age": 32,
    "city": "Seoul"
  }
}
```
- JSON 비슷한 구조로 저장함. 실제로는 BSON(Binary JSON) 형식으로 저장됨
- Collection, Document
```
RDB와 비교하면:

RDB
Database
  ↓
Table
  ↓
Row


MongoDB는:

MongoDB
Database
  ↓
Collection
  ↓
Document


예:
users collection

Document 1
{
  name: "혜정",
  age: 32
}

Document 2
{
  name: "창일",
  age: 33
}
```
- RDB와 MongoDB 차이
	- schema와 관계 표현 방식
	- RDB는 schema가 명확하고 정형적이나, MongoDB는 document마다 구조가 조금씩 달라도 가능
	- RDB는 관계를 잘 다룬다, 관계가 복잡하고 transaction이 중요한 시스템에서 RDB가 강점.
	- MongoDB는 데이터 구조가 자주 바뀌거나, document 단위로 데이터를 읽고 쓰는게 자연스러운 경우 고려. 로그성 데이터 또, 사용자 profile 처럼 중첩 구조가 자연스러운 데이터도 document 형태가 편리할수 있다.
- MongoDB는 schema가 없다 ❌, RDB보다 flexible schema를 가진다 ⭕
- MongoDB도 application level schema 나 validation을 충분히 적용 가능
- MongoDB도 Index 있다 = MongoDB도 조회 성능 개선을 위해 index 사용 가능
- MongoDB도 Transaction 있다 = MongoDB도 multi-document transaction을 지원함, 다만 document DB를 설계할 때는 가능하면 한 document 안에 관련 데이터를 묶어서 처리하는 방식을 선호



### 마무리
- 언제 MongoDB를 고려할까?
> **“데이터 구조가 자주 변경되거나 document 자체가 하나의 조회/저장 단위로 자연스러운 경우, JSON 형태의 중첩 데이터를 유연하게 저장해야 하는 경우 MongoDB 같은 document DB를 고려할 수 있습니다.”**

반대로:

> **“강한 관계형 모델, 복잡한 JOIN, 정합성이 중요한 transaction 중심 시스템이라면 RDB를 우선 고려하겠습니다.”**


- PostgreSQL / MongoDB = 스템 안에서 데이터 성격에 따라 둘을 다르게 쓸 가능성이 있다
예를 들면 **가정적인 설계**로:

```
PostgreSQL
→ 사용자
→ job 상태
→ worklist
→ 관계형 metadata
→ transaction 중요한 데이터

MongoDB
→ 분석 결과 document
→ 유연한 AI metadata
→ nested 구조
```
같이 역할을 나눌 수도 있어.


> **“PostgreSQL 실무 경험은 많지 않지만 MariaDB와 Oracle을 사용하면서 SQL, JOIN, Index, Transaction, constraint를 다뤄왔기 때문에 관계형 DB 기본 개념은 익숙합니다. PostgreSQL도 같은 RDB 계열이기 때문에 기본적인 데이터 모델링과 쿼리 작성은 빠르게 적응할 수 있다고 생각합니다.”**


> **“MongoDB는 document 기반 NoSQL DB로 데이터를 JSON과 유사한 BSON document 형태로 저장합니다. RDB의 table-row 대신 collection-document 구조를 사용하고, schema가 비교적 유연해서 중첩 구조나 자주 변경되는 데이터를 다룰 때 유리할 수 있습니다.”**


> **“정답이 정해져 있다기보다 데이터 특성에 따라 선택하겠습니다. 관계와 transaction 정합성이 중요하면 RDB를 우선 고려하고, document 단위 조회가 자연스럽고 schema 변화가 잦은 데이터라면 MongoDB를 검토하겠습니다.”**
