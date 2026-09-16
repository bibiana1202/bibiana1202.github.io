---
title: "DB 인덱스와 B-tree: 빨라지는 이유와 비용"
date: 2026-09-16
tags: ["cs", "database", "index"]
draft: false
---

인덱스는 원하는 데이터를 찾는 탐색 비용을 줄이는 구조다. 다만 **인덱스를 만들었다는 사실과 실제 쿼리가 빨라졌다는 사실은 다르다.** 이 글의 구체적인 저장 구조 예시는 MySQL InnoDB를 기준으로 한다.

## Full Table Scan과 인덱스 탐색

조건에 맞는 데이터를 찾는 적절한 접근 경로가 없다면 DB는 테이블을 폭넓게 읽어 조건을 확인할 수 있다. 반면 인덱스가 있으면 검색 범위를 줄여 필요한 데이터에 접근할 수 있다.

작은 테이블이나 대부분의 행을 읽는 쿼리에서는 Full Table Scan이 더 유리할 수 있다. 인덱스가 존재해도 옵티마이저가 비용을 비교해 다른 계획을 선택할 수 있다.

## B-tree와 B+tree는 왜 쓰일까?

B-tree는 한 노드에 여러 키와 자식을 담고 높이를 균형 있게 유지하는 트리다. 많은 자식을 두면 트리 높이가 낮아져 검색 경로에서 거치는 페이지 수를 줄일 수 있다. B+tree는 내부 노드가 탐색을 안내하고 리프에 레코드 또는 레코드 참조를 두는 구조이며, 리프를 순서대로 따라가는 범위 조회에 적합하다.

InnoDB 인덱스는 B-tree 계열 구조를 사용한다. 클러스터드 인덱스의 리프에는 행 데이터가 저장되고, 보조 인덱스에는 해당 키와 기본 키가 들어간다. 보조 인덱스에 없는 열을 읽으려면 기본 키를 통해 행을 추가로 찾을 수 있다. 따라서 모든 인덱스를 “테이블과 완전히 별개인 위치 목록”이라고 설명하면 부정확하다. [InnoDB 인덱스 구조](https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html)

## 인덱스가 많으면 무엇이 늘어날까?

저장 공간과 메모리 사용, 데이터 변경 시 유지 비용이 늘어난다. INSERT와 DELETE는 관련 인덱스에도 영향을 준다. UPDATE는 변경된 열과 인덱스 구성에 따라 갱신 비용이 달라진다. 모든 UPDATE가 모든 인덱스의 키를 바꾸는 것은 아니다.

따라서 모든 열에 인덱스를 만드는 대신 실제 필터, 정렬, 조인 패턴과 쓰기 빈도를 함께 본다.

## 복합 인덱스는 열 순서가 중요하다

```sql
CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at);

EXPLAIN
SELECT id, user_id, created_at
FROM orders
WHERE user_id = 42
  AND created_at >= '2026-09-01'
ORDER BY created_at;
```

`(user_id, created_at)`는 먼저 user_id 순으로, 같은 user_id 안에서는 created_at 순으로 탐색할 수 있는 구조다. 따라서 user_id로 사용자를 좁히고 날짜 범위를 읽는 패턴에 잘 맞을 수 있다.

반면 created_at 조건만 있는 조회는 선두 열을 활용하는 일반적인 범위 탐색에 불리하다. 그렇다고 “두 번째 열만 조건에 쓰면 인덱스를 절대 사용하지 않는다”는 뜻은 아니다. 인덱스 전체 스캔이나 DBMS별 최적화가 가능하므로 실제 계획을 확인한다. [MySQL 복합 인덱스 문서](https://dev.mysql.com/doc/refman/8.4/en/multiple-column-indexes.html)

## LIKE와 EXPLAIN

`LIKE 'abc%'`처럼 앞부분이 고정된 패턴은 조건과 정렬 규칙에 따라 B-tree 범위 탐색을 활용할 수 있다. `LIKE '%abc%'`는 일반적인 B-tree로 시작 위치를 좁히기 어렵다. 이것도 인덱스를 전혀 읽지 않는다는 뜻과는 다르다.

명령의 정확한 철자는 **EXPLAIN**이다. MySQL의 일반적인 출력에서는 `key`로 선택한 인덱스, `type`으로 접근 방식, `rows`로 예상 검사 행 수를 살펴볼 수 있다. 추정값은 실제 실행 결과와 다를 수 있다. MySQL의 `EXPLAIN ANALYZE`는 쿼리를 실제로 실행해 측정하며, MariaDB의 대응 구문과 출력은 버전에 따라 별도로 확인해야 한다. [MySQL EXPLAIN 문서](https://dev.mysql.com/doc/refman/8.4/en/explain.html)

## 짧게 설명하기

> B-tree 계열 인덱스는 정렬된 검색 구조로 탐색 범위를 줄인다. 대신 저장 공간과 쓰기 유지 비용이 생긴다. 실제 조회 패턴에 맞춰 열과 순서를 정하고, EXPLAIN과 측정으로 효과를 확인한다.

## 관련 글

[[CS/index|CS 학습 글 목록]]
