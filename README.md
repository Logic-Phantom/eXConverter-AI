# eXConverter-AI — 설계서 화면 이미지 → eXBuilder6 `.clx` 자동 생성

> 이 문서 하나만 읽으면 프로젝트의 목적, 구조, 동작 원리, 수정 방법을 파악할 수 있도록 작성했다.
> 사람/AI 도구 모두 코드를 수정하기 전에 **§12 작업 규칙**을 먼저 확인할 것.

---

## 1. 목적과 핵심 원칙

사용자가 설계서 화면 이미지(PNG/JPG, 향후 PDF)를 업로드하면, **로컬 AI**가 화면 구조를 분석하고
**기존 eXBuilder6 템플릿(화면 뼈대)** 을 재사용해 eXBuilder6에서 바로 열 수 있는 `.clx` + `.js` 쌍을 만든다.

| 원칙 | 의미 |
|---|---|
| 완전 무료 / 사내망 | Ollama + Qwen3-VL 등 로컬 모델만 사용. OpenAI/Claude/Gemini 등 외부 API·외부 OCR 금지. 설계서 이미지는 외부로 나가지 않는다. |
| AI는 CLX를 직접 쓰지 않는다 | AI 출력은 **UI-IR(JSON)** 뿐이다. CLX XML은 Java 컴파일러(`ClxGenerator`)가 결정적으로 만든다. |
| 템플릿 = 뼈대 | `templates/` 의 CLX는 자주 쓰는 화면 패턴(헤더 UDC, 조회영역, 본문, 푸터, 스타일 클래스, 간격 규칙)을 제공한다. **내용물(필드/그리드 컬럼/버튼 수와 텍스트)은 이미지 분석 결과로 재구성**한다. |
| 재학습 없음 | 템플릿을 추가하면 자동으로 프로파일링되어 선택 후보가 된다. YOLO/파인튜닝 불필요. |
| 구조 정상 우선 | 시각적 정확도보다 "eXBuilder6에서 열리고 컴파일되는 CLX"를 먼저 보장한다. |

---

## 2. 현재 구현 상태

| Phase | 내용 | 상태 |
|---|---|---|
| 1 | CLX 템플릿 분석, UI-IR 스키마, UI-IR → CLX 컴파일러, 검증기 | **구현됨** |
| 2 | PNG/JPG → Ollama(Qwen3-VL) → UI-IR 자동 생성 | **구현됨** (PaddleOCR 연동은 외부 bridge 명령 슬롯만 있음) |
| 3 | 템플릿 저장소 다건 등록 + 구조 기반 자동 선택 | **구현됨** (`templates/` 77개 CLX) |
| 4 | PDF 지원 | 미구현 |
| 5 | eXBuilder6 런타임 렌더링 + Playwright 스크린샷 | 미구현 |
| 6 | OpenCV 이미지 Diff | 미구현 |
| 7 | Correction Engine (UI-IR 보정 → 재생성 루프, 최대 3~5회) | 미구현 |
| 8 | 이벤트/JS 자동 생성 | 미구현 (현재 `.js`는 템플릿 주석 헤더만 복사) |

---

## 3. 실제 기술 환경 (중요)

기획 문서에는 Spring Boot 3 / Java 21 이 적혀 있으나, **실제 프로젝트는 기존 eXBuilder6 웹 프로젝트 위에 구현**되어 있다.

- Java: PATH의 `javac` 는 **11** (Oracle JDK 11.0.24), Eclipse Tomcat 9.0.113 은 **Java 21** 로 실행됨 → 소스는 Java 11 문법만 사용할 것 (record, switch 식, text block 금지)
- Spring MVC **5.3.20** (Spring Boot 아님), 서블릿 `javax.servlet`
- 빌드: **Eclipse WTP** (Maven/Gradle 없음). 라이브러리는 `src/main/webapp/WEB-INF/lib/*.jar`
- JSON: `org.json` (`json-20210307.jar`)
- XML: JDK DOM (`javax.xml`)
- eXBuilder6 서버 런타임: `ci-lib/clx/cleopatra_server.jar`, 헤드리스 컴파일러: `ci-lib/clx/e6-compiler.jar`
- 로컬 AI: Ollama (`http://127.0.0.1:11434`) + `qwen3-vl:4b` (개발 PC 기준)
- Context root: `/eXCoverter-AI` (오타 아님, 기존 설정 그대로)

WTP 배포 매핑(`.settings/org.eclipse.wst.common.component`):

| 소스 | 배포 위치 |
|---|---|
| `src/main/java` | `WEB-INF/classes` |
| `src/main/resources` | `WEB-INF/classes` (프롬프트, 설정, 스키마) |
| `templates/` | `WEB-INF/classes/exconverter/templates` (외부 비공개) |
| `src/main/webapp` | `/` |

---

## 4. 폴더 구조

