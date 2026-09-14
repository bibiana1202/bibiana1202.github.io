# Development Blog

Quartz **4.5.2** 기반 개발 블로그. Node.js 22 이상과 npm 10.9.2 이상을 사용합니다.

## 공개 콘텐츠의 경계

이 저장소에는 공개용 사이트와 승인된 콘텐츠만 보관합니다. private journal 저장소를 복제하거나 하위 모듈·심볼릭 링크로 연결하지 않습니다. 배포 서버는 journal에 접근하지 않습니다.

로컬 `.blog-local.json`은 Git에서 제외합니다. `sourceRoot`는 journal의 `blog` 폴더입니다. 동기화는 `90_Index/공개승인.json`에 명시된 `10_Published` 문서만 읽고 SHA-256을 확인합니다. 승인 목록 자체와 내부 출처는 복사하지 않습니다.

공개 이미지는 `assets/public`에서 승인된 문서가 참조하고 승인 해시가 일치하는 파일만 가져옵니다. 나머지 파일이나 비공개 폴더는 탐색하지 않습니다. 공개 폴더에 파일이 있어도 승인 목록에 없으면 복사하지 않습니다.

## 로컬 사용

아래 절차는 승인된 콘텐츠를 미리봅니다. 공개 콘텐츠와 모든 초안을 함께 확인하는 `npm run preview` 사용법은 로컬 전용 `PREVIEW.local.md`에 정리되어 있습니다. 해당 문서는 Git에서 제외됩니다.

```sh
nvm use
npm ci
./publish-blog.sh --dry-run
./publish-blog.sh
npx quartz build --serve
```

기본 실행은 동기화와 빌드까지만 수행합니다. `content`는 생성된 복사본이므로 원고 편집은 private blog의 공개 원본에서 합니다. 과거에 복사했지만 현재 승인 목록에서 빠진 파일은 다음 동기화 때 제거됩니다.

## 새 글과 관련 글

초안은 private `00_Drafts`에 `draft: true`로 작성합니다. 공개 전 회사정보·개인정보·내부 출처·품질·중복을 사람이 검토합니다. 승인된 공개용 사본의 frontmatter는 다음을 사용합니다.

```yaml
---
title: "제목"
date: 2026-09-12
tags: [backend]
draft: false
---
```

`featured: true`, `description`은 선택입니다. `projects`, `sources` 등 비공개 출처 속성은 공개본에 넣지 않습니다. 표준 Markdown을 우선 사용하며 wikilink 대상은 공개 루트 기준 경로입니다.

검토한 공개본과 그 글이 참조하는 공개 이미지는 다음 명령으로 승인 해시를 확인하고 등록합니다.

```sh
npm run approve -- --file Backend/글.md
npm run approve -- --file Backend/글.md --apply
```

```sh
node scripts/related-posts.mjs backend database
```

이 명령은 승인된 공개 글에서 태그가 겹치는 관련 글 링크 후보를 출력합니다. 본문에 적용하는 것은 별도 검토입니다. 주제별 내부 MOC는 `90_Index`에 유지합니다. 홈/공개 주제 목록 수정도 공개승인 해시를 갱신한 뒤 반영합니다.

## GitHub Pages

Public repository 이름은 `bibiana1202/bibiana1202.github.io`, 예정 URL은 `https://bibiana1202.github.io`로 선택했습니다. 아직 repository를 생성하거나 origin을 설정하지 않았습니다. 최초 공개 전에 전체 공개 파일을 확인하고 승인한 뒤 repository 생성과 main 브랜치의 GitHub Pages 배포를 진행합니다.

콘텐츠 승인부터 최초 Pages 설정, 이후 반복 발행과 되돌리기까지의 순서는 `DEPLOYMENT.md`를 따릅니다.

최초 사이트 구성 파일 커밋은 별도 검토합니다. 이후 `.blog-local.json`에 승인된 origin URL과 `publicPushApproved: true`를 설정한 경우에만 다음 명령을 사용할 수 있습니다.

```sh
./publish-blog.sh --push
```

정기 발행은 content만 stage/commit하며 journal의 Git history와 remote를 변경하지 않습니다. 이미 staged 변경이 있으면 중단합니다. GitHub Actions는 공개 content를 검증하고 Quartz를 빌드합니다.

## 검증

```sh
node --test scripts/sync-content.test.mjs
node scripts/validate-content.mjs
npx quartz build
```

승인 이후 변경, 비공개 링크, 심볼릭 링크, 미승인 자산, 동기화 삭제 범위를 검증합니다. 자동 검사는 회사정보의 의미까지 판단하지 못하므로 공개 승인 절차를 대신하지 않습니다.
