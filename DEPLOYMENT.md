# GitHub Pages 운영 배포 가이드

이 프로젝트는 Quartz가 Markdown을 정적 사이트로 빌드하고, GitHub Actions가 결과물을 GitHub Pages에 배포합니다.

```text
journal/blog/10_Published
        ↓ 승인 목록과 해시 검증
dev-blog/content
        ↓ git push
GitHub Actions
        ↓ Quartz build
GitHub Pages
```

`journal` 전체를 복사하지 않습니다. `10_Published` 중 `90_Index/공개승인.json`에 파일명과 SHA-256이 등록된 파일만 `dev-blog/content`로 가져옵니다. `00_Drafts`, `80_Sources`, `90_Index`는 운영 저장소와 GitHub Pages에 포함되지 않습니다.

## 1. 글 작성과 로컬 미리보기

새 글은 `journal/blog/00_Drafts`에서 작성하며 frontmatter의 `draft`를 `true`로 유지합니다.

```yaml
---
title: "글 제목"
date: 2026-09-14
tags: [backend]
draft: true
---
```

블로그 전체를 로컬에서 확인합니다.

```bash
cd /path/to/dev-blog
nvm use
npm run preview
```

브라우저에서 `http://localhost:8080`을 엽니다. 이 미리보기에는 공개 콘텐츠와 모든 초안이 들어가지만 `.preview-local`에만 생성되며 Git에서 제외됩니다. 검토가 끝나면 Ctrl+C로 서버를 종료합니다.

## 2. 공개용 글 승인

초안 자체를 이동하지 않고 공개용 사본을 만듭니다.

1. 회사 내부 정보, 개인정보, 비공개 URL, 키와 토큰, 고객·환자 데이터가 없는지 확인합니다.
2. 중복 글과 사실관계, 프로젝트명·기간·수치·담당 범위를 확인합니다.
3. 공개용 사본을 내용에 맞는 `journal/blog/10_Published` 하위 폴더에 둡니다.
4. Portfolio 같은 고정 페이지는 `10_Published/portfolio.md`처럼 루트에 둘 수 있습니다.
5. 공개본 frontmatter는 최소 `title`, `date`, `tags`, `draft: false`를 사용합니다.
6. `관련 글`의 wikilink는 이미 승인된 공개 글만 가리키게 합니다.

공개본에 허용되는 frontmatter는 다음과 같습니다.

```yaml
---
title: "글 제목"
date: 2026-09-14
tags: [backend]
draft: false
description: "선택 항목"
featured: false
---
```

`projects`, `sources` 같은 내부 추적 속성과 journal 내부 경로는 공개본에서 제거합니다.

## 3. 공개 이미지 승인

사용할 이미지만 `journal/blog/assets/public` 아래에 복사합니다. 글에서는 이 공개용 이미지를 참조합니다.

현재 동기화 도구가 허용하는 형식은 다음과 같습니다.

```text
png, jpg, jpeg, webp, gif
```

SVG는 현재 공개 동기화에서 차단됩니다. 필요하면 PNG 또는 WebP로 변환하고 화면에 개인정보나 회사 내부 정보가 없는지 다시 확인합니다.

## 4. 공개 승인 목록 갱신

검토를 마친 공개본을 정확한 상대 경로로 지정합니다. 첫 번째 명령은 글과 그 글이 실제 참조하는 공개 이미지의 SHA-256을 계산해 보여주기만 합니다.

```bash
cd /path/to/dev-blog
nvm use
npm run approve -- --file portfolio.md
```

표시된 파일과 이미지가 모두 공개 대상인지 확인한 뒤 `--apply`를 붙입니다.

```bash
npm run approve -- --file portfolio.md --apply
```

카테고리 글은 `10_Published` 기준 상대 경로를 사용합니다.

```bash
npm run approve -- --file Backend/2026-09-14_글-제목.md
npm run approve -- --file Backend/2026-09-14_글-제목.md --apply
```

여러 글을 함께 처리할 때는 `--file`을 반복합니다.

```bash
npm run approve -- \
  --file Backend/첫-번째.md \
  --file Database/두-번째.md \
  --apply
```

이 도구는 `10_Published` 밖의 파일, 심볼릭 링크, 허용되지 않은 frontmatter와 이미지 형식, `assets/public` 밖의 이미지를 거부합니다. 글에서 참조하지 않는 이미지는 자동 승인하지 않습니다.

내용을 한 글자라도 수정하면 해시가 달라지므로 다시 검토하고 같은 명령을 실행해야 합니다. `--apply`는 공개 승인 의사를 기록하는 작업이며 내용 검토를 대신하지 않습니다.

## 5. 배포 전 로컬 검증

먼저 실제 복사 없이 변경 예정 목록을 확인합니다.

```bash
cd /path/to/dev-blog
nvm use
./publish-blog.sh --dry-run
```

목록이 맞으면 승인된 콘텐츠를 동기화하고 Quartz를 빌드합니다.

```bash
./publish-blog.sh
```