```
eXConverter-AI/
├── README.md                          ← 이 문서
├── templates/                         ← [읽기 전용] eXBuilder6 화면 패턴(뼈대) CLX + 쌍 JS
│   ├── P0_Inner Pattern/
│   ├── P1_Single Pattern/{버티컬,폼}/(popup/)   조회+그리드 / 조회+폼
│   ├── P2_Multi Pattern/(popup/)               그리드 여러 개
│   ├── P3_List Pattern/  P4_Master Detail Pattern/  P5_Tab Pattern/
│   ├── P6_Tree Pattern/  P7_Shuttle Pattern/     P8_Thirdparty Pattern/
│   └── (파일명 *_P.clx = 팝업용)
├── src/main/java/com/tomatosystem/
│   ├── exconverter/
│   │   ├── model/UiIr.java                     UI-IR 자바 모델
│   │   ├── service/
│   │   │   ├── ImageUiIrAnalyzer.java          이미지 → UI-IR (Ollama 스트리밍 / bridge / fallback)
│   │   │   ├── UiIrParser.java                 UI-IR JSON 파싱 + 이름 정규화
│   │   │   ├── UiIrNormalizer.java             소형 모델의 표 인식 오류 구조 보정 (행 분할 그리드 병합 등)
│   │   │   ├── ColumnNames.java                한글 라벨 ↔ 컬럼 코드 사전 (보정기/생성기 공용)
│   │   │   ├── TemplateCatalog.java            템플릿 프로파일링 + 점수 기반 선택
│   │   │   ├── ClxGenerator.java               UI-IR + 템플릿 → CLX (결정적 컴파일러)
│   │   │   ├── ClxValidator.java               생성 CLX 구조 검증
│   │   │   ├── CompanionJsGenerator.java       .clx 와 같은 이름의 .js 생성
│   │   │   ├── GenerationService.java          선택→생성→검증→저장 오케스트레이션
│   │   │   ├── ProjectRootResolver.java        Eclipse 워크스페이스에서 프로젝트 루트(clx-src) 탐색
│   │   │   ├── ExConverterConfig.java          설정 조회 (-D > 환경변수 > properties)
│   │   │   └── ProgressLog.java                Eclipse 콘솔 진행 로그
│   │   └── web/
│   │       ├── ImageConversionController.java  POST /EXConverter/uploadAndGenerate.do (이미지 업로드)
│   │       └── GenerationController.java       POST /api/exconverter/generate.do (UI-IR JSON 직접 입력)
│   ├── exbuilder/web/CleopatraUIController.java  *.clx 요청을 eXBuilder6 페이지로 렌더링 (기존)
│   └── web/IndexController.java                  /index.do (기존)
├── src/main/resources/exconverter/
│   ├── exconverter.properties          로컬 AI/경로 설정
│   ├── prompts/vision-ui-ir.txt        Qwen3-VL 프롬프트 (UI-IR 출력 형식 정의)
│   ├── ui-ir.schema.json               UI-IR JSON Schema
│   └── template-repository/P1-1/metadata.json   (초기 메타데이터 예시)
├── clx-src/                            eXBuilder6 소스 폴더
│   ├── convertTest.clx / .js           업로드 테스트 화면 (FileUpload + 전송 버튼)
│   ├── result/{yyyy-MM-dd}/            ← 생성 결과 .clx/.js 가 저장되는 곳
│   ├── udc/com/                        공통 UDC (udcComAppHeader, udcComGridTitle, udcComFormTitle …)
│   └── theme/                          LESS 테마
├── ci-lib/clx/                         e6-compiler.jar(헤드리스 컴파일러), cleopatra_server.jar, runtime
├── docs/
│   ├── exconverter-mvp.md              MVP API 메모
│   └── samples/*.ui-ir.json            테스트용 UI-IR (정답/실제 모델 출력/레거시/팝업 폼)
└── tools/harness/                      이클립스 빌드 대상 아님. 수동 테스트용 main 클래스
    ├── GenHarness.java                 UI-IR 파일 → CLX 생성 + 검증
    └── StreamHarness.java              가짜 Ollama 스트림으로 분석기 검증
```

실행 시 생성되는 폴더(작업 디렉터리 기준, Eclipse 실행 시 보통 `C:\eclipse_AI\eclipse\generated`):
- `generated/uploads/<uuid>.img` — 업로드 원본
- `generated/ui-ir/<원본파일명>.ui-ir.json` — AI가 반환한 원본 UI-IR (디버깅용)

---

## 5. 전체 동작 흐름

