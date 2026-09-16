---
title: Index
date: 2026-09-16
tags:
  - cs
  - index
draft: false
---
### Question?
□ Index란?  
□ 왜 조회가 빨라지는가?  
□ B-tree 구조 기본  
□ Full Table Scan과 차이  
□ Index의 단점  
□ INSERT/UPDATE/DELETE가 느려질 수 있는 이유  
□ 모든 column에 index를 만들면 안 되는 이유  
□ 복합 index  
□ `EXPLAIN`이 무엇인가?

**반드시 대답할 수 있어야 하는 질문**

> DB index는 일반적으로 B-tree 계열의 자료구조를 이용해 데이터를 정렬된 형태로 관리하고, 전체 테이블을 순차 탐색하지 않고 원하는 위치를 빠르게 찾을 수 있게 합니다. 대신 별도의 저장공간이 필요하고 데이터 변경 시 index도 함께 갱신해야 하기 때문에 쓰기 비용이 증가합니다.

---
### Full Table Scan
- 조건에 맞는 데이터를 찾기 위해 테이블의 row들을 광범위하게 순차적으로 확인하는 방식

### B-tree
- 실제 DB Index는 B-tree 계열을 많이 사용한다.
- 예를 들어 MySQL/MariaDB의 InnoDB 인덱스는 B+tree 계열 이다.
- B-tree는 하나의 노드에 여러 key와 자식을 가질 수 있는 균형 트리이고, 트리의 높이를 낮게 유지해서 적은 탐색으로 원하는 데이터를 찾을 수 있다.
```
B-tree 계열 Index

       ↓

검색 범위를 계속 좁힘

       ↓

abc@test.com 위치 발견

       ↓

필요한 데이터 접근
```

- LIKE에서 앞부분이 고정된 패턴('abc%')은 B-tree 인덱스로 범위 탐색이 가능할 수 있지만, 앞에 wildcard가 있는('%abc', '%abc%') 검색은 일반적인 B-tree 인덱스로 검색 범위를 좁히기 어렵다.

### Index의 trade-off
- Index가 많아질수록 INSERT/UPDATE/DELETE 시 유지해야할 자료구조가 늘어나 쓰기 비용이 증가할수 있다.
- read 성능 높아지는 대신 write 비용,저장공간, 관리비용이 늘어난다.

### 복합 Indx
- 여러 column을 조합한 검색 구조
- column 순서가 중요한데, 특히 B-tree 계열 복합 인덱스에서는 왼쪽 부터 정렬된 구조라는 점이 중요하다.

### EXPLAN
- DB가 이 쿼리를 어떤 방식으로 실행하려고 하는지 실행 계획을 확인할 수 있다.
- EXPLAN은 SQL의 실행 계획을 확인하는 명령으로, 쿼리가 어떤 인덱스를 사용하는지, Full Scan이 발생하는지 등을 확인해서 성능 문제를 분석할 때 사용합니다.

### 마무리
> Index가 뭔가요?
> : Index는 DB에서 원하는 데이터를 빠르게 찾기 위한 별도의 자료구조 입니다.

> 왜 빨라지죠?
> : 일반적으로 B-tree 계열의 정렬된 자료구조를 이용하기 때문에 전체 테이블을 순차적으로 확인하지 않고 검색범위를 빠르게 줄여 원하는 데이터 위치를 찾을 수 있습니다.

> 그럼 Index 많이 만들면 좋은 거 아닌가요?
> :아닙니다. Index 자체의 저장공간이 필요하고 INSERT, UPDATE, DELETE가 발생하면 Index도 함께 갱신해야 해서 쓰기 비용이 증가합니다. 그래서 실제 조회 패턴을 보고 필요한 Index를 설계해야 합니다.


> 만든 Index를 실제 쿼리가 쓰는지 어떻게 확인하죠?
> : EXPLAIN으로 실행 계획을 확인해서 어떤 Index를 사용하는지, Full Scan이 발생하는지 등을 확인할 수 있습니다.