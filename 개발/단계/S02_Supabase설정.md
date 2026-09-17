# S2. Supabase 기본 설정 — 표·권한·사진 저장소

| 예상 | 난이도 | 앞 단계 |
|---|---|---|
| 60분 | ★★☆ | S1 |

**끝나면**: Supabase에 표 3개(profiles · missions · eco_products), 가입 시 프로필 자동 생성, 본인 것만 보이는 권한(RLS), 비공개 사진 저장소가 만들어지고, 같은 SQL이 저장소 `supabase/migrations/`에 남는다.

## 사람이 먼저 할 일

1. 받기 ([체크리스트 §2](../체크리스트.md#2-받기--매번-시작할-때))
2. Supabase 대시보드 **Authentication** 설정의 Email 항목에서 **Confirm email(이메일 확인)을 끈다**
   - 이유: 기본 메일 발송은 **프로젝트 팀원 주소에만, 시간당 2통**이라 켜 두면 시연 가입이 막힌다 ([공식 문서](https://supabase.com/docs/guides/auth/auth-smtp))
3. 대시보드 **SQL Editor**에서 아래 4줄을 실행하고 결과를 메모한다 (한글 검색이 되는지 확인)
   ```sql
   create extension if not exists pg_trgm with schema extensions;
   show lc_ctype;
   select extensions.show_trgm('아이시스');
   select extensions.similarity('아이시스 eco 500ml pet', '아이시스 eco 500ml');
   ```
   - 세 번째 결과가 `{}`(빈 배열)이면 **한글 검색 불가** → AI 지시의 `[한글 검사 결과]`에 "빈 배열"이라고 적는다
4. 명령 프롬프트, 저장소 폴더에서 아래를 실행한다. 질문이 나오면 그냥 Enter (= No)
   ```
   npx supabase init
   ```

## AI 지시

```text
[작업] Supabase DB 설정 SQL 파일을 만든다. (S2)

[먼저 읽기] AGENTS.md, 개발/연결명세.md 의 §1, §2 전체

[한글 검사 결과] (사람이 적기: show_trgm 결과가 빈 배열이었나? 예 / 아니오)

[만들 파일] supabase/migrations/20260917000001_init.sql 하나
이 SQL 하나를 대시보드 SQL Editor에서 실행하면 아래가 모두 만들어져야 한다. 다시 실행해도 가능한 한 오류가 나지 않게 쓴다 (if not exists, 정책은 drop policy if exists 후 create 등).
1. 명세 §2-1~§2-3의 표 3개 — 컬럼, 기본값, check, unique(user_id, image_hash) 포함
2. 가입하면 profiles 1행을 만드는 트리거 — 닉네임은 가입 메타데이터 nickname, 없으면 '새싹'. 점수 50, last_mission_at은 가입 시각
3. RLS — 명세 §2-5 표대로. profiles·missions는 본인 행 select만, eco_products는 로그인 사용자 select만. insert·update·delete 정책은 만들지 않는다
4. Storage — 비공개 버킷 mission-photos 생성. storage.objects 정책: 로그인 사용자는 경로의 첫 폴더 이름이 자기 uid인 곳에만 insert·select
5. 검색 — eco_products.search_name 인덱스와 함수 search_eco_products(q text, max_results int default 5). 반환 형태는 명세 §2-4, valid_to가 한국시간 오늘 이후인 것만.
   - 한글 검사 결과가 "아니오"(정상)이면 pg_trgm(extensions 스키마)의 similarity와 GIN 인덱스를 쓴다.
   - "예"(빈 배열)이면 pg_trgm 대신, 검색어를 공백으로 나눈 단어들로 ilike 후보를 모으고 similarity 칸에는 "검색어 단어 중 search_name에 들어 있는 비율(0~1)"을 넣는다.

[규칙] 한 파일로, 설명 주석은 한글. 다른 파일은 만들지 않는다. git 명령 실행 금지.

[끝나면] 사람이 SQL Editor에서 실행하는 방법과 확인 순서를 알려주고 멈춘다.
```

## AI가 끝난 뒤 사람이 할 일

- `supabase/migrations/20260917000001_init.sql` 내용을 **전부 복사**해 SQL Editor에 붙여넣고 **Run**
- 오류가 나면 오류 문장을 AI에게 붙여넣어 **파일을 고치게 한 뒤** 다시 복사·실행한다 (저장소 파일과 실제로 실행한 내용이 같아야 한다)

## 확인

- [ ] Table Editor에 `profiles`, `missions`, `eco_products`가 있다
- [ ] Authentication → Users → **Add user**(자동 확인 체크)로 테스트 사용자 생성 → `profiles`에 그 사용자 행이 생기고 `score` 50, `nickname` '새싹'
- [ ] Storage에 `mission-photos` 버킷이 있고 Public이 아니다
- [ ] SQL Editor에서 `select * from search_eco_products('아이시스', 5);` 가 **오류 없이** 실행된다 (아직 데이터가 없어 0행이 정상)
- [ ] 저장소 폴더에 `supabase/config.toml`과 `supabase/migrations/20260917000001_init.sql`이 있다

## 올리기

```
git status
git add supabase 개발/체크리스트.md
git commit -m "feat: S2 DB 권한 저장소 설정"
git pull --rebase
git push
```

## 막히면

- 사용자 만들 때 `Database error saving new user` → 트리거 SQL 문제. 오류와 SQL 파일을 AI에게 보여주고 고친 뒤 다시 실행
- `function similarity does not exist` → 함수 안에서 `extensions.similarity`처럼 스키마를 붙였는지 확인
- `npx supabase init`이 오래 걸리면 처음 한 번 CLI를 내려받는 중이니 기다린다