```
[eXBuilder6 화면 clx-src/convertTest.clx]
  FileUpload → subSend.setFileParameters(파일명, file) → POST ../EXConverter/uploadAndGenerate.do (multipart)
        │
        ▼
ImageConversionController
  1. 첫 번째 multipart 파일 수신 (필드명 = 원본 파일명, 20MB 제한) → generated/uploads 저장
        │
        ▼
ImageUiIrAnalyzer.analyze(image, originalName)
  2. ImageIO 로 디코드 가능 여부 확인
  3. 분석기 선택 (우선순위)
     a. exconverter.vision.command 설정 시: 외부 로컬 프로그램(예: PaddleOCR+VLM 스크립트) 실행, stdout = UI-IR JSON
     b. Ollama: exconverter.ollama.model, 비어 있으면 /api/tags 에서 vision 모델 자동 선택
        - 이미지를 긴 변 1280px 로 축소(PNG) → /api/generate (stream=true, think=false, format=json, temperature=0)
        - 스트림 줄(NDJSON)마다 response/thinking 누적, 15초마다 콘솔 진행 로그
        - qwen3-vl 은 think=false 여도 답을 "thinking" 필드로 보내는 경우가 있어 response 가 비면 thinking 사용
     c. AI 없음: placeholder UI-IR (analysisMode=structural-fallback, warnings 에 표시)
  4. UiIrParser.parse → UiIr (영역 타입/컴포넌트/에디터 이름 정규화, 반복 컬럼 접기)
     → UiIrNormalizer.normalize (표 구조 보정, 적용 내역은 warnings 에 "보정: ..." 으로 기록)
        │
        ▼
GenerationService.generate(ir, originalName, rawJson)
  5. TemplateCatalog.selectFor(ir)  — 템플릿 구조 프로파일 vs UI-IR 영역 비교 점수
  6. ClxGenerator.generate(template, ir)  — 뼈대 보존 + 내용 재구성
  7. ClxValidator.validate(clx)  — 오류 있으면 저장하지 않고 500
  8. clx-src/result/{yyyy-MM-dd}/<원본파일명>.clx + .js 저장, generated/ui-ir 에 원본 UI-IR 저장
        │
        ▼
응답 JSON (201)
  { id, templateId, analysisMode, image{width,height}, regions[요약], warnings[], saved{directory, clx, js} }
```

### Eclipse 콘솔 로그 예시

```
[eXConverter 17:47:45] ===== 설계서 → CLX 변환 시작: 스크린샷 2026-09-13 110550.png (75 KB) =====
[eXConverter 17:47:45] 이미지 확인: 스크린샷 2026-09-13 110550.png (1578x818)
[eXConverter 17:47:45] Ollama 비전 모델 자동 선택: qwen3-vl:4b
[eXConverter 17:47:46] AI 분석 시작: model=qwen3-vl:4b, 전송 이미지 1280x664 (CPU 위주 PC는 수 분~10분 이상 소요)
[eXConverter 17:48:01] AI 분석 중... 15s 경과 - 이미지/프롬프트 처리 단계 (아직 응답 토큰 없음)
...
[eXConverter 17:50:30] AI 첫 응답 토큰 수신 (164s) - UI-IR 생성 시작
[eXConverter 17:50:45] AI 분석 중... 179s 경과 - UI-IR 생성 단계 (58토큰, 보통 1,000~2,000토큰)
...
[eXConverter 17:57:10] AI 분석 완료: 564s, 입력 1635토큰, 출력 1425토큰, 종료사유=stop
[eXConverter 17:57:10] UI-IR 영역: title → description → sectionTitle → description → search(필드 2) → grid(컬럼 10) → grid(컬럼 4) → textarea
[eXConverter 17:57:10] 템플릿 선택: P4_Master Detail Pattern/Master Detail Pattern P4-6.clx (점수 140, search=true, grids=2, ...)
[eXConverter 17:57:10] CLX 생성/검증 완료 (21034 bytes)
[eXConverter 17:57:10] 저장 완료: C:\eclipse_AI\eXConverter-AI\clx-src\result\2026-09-13\스크린샷 2026-09-13 110550.clx / 스크린샷 2026-09-13 110550.js
[eXConverter 17:57:10] ===== 변환 완료: 총 565s, 분석모드=ollama:qwen3-vl:4b =====
```

"토큰 없음" 단계가 길어도 15초마다 로그가 계속 찍히면 정상이다. 로그가 멈추거나 `변환 실패`가 찍히면 §11 참고.

---

## 6. UI-IR (중간 표현) 계약

정의: `src/main/resources/exconverter/ui-ir.schema.json`, 모델: `UiIr.java`.
eXBuilder6에 종속되지 않는다. **영역(region)은 화면 위→아래 순서**로 나열한다.

```json
{
  "screen": { "name": "암호화 데이터 송수신", "type": "", "width": 1440, "height": 860, "sourceWidth": 1578 },
  "regions": [
    { "type": "title", "text": "타이틀을 입력하세요" },
    { "type": "description", "text": "첫 줄\n둘째 줄" },
    { "type": "sectionTitle", "text": "암호화 데이터 송수신" },
    { "type": "search", "fields": [ { "label": "성명", "component": "inputbox" }, { "label": "이메일", "component": "inputbox" } ], "buttons": ["초기화", "조회"] },
    { "type": "grid", "title": "", "columns": [
      { "header": "암호화 데이터 표시", "editor": "checkbox", "width": 118, "cellText": "" },
      { "header": "번호", "editor": "rowindex", "width": 60, "cellText": "#" },
      { "header": "성명", "editor": "output", "width": 90, "cellText": "FNM" },
      { "header": "계좌번호", "editor": "maskeditor", "width": 208, "cellText": "ACNO_____" }
    ] },
    { "type": "textarea", "buttons": ["복사"] },
    { "type": "buttons", "align": "right", "buttons": ["저장"] }
  ]
}
```