이 명령은 다음 작업까지만 수행합니다.

```text
승인 해시 검증 → content 동기화 → 공개 링크 검사 → Quartz build
```

Git commit이나 push는 하지 않습니다. 빌드가 끝나면 공개될 변경을 확인합니다.

```bash
git status --short
git diff -- content
```

## 6. 최초 GitHub Pages 설정

이 과정은 public repository 이름과 공개 URL, 전체 공개 파일을 최종 확인한 뒤 한 번만 진행합니다. Repository를 만들기 직전에 이름 후보 3개를 비교하고 하나를 확정합니다.

1. GitHub에 비어 있는 public repository를 생성합니다.
2. 대표 사이트라면 repository 이름을 `bibiana1202.github.io`로 사용합니다.
3. 별도 프로젝트 사이트라면 `dev-blog` 같은 이름을 사용할 수 있습니다.
4. GitHub repository의 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택합니다.
5. 선택한 URL에 맞게 `quartz.config.ts`의 `baseUrl`을 설정합니다.

대표 사이트 예시:

```ts
baseUrl: "bibiana1202.github.io"
```

프로젝트 사이트 예시:

```ts
baseUrl: "bibiana1202.github.io/dev-blog"
```

6. 로컬 repository에 승인된 GitHub remote를 `origin`으로 연결합니다. 기존 Quartz 원본을 가리키는 `upstream`은 유지합니다.
7. Git에서 제외되는 `.blog-local.json`에 승인된 remote URL과 push 승인 상태를 기록합니다.

```json
{
  "sourceRoot": "로컬 journal/blog 절대 경로",
  "publishRemote": "승인한 public repository URL",
  "publicPushApproved": true
}
```

8. 첫 push에는 Quartz 설정, 배포 workflow, 검증 스크립트와 승인된 `content`가 모두 필요하므로 전체 변경 파일을 다시 확인합니다.
9. 확인이 끝난 파일만 첫 구성 커밋에 포함하고 `main`을 push합니다.
10. GitHub의 **Actions** 탭에서 `Deploy development blog` workflow가 성공했는지 확인합니다.
11. Pages URL에서 홈, Portfolio, 카테고리, 검색, 태그, backlinks와 graph view를 확인합니다.

현재 `.github/workflows/deploy.yml`은 push된 public repository만 읽습니다. private journal 경로나 초안에는 접근할 수 없습니다.

## 7. 이후 글 발행

최초 설정과 push 승인이 끝난 뒤에는 다음 순서로 반복합니다.

```bash
cd /path/to/dev-blog
nvm use

./publish-blog.sh --dry-run
./publish-blog.sh
git diff -- content
./publish-blog.sh --push
```

`--push`는 다음 조건을 모두 확인한 후 동작합니다.

- `.blog-local.json`에 실제 push 승인이 기록되어 있음
- 현재 `origin`이 승인된 public repository와 일치함
- 현재 브랜치가 `main`임
- 이미 stage된 다른 변경이 없음

조건을 통과하면 `content`만 stage하고 `Publish approved blog content`라는 커밋을 만든 뒤 `origin/main`에 push합니다. GitHub Actions가 자동으로 검증, Quartz 빌드, Pages 배포를 진행합니다.

Quartz 설정, 레이아웃, workflow 또는 스크립트 변경은 `--push`가 자동으로 포함하지 않습니다. 이런 변경은 별도 검토와 별도 커밋으로 관리합니다.

## 8. 배포 확인과 되돌리기

배포 후 GitHub Actions가 성공했는지 확인하고 실제 URL에서 변경된 페이지와 링크, 이미지를 확인합니다. 캐시 때문에 이전 화면이 보이면 강력 새로고침 후 다시 확인합니다.

문제가 있으면 source of truth인 `journal/blog/10_Published`의 공개본을 이전 내용으로 복구하고, 해당 파일의 승인 해시를 다시 등록한 뒤 동일한 발행 절차를 실행합니다. 이미 공개된 민감정보는 Git 기록에도 남을 수 있으므로 단순 수정으로 끝내지 말고 저장소 기록 정리까지 별도로 대응해야 합니다.

## 현재 상태

- 선택한 public repository: `bibiana1202/bibiana1202.github.io` (생성 전)
- 예정 공개 URL: `https://bibiana1202.github.io`
- `origin`: 연결하지 않음
- 실제 public push 승인: 꺼짐
- `quartz.config.ts`의 `baseUrl`: `bibiana1202.github.io`
- 공개 승인 콘텐츠: 홈과 카테고리 안내 문서 6개
- Portfolio: `00_Drafts`에 있으며 아직 운영 배포 대상이 아님

따라서 현재 `npm run preview`와 `./publish-blog.sh`는 로컬 확인용이고, `./publish-blog.sh --push`는 안전장치에 의해 차단됩니다.

## 참고 문서

- [GitHub Pages 사이트 만들기](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [GitHub Pages 배포 소스 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub Pages custom workflow 사용](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- Quartz 프로젝트 내부 `docs/hosting.md`