| region.type | 필드 | CLX 결과 |
|---|---|---|
| `title` | text | `udcComAppHeader` 의 `title` 속성 |
| `description` | text(`\n` 줄바꿈) | 줄마다 `cl:output` 을 가진 group |
| `sectionTitle` | text | `group.content-title-box` > `output.form-tit` |
| `search` | fields[], buttons[] | 템플릿 `grpSearch`(search-box) 내부 재구성 |
| `form` | title, columnsPerRow, fields[] | `group.content` > `group.form-base` |
| `grid` | title, columns[] | `group.content` > `udcComGridTitle` + `cl:grid` + `cl:dataset` |
| `tabs` | tabs[] | `cl:tabfolder.tab-filled` > `tabitem` |
| `tree` | - | `cl:tree` |
| `buttons` | buttons[], align | **마지막 영역이면** `content-footer` 버튼, 아니면 본문 버튼 그룹 |
| `textarea` | title, buttons[] | `group.content` > 제목/버튼 행 + `cl:textarea` |

- field.component: `inputbox, dateinput, daterange(시작~종료), combobox, searchinput, checkbox, radiobutton, numbereditor, maskeditor, textarea, output`
- column.editor: `output, checkbox, rowindex, inputbox, maskeditor, numbereditor, combobox, dateinput, button`
- column.width: **분석한 이미지 기준 px**. `screen.sourceWidth` 대비 1408px 로 환산한다.
- column.cellText: 디자인 모드 그리드는 데이터셀에 바인딩 컬럼명(FNM, EMAIL…)이 보인다. 대문자 식별자면 dataset 컬럼명으로 사용한다.
- `required` 필드는 라벨 클래스 `label required`.
- 레거시 형식도 허용: `columns: ["번호","성명"]`, `actions: ["reset","search"]`.

`UiIrParser` 정규화(소형 모델의 흔들림 흡수):
- 타입 별칭: `table/list→grid`, `filter/condition→search`, `footer/action→buttons`, `header→title` 등
- 컴포넌트 별칭: `date/calendar→dateinput`, `select/dropdown→combobox`, `spin/number→numbereditor`, `period/range→daterange`
- 헤더가 `번호/순번/No/#` 인 텍스트 컬럼 → `rowindex`
- 헤더 시퀀스가 주기적으로 반복되면(행 데이터를 컬럼으로 나열한 오류) 한 주기만 남김
- 코드펜스/앞뒤 잡음 제거, 빈 grid/search/buttons 영역은 버림

### 6.1 구조 보정 (`UiIrNormalizer`) — "AI는 의미, 규칙은 구조"

소형 비전 모델(qwen3-vl:4b)은 표를 자주 잘못 쪼갠다. 이미지만으로는 폼/그리드 구분이 애매하므로 프롬프트 개선과 별개로
파서 직후 결정적 규칙으로 되돌린다. 실제 실패 사례: `docs/samples/crypto-sample.qwen3-vl-4b-run2.ui-ir.json`.

| 규칙 | 감지 조건 | 보정 |
|---|---|---|
| 1. 행 분할 그리드 병합 | 연속 grid 들이 헤더를 2개 이상 공유하고 제목이 호환되며, 헤더만 있는 grid 또는 "헤더=셀값"인 행 값 컬럼이 있음 | 2개 이상 grid 에 등장한 헤더만 정식 컬럼으로 삼아 1개 grid 로 병합. 각 행 첫 값이 모두 숫자면 앞에 `rowindex` 컬럼 추가. 모든 행에서 같은 짧은 텍스트(예: 실행)면 `button` 컬럼 |
| 2. 헤더 행을 폼으로 읽은 경우 | form(또는 버튼 없는 search) 바로 뒤 grid 의 헤더 60% 이상이 셀값 모양(FNM, ACNO____, #, ----, 숫자)이고 라벨 수 ≥ 컬럼 수−1 | 라벨↔셀을 순서 보존 가중 LCS 로 정렬해 1개 grid 로 병합. 의미 일치(2점): `#`/숫자↔번호·순번(오타 1글자 허용), 마스크↔연락처/전화, 셀 코드↔`ColumnNames` 사전(성명→NM/FNM, 등록번호→BZNO/RRNO …). 호환(1점): 기타 코드 셀. 동률이면 앞 라벨을 빈 셀 컬럼으로 둔다(중복 오독 대응). `#` 앞의 첫 빈 라벨은 행 체크박스, `ACNO___` 형태는 maskeditor, 번호 오타는 "번호"로 교정 |
| 3. 무의미한 폭 제거 | 폭이 지정된 컬럼이 2개 이상이고 모두 같은 값 ≤ 40px | 폭 0(미지정) → 생성기가 헤더/셀 텍스트 길이로 추정 |
| 4. textarea 제목 중복 | textarea 제목이 직전 grid 제목/헤더와 같음 | 제목 제거 |
| 5. 입력값을 라벨로 읽은 경우 | search/form 에서 **앞 필드 값이 비어 있고** 현재 필드 값도 비어 있으며, 현재 "라벨"이 앞 필드의 값 모양일 때. 항상 값: 이메일, 전화번호(`010-1234-5678`), 날짜, 숫자, URL. 사람 이름: 앞 라벨이 성명/이름/성함/담당자/작성자/사용자명/고객명 등일 때만, 한글 3자(흔한 성씨 시작) 또는 4자(남궁·황보 등 복성)이고, 사전 단어나 라벨 접미어(…명, 번호, 여부, 구분, 권한, 사용자, 담당자 …)가 아닐 때 | 앞 필드의 value 로 옮기고 해당 필드 삭제 (예: `[성명, 김길동, 이메일]` → `[성명(값 김길동), 이메일]`). 2음절 이름은 `권한` 같은 라벨과 구분이 안 되어 보정하지 않음 |

정상 UI-IR(샘플 `crypto-sample.ui-ir.json` 등)에는 아무 보정도 적용되지 않음을 확인했다.
새 규칙을 추가할 때는 반드시 **실패한 실제 모델 출력**을 `docs/samples` 에 넣고, 정상 샘플에서 오탐이 없는지 함께 확인할 것.

---

## 7. 템플릿 저장소와 선택 규칙 (`TemplateCatalog`)

`templates/**/*.clx` 전체를 읽어 문자열 기반 **구조 프로파일**을 만든다(파일 수정시간 기준 캐시).

| 프로파일 항목 | 판별 방법 |
|---|---|
| search | `class="search-box"` 존재 |
| grids | `<cl:grid ` 개수 |
| forms | `class="form-base"` 개수 |
| tabs / tree | `<cl:tabfolder` / `<cl:tree ` |
| popup | 파일명 `*_P.clx` 또는 `pop-content-body` |
| shuttle | `shuttle-button-group` |
| footer | `footer-button-group` |

점수 = 100 + (search 일치 +40 / 불일치 −40) − |grid 수 차이|×25 − |form 수 차이|×20 − tabs/tree 불일치 60 − popup 불일치 80 − shuttle 50 + footer 일치 5.
동점이면 **파일 크기가 작은(단순한) 템플릿**, 그다음 경로 순. popup 여부는 `screen.type` 에 `POPUP` 포함 시.

템플릿 추가 방법: 표준 구조(`grpHeader/grpSearch/grpData/grpFooter`, 클래스 `content-header/search-box/content-body/content/content-footer/footer-button-group`)를 따르는 CLX를 `templates/` 하위에 넣으면 끝. 코드 수정/재학습 불필요.

템플릿 공통 규칙(77개 분석 결과): 버튼 클래스 `btn-primary-01/02`, `btn-secondary-01/02/03`, `btn-md`; 라벨 `output.label`, `label required`;
UDC `udcComAppHeader`(76), `udcComGridTitle`(86), `udcComFormTitle`(52); 조회 formlayout = [라벨 80px auto, 1fr]×3 + 버튼열 97px, 행 24px, 간격 6px.

---

## 8. CLX 생성 원리 (`ClxGenerator`)

**뼈대는 템플릿에서, 내용은 UI-IR에서.** XML을 처음부터 만들지 않고 템플릿 DOM을 수정한다.

1. 템플릿 파싱, 공백 텍스트 노드 제거(재들여쓰기용).
2. 뼈대 요소 탐색: `udcComAppHeader`, `grpHeader`(content-header/pop-content-header), `grpSearch`(search-box), `grpData`(content-body/pop-content-body), `grpFooter`(content-footer/pop-content-footer).
   id가 없으면 class로 찾는다(팝업 템플릿 대응).
3. 본문의 첫 "그리드를 포함한 `group.content`" 를 **프로토타입으로 복제 보관**(content-title-box 유무 등 템플릿별 그리드 영역 관례 유지).
4. 영역 배치 결정
   - `title` → 앱헤더 title
   - 첫 `search` → `grpSearch`
   - search 바로 위에 있는 영역이 모두 description/sectionTitle 이면 → `content-header` 안, search 앞 (verticallayout)
   - 마지막 영역이 `buttons` → 푸터
   - 나머지 → `content-body` (시각 순서 유지)
5. 템플릿의 자리표시 컨트롤 제거: search-box·content-body 의 자식 컨트롤, 푸터 버튼 그룹 좌/우의 버튼. 컨테이너와 레이아웃은 유지.
6. 남은 id/`std:sid` 수집 → 새 노드는 충돌 없이 생성
   - id: 템플릿 관례 접두어 + 순번 (`opt, ipb, dti, cmb, sipb, btn, grd, grp, txa, cbx, rdb, nbe, mse, tre, dsList, udccomgridtitle`)
   - sid: `output-xxxxxxxx`, `i-box-`, `f-data-`, `gh-cell-`, `gd-cell-` … + 랜덤 8hex
7. 조회영역: 필드를 행당 3쌍(`columnsPerRow` 로 변경 가능)으로 라벨/컨트롤 배치, 마지막 행 마지막 열에 `grpBtnSearch`(flowlayout right).
   조회/검색 버튼 `btn-primary-02`, 그 외 `btn-secondary-03 btn-md`. 버튼이 없으면 [초기화, 조회] 기본.
   높이 = 행×24 + (행−1)×6 + 20.
8. 본문: 영역마다 formlayout 행 1개 (grid/tabs/tree = 1fr, 나머지는 px). `content-body` 높이는 필요 높이만큼 늘림(grid 1개당 260px 가정).
9. 그리드
   - `gridcolumn` 폭 = width × (1408 / sourceWidth), 30~800px. 폭 없으면 editor/헤더 길이로 추정.
   - 헤더 `gridcell text`, 바인딩 컬럼은 `targetcolumnname`.
   - 디테일: 앞쪽(0~1열) 체크박스 → `columntype="checkbox"`(행 선택), `rowindex` → `columntype="rowindex"`, `button` → 셀 안 `cl:button`,
     그 외는 `columnname` + 셀 편집 컨트롤(inputbox/maskeditor/numbereditor/combobox/dateinput/checkbox), `output` 은 컨트롤 없이 텍스트.
   - dataset `dsListN` 을 `cl:model` 에 추가하고 `grid datasetid` 연결. 숫자에디터 컬럼은 `datatype="number"`.
   - 컬럼명: cellText가 대문자 식별자면 그대로 → 한글 사전(성명→NM, 이메일→EMAIL, 주민등록번호→RRNO …) → `COLn`. 중복 시 숫자 접미.
   - `udcComGridTitle` title = grid.title → 첫 그리드는 화면명 → `목록 N`.
10. 푸터: 마지막 buttons 영역을 우측 그룹(align=left면 좌측)에 배치. 저장/등록/확인 `btn-primary-01`, 삭제/취소 `btn-secondary-02`, 그 외 `btn-secondary-01`. 없으면 푸터 제거.
11. 직렬화: `<?xml version="1.0" encoding="UTF-8"?>` + 2칸 들여쓰기. (DOM 특성상 속성은 알파벳 순으로 출력되며 eXBuilder6는 문제없이 연다.)

UDC 속성 문법(컴파일러로 확인됨): `<cl:udc ...><cl:property name="title" type="string" value="..."/></cl:udc>` → 컴파일 결과 `udc.title = "..."`.
그리드 문법(컴파일러로 확인됨): `gridcell columntype="checkbox|rowindex"`, `columnname`, `targetcolumnname`, 셀 자식 컨트롤은 `bind("value").toDataColumn(columnname)` 으로 컴파일됨.

---

## 9. 검증

### 9.1 `ClxValidator` (저장 전 자동)
- XML well-formed, `screen`/`body` 존재
- 중복 `id`(cl 네임스페이스 컨트롤, property/datacolumn 제외), 중복 `std:sid`
- grid: gridcolumn ≥ 1, 헤더/디테일 셀 `colindex` < 컬럼 수, `datasetid` 가 실제 dataset/datamap 을 가리키는지
- formlayout: 형제 컨트롤의 `formdata row/col(+span)` 이 rows/columns 범위 안인지

### 9.2 eXBuilder6 헤드리스 컴파일러 (수동, 강력 권장)
프로젝트 구조(clx-src + .project + .settings)를 가진 폴더에 CLX를 넣고:
```
java -jar ci-lib/clx/e6-compiler.jar -s <프로젝트폴더> -o <출력폴더>
```
`BUILD SUCCESS` 와 생성된 `*.clx.js` 로 실제 해석 결과를 확인한다. UDC를 쓰므로 `clx-src/udc` 도 같이 복사해야 한다. (약 4초)

---

## 10. 설정 (`src/main/resources/exconverter/exconverter.properties`)

우선순위: JVM `-Dkey=value` > 환경변수(`.`→`_`, 대문자. 예 `EXCONVERTER_OLLAMA_MODEL`) > properties 파일.

| 키 | 기본값 | 설명 |
|---|---|---|
| `exconverter.ollama.model` | (빈값) | 비우면 설치된 vision 모델 자동 선택 |
| `exconverter.ollama.url` | `http://127.0.0.1:11434` | AI 서버 분리 시 사내 AI 서버 주소 |
| `exconverter.ollama.timeoutSeconds` | 1800 | 읽기 타임아웃 |
| `exconverter.ollama.numCtx` | 8192 | 컨텍스트 길이 (이미지 토큰 ~1,600 + 출력) |
| `exconverter.vision.maxImageSide` | 1280 | 모델에 보내는 이미지 긴 변. 작을수록 빠르지만 작은 글자 인식 저하 |
| `exconverter.vision.command` | (빈값) | 로컬 bridge 실행파일. 인자=이미지 경로, stdout=UI-IR JSON. 설정 시 Ollama보다 우선 |
| `exconverter.template.root` | (빈값) | 템플릿 루트 강제 지정. 없으면 `WEB-INF/classes/exconverter/templates` → `./templates` |
| `exconverter.generated.root` | `generated` | 업로드/UI-IR 저장 루트 |
| `exconverter.project.root` | (자동) | clx-src 를 가진 프로젝트 루트. 결과는 `clx-src/result/날짜` |
| `exconverter.clx.result.root` | (자동) | 결과 저장 루트 직접 지정 |

프롬프트 수정: `prompts/vision-ui-ir.txt`. **UI-IR 형식을 바꾸면 프롬프트·스키마·`UiIrParser`·`UiIr` 를 함께 바꿀 것.**

---

## 11. 소요 시간과 문제 해결

### 소요 시간 (실측, 개발 PC: i5-1135G7 / RAM 8GB / MX450 2GB)
- `qwen3-vl:4b` 가 VRAM에 다 안 올라가 **CPU 89% / GPU 11%** 로 실행됨
- 이미지 1장(1024~1280px): 입력 약 1,635토큰, 출력 약 1,400토큰, **약 9~11분**
  - 이 중 앞의 수 분은 이미지 인코딩(콘솔에 "아직 응답 토큰 없음"), 이후 토큰 생성
- 동시에 다른 무거운 작업(빌드, 다른 추론)이 있으면 더 느려진다. Ollama는 요청을 순차 처리하므로 연속 업로드는 대기열이 된다.
- CLX 선택/생성/검증/저장 자체는 1초 미만.
- eXBuilder6 Submission 기본 timeout 은 0(무제한)이라 클라이언트가 먼저 끊지 않는다.
- 단축 방법: GPU 서버(VRAM 8GB+)로 `exconverter.ollama.url` 분리, `maxImageSide` 1024, 더 작은/양자화 모델.

### 증상별 확인
| 증상 | 확인 |
|---|---|
| 콘솔에 아무것도 안 찍힘 | 최신 코드가 배포됐는지(Tomcat 재시작/Publish), 업로드 요청이 컨트롤러에 도착했는지 |
| `analysisMode=structural-fallback`, 항목 1/항목 2… | Ollama 미실행 또는 vision 모델 없음. `ollama ps`, `ollama list` |
| "아직 응답 토큰 없음" 이 15초마다 계속 | 정상(이미지 처리 중). `ollama ps` 로 모델 로드 확인 |
| `Ollama returned an empty response` | 모델 출력이 없음. `num_ctx`/`num_predict` 확인 |
| `Generated CLX is invalid: [...]` | ClxValidator 메시지 확인. 템플릿이 표준 구조를 벗어났는지 |
| 결과 파일 위치 | 응답 JSON `saved.clx`, 콘솔 `저장 완료:` 줄 |
| AI가 무엇을 인식했는지 | `generated/ui-ir/<파일명>.ui-ir.json`, 응답 `regions` |

### 알려진 인식 품질 한계 (qwen3-vl:4b)
같은 샘플에서 실측한 오류: 첫 번째 그리드를 `form` 으로 오인, 헤더 행과 데이터 행을 form+grid 로 분리(보정됨), 데이터 행마다 grid 를 따로 생성(보정됨),
예시 값(김길동)을 라벨로 인식(보정됨), 두 번째 그리드의 행을 컬럼으로 반복 나열(파서가 보정),
OCR 오타(CryptoJS→Cryptops, 번호→변호). 구조 파이프라인은 `docs/samples/crypto-sample.ui-ir.json`(정답 UI-IR)으로 이미지와 거의 동일한 CLX를 생성함을 확인했다.
정확도 개선 방향: PaddleOCR 로 텍스트/좌표를 뽑아 프롬프트에 사실로 제공(OCR=사실, VLM=구조), 8B 이상 모델, 영역별 크롭 분석.

---

## 12. 작업 규칙 (사람/AI 도구 공통)

1. **AI가 CLX XML을 생성하게 만들지 말 것.** AI 출력은 UI-IR, CLX는 `ClxGenerator` 가 만든다.
2. `templates/` 는 읽기 전용 원본이다. 생성 결과를 템플릿 폴더에 쓰지 말 것.
3. 외부 유료 API/외부 OCR 호출 코드를 추가하지 말 것. 네트워크 호출은 로컬/사내 Ollama 뿐.
4. Java 11 호환 유지, 새 jar 추가 시 `WEB-INF/lib` + `.classpath` 등록 필요(Maven 없음).
5. UI-IR 형식 변경 시 `UiIr.java` · `UiIrParser.java` · `ui-ir.schema.json` · `prompts/vision-ui-ir.txt` · `docs/samples` 를 함께 수정.
6. CLX 문법을 새로 쓰면(새 컨트롤/속성) **반드시 e6-compiler 로 컴파일해 생성 JS를 확인**할 것. 추측 금지.
7. 생성 로직 수정 후 최소 회귀: `docs/samples/*.ui-ir.json` 전부 × 모든 템플릿에 대해 `ClxValidator` 오류 0 + e6-compiler `BUILD SUCCESS`.
8. id/sid 는 반드시 `uniqueId/uniqueSid` 로 생성(중복 시 eXBuilder6 편집기 오류).
9. 긴 작업은 `ProgressLog.step` 으로 콘솔에 진행 상황을 남길 것.

---

## 13. 테스트 방법

### 13.1 화면에서 end-to-end
1. Ollama 실행 확인: `ollama list` 에 `qwen3-vl:4b` 등 vision 모델
2. Eclipse에서 Tomcat 실행 → `http://localhost:<port>/eXCoverter-AI/ui/convertTest.clx`
3. 설계서 이미지 추가 → 전송 → Eclipse 콘솔의 `[eXConverter ...]` 로그 확인
4. `clx-src/result/<오늘날짜>/` 의 CLX 를 eXBuilder6 에서 열기

### 13.2 UI-IR JSON 직접 입력 (AI 없이 생성기만)
```
POST /eXCoverter-AI/api/exconverter/generate.do
Content-Type: application/json
(body: docs/samples/crypto-sample.ui-ir.json)
```

### 13.3 명령줄 하니스 (서버 없이)
```powershell
$cp = ((Get-ChildItem src\main\webapp\WEB-INF\lib\*.jar).FullName) -join ';'
javac -encoding UTF-8 -d out -cp "$cp;ci-lib\clx\cleopatra_server.jar" (Get-ChildItem -Recurse src\main\java\com\tomatosystem -Filter *.java).FullName
javac -encoding UTF-8 -d out -cp "out;$cp" tools\harness\GenHarness.java
# 템플릿 자동 선택
java -cp "out;$cp;src\main\resources" GenHarness docs\samples\crypto-sample.ui-ir.json out\design.clx
# 템플릿 지정
java -cp "out;$cp;src\main\resources" GenHarness docs\samples\crypto-sample.ui-ir.json out\p11.clx "templates\P1_Single Pattern\버티컬\Single Pattern P1-1.clx"
```
# 전체 회귀: 모든 샘플 × 모든 템플릿 (한 JVM, 수 초)
java -cp "out;$cp;src\main\resources" GenHarness --all docs\samples templates out\all
```
`--all` 출력의 `failures=0` 을 확인하고, `out\all` 을 clx-src 로 가진 임시 프로젝트를 e6-compiler 로 컴파일해 `BUILD SUCCESS` 를 확인한다.

`StreamHarness <image> <ui-ir.json>` 는 18434 포트에 가짜 Ollama 를 띄워 스트리밍/진행 로그/thinking 필드 처리를 검증한다.

샘플(`docs/samples`):
- `crypto-sample.ui-ir.json` — 첨부 설계서의 정답 UI-IR
- `crypto-sample.qwen3-vl-4b.ui-ir.json` — 실제 모델 출력 1회차 (그리드를 폼으로 오인)
- `crypto-sample.qwen3-vl-4b-run2.ui-ir.json` — 실제 모델 출력 2회차 (이벤트 그리드가 행마다 5개로 분할, 헤더 행이 폼으로 분리) → 보정 후 그리드 2개
- `search-grid-legacy.ui-ir.json`, `popup-form-tabs.ui-ir.json` — 레거시 형식 / 팝업+폼+탭
- `value-as-label.ui-ir.json` — 규칙 5 검증: 조회영역은 김길동/메일/전화번호 3건 보정, 폼은 사용자·권한·담당자명·구분 등 모두 라벨 유지(오탐 없음)

검증 이력(2026-09-13): 샘플 6종 × 템플릿 77개 = 462건 ClxValidator 오류 0, e6-compiler BUILD SUCCESS.

---

## 14. 다음 단계 제안
1. PaddleOCR bridge (`exconverter.vision.command`): OCR 텍스트+bbox 를 VLM 프롬프트에 주입해 오타/라벨-값 혼동 제거
2. PDF → 페이지 이미지(PDFBox) → 기존 파이프라인
3. 생성 CLX 를 런타임(`/ui/result/...clx`)으로 열어 Playwright 스크린샷
4. OpenCV SSIM/영역 Diff → Correction Engine(UI-IR 폭/순서/영역 수정) → 재생성, 최대 3~5회
5. 비동기 작업 큐 + 진행률 조회 API (지금은 요청 스레드가 분석 완료까지 대기)
