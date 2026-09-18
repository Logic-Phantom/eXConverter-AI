# eXConverter-AI — 설계서 화면 이미지 → eXBuilder6 `.clx` 자동 생성

> 이 문서 하나만 읽으면 프로젝트의 목적, 구조, 동작 원리, 수정 방법을 파악할 수 있도록 작성했다.
> 사람/AI 도구 모두 코드를 수정하기 전에 **§12 작업 규칙**을 먼저 확인할 것.

---

## 1. 목적과 핵심 원칙

사용자가 설계서 화면 이미지(PNG/JPG, 향후 PDF)를 업로드하면, **로컬 AI**가 화면 구조를 분석하고
**기존 eXBuilder6 템플릿(화면 뼈대)** 을 재사용해 eXBuilder6에서 바로 열 수 있는 `.clx` + `.js` 쌍을 만든다.

| 원칙 | 의미 |
|---|---|
| 기본은 무료 / 사내망 | 기본 엔드포인트는 Ollama + Qwen3-VL 등 로컬 모델만 사용하며 설계서 이미지가 외부로 나가지 않는다. **속도가 필요할 때만** 별도 엔드포인트(`/EXConverter/gemini/...`)로 Google Gemini API를 호출한다(§15). 이 경로는 이미지가 Google로 전송되고, 무료 등급은 Google이 입력을 제품 개선에 사용한다. |
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
| 9 | Gemini API 엔진 (PNG/JPG → Gemini → UI-IR, 별도 엔드포인트) | **구현됨** (2026-09-17, 가짜 API로 검증. 실제 호출은 API 키 설정 후 — §15) |

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
- 외부 AI(선택): Google Gemini `https://generativelanguage.googleapis.com/v1beta`, 기본 모델 `gemini-3.5-flash` (§15). SDK 없이 `HttpURLConnection` 사용
- Tomcat 포트 8080. **실제 배포 컨텍스트는 루트 `/`** 이므로 절대 URL에 `/eXCoverter-AI` 접두어를 붙이면 404다.
  프로젝트 설정(`.settings/org.eclipse.wst.common.component`)의 `context-root=eXCoverter-AI` 와 별개로,
  Eclipse 서버 설정(`C:\eclipse_AI\workspace\Servers\Tomcat v9.0 Server at localhost-config\server.xml`)이
  `<Context docBase="eXCoverter-AI" path="/" .../>` 로 덮어쓰고 있다(2026-09-17 확인).
  → 기본 URL `http://localhost:8080`, 화면은 `http://localhost:8080/ui/convertTest.clx`
  클라이언트 CLX 의 Submission 은 상대경로(`../EXConverter/...`)를 쓰므로 컨텍스트가 무엇이든 동작한다.
  Eclipse 의 Servers 뷰 → 서버 더블클릭 → Modules 탭에서 Path 를 `/eXCoverter-AI` 로 바꾸면 접두어가 붙는 방식으로 되돌릴 수 있다.
- Eclipse Tomcat 실행 설정은 `C:\eclipse_AI\workspace\.metadata\.plugins\org.eclipse.debug.core\.launches\Tomcat v9.0 Server at localhost.launch`. VM arguments 에 현재 `-Djava.library.path` 만 있으므로 `-Dexconverter.*` 는 여기에 추가한다

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
│   │   │   ├── GeminiUiIrAnalyzer.java         이미지 → UI-IR (Gemini API, SSE + responseSchema) — §15
│   │   │   ├── GeminiLiteUiIrAnalyzer.java     같은 분석기를 gemini-3.5-flash-lite 모델로 호출 — §15.8
│   │   │   ├── UiIrParser.java                 UI-IR JSON 파싱 + 이름 정규화
│   │   │   ├── UiIrNormalizer.java             소형 모델의 표 인식 오류 구조 보정 (행 분할 그리드 병합 등)
│   │   │   ├── ColumnNames.java                한글 라벨 ↔ 컬럼 코드 사전 (보정기/생성기 공용)
│   │   │   ├── TemplateCatalog.java            템플릿 프로파일링 + 점수 기반 선택
│   │   │   ├── LayoutShape.java                본문 레이아웃 블록열(G/F/T/DIV/TAB …) + 편집거리 — §7
│   │   │   ├── ClxGenerator.java               UI-IR + 템플릿 → CLX (결정적 컴파일러)
│   │   │   ├── ClxValidator.java               생성 CLX 구조 검증
│   │   │   ├── CompanionJsGenerator.java       .clx 와 같은 이름의 .js 생성
│   │   │   ├── GenerationService.java          선택→생성→검증→저장 오케스트레이션
│   │   │   ├── ProjectRootResolver.java        Eclipse 워크스페이스에서 프로젝트 루트(clx-src) 탐색
│   │   │   ├── ExConverterConfig.java          설정 조회 (-D > 환경변수 > properties)
│   │   │   └── ProgressLog.java                Eclipse 콘솔 진행 로그
│   │   └── web/
│   │       ├── ImageConversionController.java  POST /EXConverter/uploadAndGenerate.do (이미지 업로드, 로컬 AI)
│   │       ├── GeminiConversionController.java POST /EXConverter/gemini/uploadAndGenerate.do (Gemini)
│   │       ├── GeminiLiteConversionController.java POST /EXConverter/gemini-lite/uploadAndGenerate.do (Gemini Flash-Lite)
│   │       └── GenerationController.java       POST /api/exconverter/generate.do (UI-IR JSON 직접 입력)
│   ├── exbuilder/web/CleopatraUIController.java  *.clx 요청을 eXBuilder6 페이지로 렌더링 (기존)
│   └── web/IndexController.java                  /index.do (기존)
├── src/main/resources/exconverter/
│   ├── exconverter.properties          로컬 AI/경로 설정
│   ├── prompts/vision-ui-ir.txt        Qwen3-VL 프롬프트 (UI-IR 출력 형식 정의)
│   ├── prompts/gemini-vision-ui-ir.txt Gemini 시스템 프롬프트 (형식은 responseSchema 가 고정, 판독 규칙 중심)
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
    ├── StreamHarness.java              가짜 Ollama 스트림으로 분석기 검증
    ├── GeminiHarness.java              이미지 → 실제 Gemini API → CLX (서버 없이, API 키 필요)
    ├── GeminiStreamHarness.java        가짜 Gemini API(SSE)로 Gemini 분석기 오프라인 검증 (--lite: lite 모델)
    └── TemplateMatchHarness.java       템플릿 77개 역분석 → 자동 선택 정확도 + 생성 재현도 측정 — §7
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
| `buttons` | buttons[], align(left/right/center) | **마지막 영역이면** `content-footer` 버튼, 아니면 본문 버튼 그룹. center 는 1fr 좌우 여백 formlayout(P7-3 과 같은 방식) |

`inTab`(boolean): 바로 앞 `tabs` 영역의 선택된 탭 패널 **안에** 그려진 영역. `paging`(boolean, grid): 표 아래 페이지 번호 막대(pageindexer).
좌우 분할 사이(가운데 열)의 ◀▶ 버튼은 `side` 없는 `buttons` 영역으로, 좌측 영역들과 우측 영역들 사이에 나열한다(P7 셔틀). 같은 칸 안 그리드 사이의 ▲▼ 는 그 칸의 `side` 를 가진다.

모든 영역 공통 `side`(`left`/`right`, 생략 = 전체 폭): 본문이 좌/우 2단으로 나뉜 화면. 첫 `side` 영역부터 마지막 `side` 영역까지가 `division-group` 1행(좌/우 pane)이 되고, 그 사이의 `side` 없는 영역은 바로 위 영역의 pane 에 붙는다. 모델에는 좌측 영역을 모두 나열한 뒤 우측을 나열하도록 요구한다.

버튼 캡션 `▲ ▼ ◀ ▶` 은 테마 아이콘 버튼 `btn-up/btn-down/btn-left/btn-right`(20×24, 캡션 없음)로 생성한다.
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
- 최상위 `regions` 가 없으면 `screen.regions` 를 사용 (gemini-3.5-flash-lite 가 regions 를 screen 안에 넣음, 2026-09-18)

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
| 6. 섹션 제목 중복 | sectionTitle 바로 뒤 grid/form/textarea 의 제목이 비었거나 같은 글자(공백 무시) | sectionTitle 을 그 영역 제목으로 흡수. 그대로 두면 `form-tit` + `udcComGridTitle` 로 제목이 두 번 나온다 |
| 7. 그리드 제목의 건수 | grid 제목 끝이 `총 N건`, `[총건수 N건]` 등 | 제거. `udcComGridTitle` 이 `총건수 N건` 을 스스로 그린다 |

규칙 1·2 는 `side` 가 다른 영역끼리는 병합하지 않으며, 병합 결과는 원래 `side` 를 유지한다.

정상 UI-IR(샘플 `crypto-sample.ui-ir.json` 등)에는 아무 보정도 적용되지 않음을 확인했다.
새 규칙을 추가할 때는 반드시 **실패한 실제 모델 출력**을 `docs/samples` 에 넣고, 정상 샘플에서 오탐이 없는지 함께 확인할 것.

---

## 7. 템플릿 저장소와 선택 규칙 (`TemplateCatalog`)

`templates/**/*.clx` 전체를 DOM 으로 읽어 **구조 프로파일**을 만든다(파일 수정시간 기준 캐시). `content-body`/`pop-content-body` 가 없는 템플릿(P0)은 생성기가 본문을 넣을 곳이 없으므로 후보에서 제외한다.

핵심은 **본문 레이아웃 블록열**(`LayoutShape`)이다. 개수가 아니라 순서와 배치를 비교한다. 이미지 쪽은 UI-IR 에서, 템플릿 쪽은 `content-body` DOM 에서 같은 기호로 만든다.

| 블록 | 의미 |
|---|---|
| `G` / `F` / `T` | 그리드 / 폼 / 트리. `b` = 제목행 버튼, `p` = 페이지 인덱서 (예: `Gb`, `Gp`) |
| `A` / `S` / `X` | textarea / 본문 안의 조회영역(P2-3) / 화살표(셔틀) 버튼 |
| `TAB{…}` | 탭 + 선택된 탭 안의 내용(UI-IR 의 `inTab` 영역) |
| `DIV{좌 \| 우}`, `DIV{좌 \| X \| 우}` | 좌우 분할(UI-IR 의 `side`), 가운데 ◀▶ 셔틀 열 |
| `ACC{…}` / `EXT` | 아코디언 / 서드파티 컨트롤 — UI-IR 로 표현 불가 |

예: P4-4 = `F G`, P4-5 = `G F`, P3-2 = `DIV{G | Fb}`, P4-3 = `DIV{F | G}`, P6-1 = `DIV{T | G}`, P7-1 = `DIV{G | X | G}`, P2-3 = `G S G`, P1-4 = `Gp`, P5-1 = `TAB{G}`.

점수 = 100 + 헤더 조회영역(일치 +40 / 불일치 −40) − popup 불일치 80 + footer 일치 5 − **블록열 편집거리** − tabs/tree 유무 불일치 60 − 셔틀 열 유무 불일치 40.
편집거리: 블록 삽입·삭제·교체 20, 같은 컨트롤의 플래그(`b`/`p`) 차이 5, `DIV`/`TAB` 은 **중첩 블록**이라 칸 내용끼리만 비교한다(우측 칸의 그리드가 분할 영역 밖 그리드와 짝지어지지 않음). 분할 비율(1:1, 2:5, 250px:1)은 선택된 템플릿 것을 그대로 쓴다.
동점이면 **파일 크기가 작은(단순한) 템플릿**, 그다음 경로 순. popup 여부는 `screen.type` 에 `POPUP` 포함 시.

측정(`TemplateMatchHarness`, §13.3): 각 템플릿에서 "그 화면을 완벽히 분석했을 때의 UI-IR"을 역으로 만들어 ① 자동 선택이 같은 구조의 템플릿을 고르는지 ② 그 템플릿으로 생성한 CLX 가 같은 구조를 재현하는지 검사한다. 2026-09-18 개선 전 선택 36/68 · 재현 43/68 → 개선 후 **67/67 · 67/67** (P0 1개, 아코디언 P3-4, 서드파티 P8 8개 = 10개는 UI-IR 로 표현 불가라 제외).

템플릿 추가 방법: 표준 구조(`grpHeader/grpSearch/grpData/grpFooter`, 클래스 `content-header/search-box/content-body/content/content-footer/footer-button-group`)를 따르는 CLX를 `templates/` 하위에 넣으면 끝. 코드 수정/재학습 불필요.

템플릿 공통 규칙(77개 분석 결과): 버튼 클래스 `btn-primary-01/02`, `btn-secondary-01/02/03`, `btn-md`; 라벨 `output.label`, `label required`;
UDC `udcComAppHeader`(76), `udcComGridTitle`(86), `udcComFormTitle`(52); 조회 formlayout = [라벨 80px auto, 1fr]×3 + 버튼열 97px, 행 24px, 간격 6px.

---

## 8. CLX 생성 원리 (`ClxGenerator`)

**뼈대는 템플릿에서, 내용은 UI-IR에서.** XML을 처음부터 만들지 않고 템플릿 DOM을 수정한다.

1. 템플릿 파싱, 공백 텍스트 노드 제거(재들여쓰기용).
2. 뼈대 요소 탐색: `udcComAppHeader`, `grpHeader`(content-header/pop-content-header), `grpSearch`(search-box), `grpData`(content-body/pop-content-body), `grpFooter`(content-footer/pop-content-footer).
   id가 없으면 class로 찾는다(팝업 템플릿 대응).
3. 본문의 구성 요소를 **프로토타입으로 모두 복제 보관**: 그리드를 가진 `group.content` 전부, `form-base` 를 가진 content 전부, 트리 content, 본문 안 `search-box`(P2-3), `division-group` 전부.
   영역마다 제목행 버튼 유무(그리드는 페이지 인덱서 유무도)가 맞는 프로토타입을 고른다. 폼은 템플릿의 `udcComFormTitle`(또는 `form-tit`) 제목행과 제목행 버튼, 폼 열 수(좁은 칸은 2쌍)를 따르고, 제목·버튼이 모두 없으면 제목행을 행째 제거한다.
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
   `side` 영역 구간은 템플릿 `division-group` 중 열 수가 같은 것(2열, ◀▶ 셔틀이 있으면 3열)을 복제해 1행을 차지한다(없으면 1:1 또는 1fr/24px/1fr 로 새로 생성). 각 pane 은 영역이 1개면 그대로, 여러 개면 세로 formlayout group 으로 쌓는다. 높이는 pane 중 큰 쪽.
   `tabs` 영역 뒤의 `inTab` 영역들은 첫(선택된) 탭 안에 쌓는다(P5).
   그리드/폼/트리 제목행의 `title-button-group` 자리표시 버튼(행추가/행삭제)은 지우고 해당 영역의 `buttons` 로 채운다.
   `paging` 그리드는 `cl:pageindexer` 행을 유지·추가하고(P1-4 와 같은 `pix1`), 아니면 제거한다. 화살표만 있는 버튼 행은 `shuttle-button-group` 클래스를 붙인다.
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

Gemini 엔진 설정(`exconverter.gemini.*`)은 §15.3 참고.

프롬프트 수정: `prompts/vision-ui-ir.txt`(Ollama), `prompts/gemini-vision-ui-ir.txt`(Gemini).
**UI-IR 형식을 바꾸면 프롬프트 2개·`ui-ir.schema.json`·`GeminiUiIrAnalyzer.uiIrResponseSchema()`·`UiIrParser`·`UiIr` 를 함께 바꿀 것.**

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
3. 기본 엔드포인트(`/EXConverter/uploadAndGenerate.do`)와 `ImageUiIrAnalyzer` 에는 외부 API/외부 OCR 호출을 넣지 말 것. 외부 호출은 **Gemini 전용 클래스(`GeminiUiIrAnalyzer`/`GeminiConversionController`)에만** 둔다. 두 경로는 서로를 수정하지 않는다.
4. Java 11 호환 유지, 새 jar 추가 시 `WEB-INF/lib` + `.classpath` 등록 필요(Maven 없음).
5. UI-IR 형식 변경 시 `UiIr.java` · `UiIrParser.java` · `ui-ir.schema.json` · `prompts/vision-ui-ir.txt` · `docs/samples` 를 함께 수정.
6. CLX 문법을 새로 쓰면(새 컨트롤/속성) **반드시 e6-compiler 로 컴파일해 생성 JS를 확인**할 것. 추측 금지.
7. 생성 로직 수정 후 최소 회귀: `docs/samples/*.ui-ir.json` 전부 × 모든 템플릿에 대해 `ClxValidator` 오류 0 + e6-compiler `BUILD SUCCESS`. 선택 규칙·생성기·UI-IR 을 바꾸면 `TemplateMatchHarness` 의 selection/roundtrip 이 떨어지지 않았는지도 확인한다.
8. id/sid 는 반드시 `uniqueId/uniqueSid` 로 생성(중복 시 eXBuilder6 편집기 오류).
9. 긴 작업은 `ProgressLog.step` 으로 콘솔에 진행 상황을 남길 것.

---

## 13. 테스트 방법

### 13.1 화면에서 end-to-end
1. Ollama 실행 확인: `ollama list` 에 `qwen3-vl:4b` 등 vision 모델
2. Eclipse에서 Tomcat 실행 → `http://localhost:<port>/eXCoverter-AI/ui/convertTest.clx`
3. 설계서 이미지 추가 → 전송 → Eclipse 콘솔의 `[eXConverter ...]` 로그 확인
4. `clx-src/result/<오늘날짜>/` 의 CLX 를 eXBuilder6 에서 열기

Gemini 엔진으로 같은 테스트를 하려면 §15.4 의 키 설정 후 Submission `action` 만 `../EXConverter/gemini/uploadAndGenerate.do` 로 바꾼다.

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

템플릿 매칭 측정(§7):
```powershell
javac -encoding UTF-8 -d out -cp "out;$cp" tools\harness\TemplateMatchHarness.java
java -cp "out;$cp;src\main\resources" TemplateMatchHarness templates          # 요약 + 실패 상세
java -cp "out;$cp;src\main\resources" TemplateMatchHarness templates -v -o out\rt   # 템플릿별 결과, 재현 CLX 를 out\rt 에 저장(e6-compiler 용)
```
마지막 줄 `selection=67/67 roundtrip=67/67` 을 확인한다. 새 템플릿을 추가하면 분모가 늘고, 그 템플릿이 틀리면 `MISS` 로 원하는/실제 구조 키가 출력된다.

샘플(`docs/samples`):
- `crypto-sample.ui-ir.json` — 첨부 설계서의 정답 UI-IR
- `crypto-sample.qwen3-vl-4b.ui-ir.json` — 실제 모델 출력 1회차 (그리드를 폼으로 오인)
- `crypto-sample.qwen3-vl-4b-run2.ui-ir.json` — 실제 모델 출력 2회차 (이벤트 그리드가 행마다 5개로 분할, 헤더 행이 폼으로 분리) → 보정 후 그리드 2개
- `search-grid-legacy.ui-ir.json`, `popup-form-tabs.ui-ir.json` — 레거시 형식 / 팝업+폼+탭
- `user-role.gemini-3.5-flash-lite.ui-ir.json` — 실제 gemini-3.5-flash-lite 출력. `regions` 가 `screen` 안에 중첩됨(파서가 보정), 버튼이 `{text,type}` 객체, 그리드 제목에 `총 0건`(규칙 7)
- `user-role.ui-ir.json` — 같은 화면(`스크린샷 2026-09-17 175014.png`, 좌 1그리드 / 우 2그리드 + ▲▼)의 정답 UI-IR. `side` 사용 → P2-4 선택
- `value-as-label.ui-ir.json` — 규칙 5 검증: 조회영역은 김길동/메일/전화번호 3건 보정, 폼은 사용자·권한·담당자명·구분 등 모두 라벨 유지(오탐 없음)

검증 이력(2026-09-13): 샘플 6종 × 템플릿 77개 = 462건 ClxValidator 오류 0, e6-compiler BUILD SUCCESS.
검증 이력(2026-09-18, 좌우 분할 추가): 샘플 8종 × 템플릿 77개 = 616건 ClxValidator 오류 0, e6-compiler BUILD SUCCESS(616개 JS). 기존 샘플 6종의 자동 선택 템플릿은 변경 전과 동일, 정답 샘플에 새 보정 규칙 오탐 없음.
검증 이력(2026-09-18, 블록열 매칭·템플릿 구성요소 재사용): `TemplateMatchHarness` 선택 67/67, 재현 67/67. 샘플 8종 × 77 = 616건 오류 0. 재현 67 + 샘플 616 = 683개 CLX 모두 e6-compiler BUILD SUCCESS. 샘플별 자동 선택은 `popup-form-tabs` 만 P1-7_P → P5-2_P(탭 템플릿)로 바뀌고 나머지 동일. 가짜 Gemini API 로 flash/lite 두 엔진 모두 `user-role` → P2-4, `crypto-sample` → P4-6.

---

## 14. 다음 단계 제안
1. PaddleOCR bridge (`exconverter.vision.command`): OCR 텍스트+bbox 를 VLM 프롬프트에 주입해 오타/라벨-값 혼동 제거
2. PDF → 페이지 이미지(PDFBox) → 기존 파이프라인
3. 생성 CLX 를 런타임(`/ui/result/...clx`)으로 열어 Playwright 스크린샷
4. OpenCV SSIM/영역 Diff → Correction Engine(UI-IR 폭/순서/영역 수정) → 재생성, 최대 3~5회
5. 비동기 작업 큐 + 진행률 조회 API (지금은 요청 스레드가 분석 완료까지 대기)

---

## 15. Google Gemini 엔진 (선택, 속도용)

로컬 `qwen3-vl:4b` 는 CPU PC에서 이미지 1장에 9~11분이 걸린다(§11). 같은 파이프라인에서 **이미지 → UI-IR 단계만 Gemini API로 바꾼** 두 번째 엔진이다.
로컬 경로(`ImageUiIrAnalyzer`, `/EXConverter/uploadAndGenerate.do`)는 손대지 않았다. UI-IR 이후(파서 → 보정 → 템플릿 선택 → CLX 생성 → 검증 → 저장)는 두 엔진이 완전히 공유한다.

> **주의**: 이 엔드포인트를 쓰면 설계서 이미지가 Google로 전송된다. Gemini 무료 등급 약관은 입력과 출력을 제품 개선에 사용하고 사람이 검토할 수 있다고 명시하며 "Do not submit sensitive, confidential, or personal information to the Unpaid Services" 라고 적고 있다. 대외비 설계서는 로컬 엔진(기본 엔드포인트)을 쓰거나 유료 등급으로 전환할 것. 유료 등급은 입력을 학습에 사용하지 않는다.

### 15.1 아키텍처

```
[eXBuilder6 화면]  POST ../EXConverter/gemini/uploadAndGenerate.do   (multipart, 기존과 동일한 파일 파라미터)
      │
      ▼
GeminiConversionController
  1. 키 미설정이면 503 즉시 반환 (분석 시도 안 함)
  2. 첫 번째 multipart 파일 수신(20MB 제한) → generated/uploads/<uuid>.img 저장
      │
      ▼
GeminiUiIrAnalyzer.analyze(image, originalName)
  3. ImageIO 디코드 확인 → 긴 변 1536px 축소(PNG, 7MB 초과 시에만 JPEG)
     1536px = 768x768 타일 최대 4개 = 이미지 입력 약 1,032토큰
  4. POST {url}/v1beta/models/{model}:streamGenerateContent?alt=sse
       헤더  x-goog-api-key: <키>            ← ?key= 쿼리 대신 헤더. 접근로그/프록시에 키가 남지 않는다
       본문  systemInstruction  = prompts/gemini-vision-ui-ir.txt
             contents[0].parts  = [ inline_data(base64 PNG), text("...UI-IR JSON만 반환...") ]
             generationConfig   = { temperature:0, maxOutputTokens:8192, responseMimeType:"application/json",
                                    thinkingConfig:{thinkingLevel:"MINIMAL"} }
                                  ※ responseSchema 는 기본적으로 보내지 않는다(아래 "스키마를 쓰지 않는 이유")
  5. SSE 수신: data: 줄마다 candidates[0].content.parts[].text 누적 (thought:true 파트는 건너뜀)
     10초마다 콘솔 진행 로그. 마지막 청크의 finishReason / usageMetadata 수집
  6. 종료 검사: blockReason / MAX_TOKENS / SAFETY / RECITATION / 빈 응답 → 각각 명시적 오류
  7. UiIrParser.parse → UiIrNormalizer.normalize  (기존 그대로)
      │
      ▼
GenerationService.generate(ir, originalName, rawJson)   (기존 그대로)
  TemplateCatalog 선택 → ClxGenerator → ClxValidator → clx-src/result/{날짜}/<파일명>.clx + .js
  원본 UI-IR 은 generated/ui-ir/<파일명>.ui-ir.json
      │
      ▼
201 { id, engine:"gemini", templateId, analysisMode:"gemini:<응답모델>", image{width,height},
      regions[요약], warnings[], elapsedSeconds,
      usage{promptTokenCount, candidatesTokenCount, thoughtsTokenCount, totalTokenCount, model, finishReason, elapsedSeconds},
      saved{directory, clx, js} }
```

**스키마를 쓰지 않는 이유(중요, 실측).** Gemini 는 `generationConfig.responseSchema` 로 응답 구조를 강제할 수 있고 처음엔 그게 안전해 보인다. 실제로는 반대였다. 같은 설계서 스크린샷으로 실측한 결과, 스키마를 붙이면 `gemini-3.5-flash` 는 쉬운 영역(title/description/search)까지는 정확히 만들고 **첫 그리드의 컬럼을 시작해야 하는 지점에서 붕괴**해, 화면과 무관한 문장을 끝없이 생성하며 토큰 예산을 전부 소진했다.

| 조건 (2026-09-17, 같은 이미지) | 결과 |
|---|---|
| responseSchema on, 한국어 description | 붕괴 (62,085자, 341초) |
| responseSchema on, description 제거 | 붕괴 (40,012자, 184초) |
| responseSchema on, 영어 description | 붕괴 (15,003자) |
| responseSchema on, thinkingLevel=MEDIUM | 붕괴 (15,035자) |
| responseSchema on, temperature=0.3 | 붕괴 (15,013자) |
| **responseSchema off** | **성공 (17초, 출력 1,121토큰, 그리드 2개, 컬럼 14개)** |

그래서 `exconverter.gemini.responseSchema` 기본값은 **false** 다. `responseMimeType=application/json` 만으로도 JSON 은 강제되고, 형식 흔들림은 원래 소형 모델용으로 만든 `UiIrParser` + `UiIrNormalizer` 가 흡수한다. 스키마 생성 코드(`uiIrResponseSchema()`)와 `schemaDescriptions` 스위치는 남겨 뒀으니, 더 새로운 모델에서 근거를 확보하면 켜면 된다.
스키마를 켤 때 주의할 점 두 가지: `description` 을 넣으면 붕괴가 더 심해지므로 `schemaDescriptions=false` 를 함께 쓸 것, 그리고 `maxItems` 는 넣지 말 것(이 문서 크기에서 400 `INVALID_ARGUMENT` 로 거부된다).

**비결정성에 대한 방어: 온도를 올려 재시도한다.** 스키마를 끈 뒤에도 같은 요청이 실행마다 성공/붕괴로 갈렸다(`maxOutputTokens=32768` 일 때 65,336자 반복 붕괴 1건). 그리디 디코딩은 반복 루프에서 스스로 빠져나오지 못하므로, 같은 요청을 다시 보내는 재시도는 의미가 없다. 그래서 두 종류의 재시도를 구분한다.

- 전송 실패(429/5xx/연결 끊김): 같은 요청 + 지수 백오프
- 비정상 출력(반복 루프, `MAX_TOKENS`): **온도를 바꿔** 재요청. 1회차는 설정값(0), 2회차 0.4, 3회차 0.8

여기에 `maxOutputTokens=8192`(정상 출력의 약 7배)와 스트리밍 중 문자수 상한 `maxResponseChars=20000` 을 둬서, 붕괴가 나도 수 분이 아니라 수십 초 안에 판정되고 재시도로 넘어간다.

**추론 토큰은 출력 예산을 공유한다.** Gemini 문서상 `maxOutputTokens` 는 답변만이 아니라 추론(thought) 토큰까지 포함한 상한이다. 3.x Flash 의 기본 추론 깊이는 MEDIUM 이라, 예산이 작으면 모델이 추론만 하다 예산을 소진하고 `finishReason=MAX_TOKENS` 로 빈 답변을 낸다. 그래서 이 엔진은 `thinkingLevel=MINIMAL` + `maxOutputTokens=32768` 을 기본값으로 둔다. Gemini 3.x 는 `thinkingBudget`(정수) 대신 `thinkingLevel`(열거형)을 쓰며, 두 필드를 같이 보내면 400 이다.

**API 표면 선택**: 구현은 Generate Content REST API(`:generateContent` / `:streamGenerateContent`)를 쓴다. Google 문서가 이제 "legacy" 로 표시하지만 폐기 일정이 없고 필드 이름이 전부 문서화되어 있다. 후속 API는 `POST /v1beta/interactions` 이며 요청은 `input` 배열, 응답은 `steps[]` 구조다. 옮길 때 바꿀 곳은 `buildRequest()` 와 `readResponse()` 두 메서드뿐이다.

### 15.2 엔드포인트

| 메서드/경로 | 설명 |
|---|---|
| `POST /EXConverter/gemini/uploadAndGenerate.do` | 기존 `uploadAndGenerate.do` 와 **동일한 multipart 계약**(필드명 무관, 첫 번째 파일 파트를 이미지로 사용, 20MB). 응답도 같은 필드 + `engine`, `usage`, `elapsedSeconds`. 키 미설정 시 503 |
| `GET /EXConverter/gemini/status.do` | `{engine, configured, model, url, apiVersion, stream, responseSchema, maxOutputTokens, maxImageSide, thinkingBudget, timeoutSeconds, maxRetries}`. **키 값은 반환하지 않음.** 클라이언트 버튼 활성화 판단용 |

클라이언트(eXBuilder6)는 `convertTest.clx` 의 Submission `action` 만 `../EXConverter/gemini/uploadAndGenerate.do` 로 바꾸면 된다. `convertTest.js` 는 수정 불필요하다. 동기 응답이다.

전체 URL 예(§3 대로 배포 컨텍스트가 루트 `/` 인 현재 환경 기준. 컨텍스트를 `/eXCoverter-AI` 로 바꾸면 그 접두어를 붙인다):
```
http://localhost:8080/EXConverter/gemini/uploadAndGenerate.do
http://localhost:8080/EXConverter/gemini/status.do
```

### 15.3 설정 (`exconverter.properties`, 우선순위는 §10 과 동일: `-D` > 환경변수 > properties)

| 키 | 기본값 | 설명 |
|---|---|---|
| `exconverter.gemini.apiKey` | (빈값) | 비면 환경변수 `GEMINI_API_KEY` → `GOOGLE_API_KEY` 순으로 읽음. properties 에 키를 커밋하지 말 것 |
| `exconverter.gemini.model` | `gemini-3.5-flash` | 무료 등급 + 이미지 입력 가능 모델: `gemini-3.5-flash`, `gemini-3.5-flash-lite`(더 빠르고 쿼터 여유), `gemini-2.5-flash`, `gemini-2.5-flash-lite` |
| `exconverter.gemini.url` | `https://generativelanguage.googleapis.com` | 프록시/게이트웨이 사용 시 변경 |
| `exconverter.gemini.stream` | true | SSE 스트리밍(콘솔 진행 로그 10초 주기). false 면 단일 JSON 응답 |
| `exconverter.gemini.responseSchema` | **false** | UI-IR 구조 강제. **켜지 말 것.** 근거는 §15.1 "스키마를 쓰지 않는 이유" |
| `exconverter.gemini.schemaDescriptions` | false | 스키마 필드별 설명문. `responseSchema=true` 일 때만 의미가 있고, 켜면 붕괴가 심해진다 |
| `exconverter.gemini.maxOutputTokens` | 8192 | **추론 토큰이 이 예산을 같이 쓴다.** 정상 출력이 1,103~1,121토큰이라 약 7배 여유. 일부러 좁게 잡아 반복 루프를 빨리 판정한다. `gemini-3.5-flash` 는 65000 까지 허용 |
| `exconverter.gemini.maxResponseChars` | 20000 | 스트리밍 중 문자수 상한. 넘으면 즉시 중단하고 온도를 올려 재시도한다. 정상 UI-IR 은 수천 자 |
| `exconverter.gemini.temperature` | 0 | 1회차 온도. 비정상 출력 재시도는 0.4 → 0.8 로 올린다(그리디 디코딩은 반복 루프에서 스스로 못 빠져나온다) |
| `exconverter.gemini.maxImageSide` | 1536 | 768 배수라 타일 4개로 끝난다. 작은 글자가 안 읽히면 상향, 토큰을 줄이려면 1152 |
| `exconverter.gemini.thinkingLevel` | `MINIMAL` | Gemini 3.x 추론 깊이: `MINIMAL`/`LOW`/`MEDIUM`/`HIGH` (모델 기본값은 MEDIUM). 레이아웃 판독은 추론보다 추출이라 MINIMAL 이면 충분하고 출력 예산을 답변에 남긴다. 판독 정확도가 아쉬우면 LOW→MEDIUM. `NONE`(또는 `OFF`)이면 `thinkingConfig` 를 아예 생략해 모델 기본값에 맡긴다 |
| `exconverter.gemini.thinkingBudget` | -1 | `thinkingLevel` 이전 모델용 레거시 정수 예산. -1 은 전송하지 않음. **두 값을 같이 보내면 400** 이므로 `thinkingLevel` 이 우선하고, 이 값을 쓰려면 `thinkingLevel=NONE` 으로 둘 것 |

`gemini-2.5-flash` 등 구형 모델은 `thinkingLevel` 자체를 거부한다(`400 Thinking level is not supported for this model`). 이 400 을 만나면 코드가 `thinkingConfig` 없이 **자동으로 한 번 재요청**하므로, 모델만 바꿔도 그대로 동작한다.
| `exconverter.gemini.timeoutSeconds` | 600 | 읽기 타임아웃 |
| `exconverter.gemini.maxRetries` | 2 | 429/5xx/연결오류 재시도. 지수 백오프이며 오류의 `retryDelay` 를 우선 존중 |
| `exconverter.gemini.proxyHost` / `proxyPort` | (빈값) / 8080 | 사내 HTTP 프록시 |

SDK 대신 `HttpURLConnection` 을 쓰는 이유: Maven 이 없어 jar 를 수동 관리하는데 Google client library 는 gRPC/Guava/protobuf/신형 Jackson 등 의존성이 많고 기존 Jackson 2.11 과 충돌한다. Gemini 호출은 POST 1개라 Ollama 호출부와 같은 방식으로 구현했다.

### 15.4 실제 호출을 위한 설정 절차

개발 PC 점검 결과(2026-09-17): `GEMINI_API_KEY`/`GOOGLE_API_KEY` 환경변수 없음. `generativelanguage.googleapis.com` 외부 연결은 확인됨이므로 프록시 설정은 불필요하다. 필요한 것은 API 키 하나다.

1. **API 키 발급**: [Google AI Studio](https://aistudio.google.com/apikey) 로그인 → **Get API key → Create API key** → 프로젝트 선택 → `AIza...` 값 복사. 무료 등급은 결제수단 등록이 필요 없다. 키는 담당자가 직접 입력한다.
2. **키를 Tomcat 에 전달** — 둘 중 하나
   - 권장: Eclipse `Servers` 뷰 → Tomcat 더블클릭 → `Open launch configuration` → `Arguments` 탭 → `VM arguments` 끝에 추가
     ```
     -Dexconverter.gemini.apiKey=AIza...
     ```
   - 대안: Windows 사용자 환경변수 등록 후 **Eclipse 완전 재시작**(Tomcat 이 Eclipse 프로세스의 환경을 상속)
     ```
     setx GEMINI_API_KEY "AIza..."
     ```
3. **재배포**: 새 클래스 2개(`GeminiUiIrAnalyzer`, `GeminiConversionController`), 프롬프트, properties 가 배포되도록 `Publish` 후 Tomcat 재시작.
4. **설정 확인**: `configured: true` 면 준비 완료. `false` 면 키가 Tomcat JVM 에 전달되지 않은 것이고, 변환 요청은 **503** 으로 떨어진다.
   ```
   curl http://localhost:8080/EXConverter/gemini/status.do
   ```
5. **호출**
   - 화면: Submission `action` 을 `../EXConverter/gemini/uploadAndGenerate.do` 로 변경 후 전송
   - 클라이언트 수정 없이: `curl -X POST http://localhost:8080/EXConverter/gemini/uploadAndGenerate.do -F "image=@<이미지경로>"`
   - Tomcat 없이: §15.6 의 `GeminiHarness`
6. **결과 확인**: Eclipse 콘솔 `[Gemini] 설계서 → CLX 변환 시작` ~ `변환 완료` 로그, 응답 JSON 의 `usage`, 파일은 `clx-src/result/<오늘날짜>/`, 모델 원본 출력은 `generated/ui-ir/<파일명>.ui-ir.json`.

### 15.5 콘솔 로그와 오류 매핑

```
[eXConverter 14:02:10] ===== [Gemini] 설계서 → CLX 변환 시작: 스크린샷.png (75 KB) =====
[eXConverter 14:02:10] 이미지 확인: 스크린샷.png (1578x818)
[eXConverter 14:02:10] Gemini 분석 시작: model=gemini-3.5-flash, 전송 이미지 1536x796 (image/png 316 KB, 타일 약 4개), 스트리밍
[eXConverter 14:02:20] Gemini 분석 중... 10s 경과 - 이미지 처리/추론 단계 (아직 응답 토큰 없음)
[eXConverter 14:02:23] Gemini 첫 응답 토큰 수신 (13s) - UI-IR 생성 시작
[eXConverter 14:02:35] Gemini 분석 완료: 25s, 입력 1290토큰, 출력 1420토큰(추론 210), 종료사유=STOP, 응답 모델=gemini-3.5-flash
[eXConverter 14:02:35] UI-IR 영역: title → search(필드 2) → grid(컬럼 10) → ...
[eXConverter 14:02:35] ===== [Gemini] 변환 완료: 총 26s, 분석모드=gemini:gemini-3.5-flash =====
```

| 증상 | 원인과 대응 |
|---|---|
| 503 `key is not configured` | 키가 Tomcat JVM 에 없음. §15.4 2번. `status.do` 의 `configured` 로 확인. eXBuilder6 Submission 은 상태코드만 보여주므로 이유는 응답 본문(`error` 필드)이나 콘솔에서 확인 |
| 404 (컨트롤러 로그가 아예 안 찍힘) | URL 에 `/eXCoverter-AI` 접두어를 붙였거나 Publish/재시작을 안 함. §3 의 컨텍스트 설명 참고 |
| 500 `HTTP 400 INVALID_ARGUMENT: API key not valid` | 키 오타 또는 폐기. 재발급 |
| 500 `HTTP 400` + 스키마 관련 메시지 | `exconverter.gemini.responseSchema=false` 로 끄고 재시도 |
| 500 `HTTP 404` 모델 없음 | `exconverter.gemini.model` 이 오타이거나 해당 키에서 못 쓰는 모델 |
| 재시도 로그 후 `HTTP 429 RESOURCE_EXHAUSTED` | 무료 등급 분당/일일 쿼터 초과. 오류의 `retryDelay` 를 존중해 재시도하며, 계속 나면 `gemini-3.5-flash-lite` 로 낮추거나 시간을 두고 재시도 |
| `HTTP 503 UNAVAILABLE` 반복 | 모델 과부하. `maxRetries` 상향 |
| `Gemini 가 N회 모두 비정상 출력을 냈습니다` | 반복 루프가 재시도 3회를 모두 버텼다. `generated/ui-ir/<파일명>.gemini-failed.raw.txt` 에 마지막 원본 출력이 저장되니 먼저 그걸 볼 것. `responseSchema` 가 켜져 있으면 끄고, `maxRetries` 를 올리거나 모델을 바꿔 본다 |
| `maxOutputTokens=... 에서 잘림` | 오류 메시지의 `추론 N토큰 + 답변 M토큰` 으로 구분한다. 추론이 크면 `thinkingLevel` 을 `MINIMAL` 로 낮추고, 답변만 길면 반복 루프이므로 위 항목을 따른다. 2026-09-17 실측: `thinkingLevel` 미전송(모델 기본 MEDIUM) + `maxOutputTokens=8192` 조합에서는 추론이 예산을 다 써 답변이 비었다 |
| `400 Thinking level is not supported` | 구형 모델(2.5 등). 코드가 `thinkingConfig` 없이 자동 재요청하므로 보통 그냥 통과한다. 로그에 재요청 줄이 찍힌다 |
| `blocked the prompt (blockReason=...)` / `finishReason=SAFETY` | 안전 필터. 이미지 내용 확인, 필요하면 로컬 엔진 사용 |
| `connection failed` | 사내망 차단. `exconverter.gemini.proxyHost/proxyPort` 설정 |
| 결과가 로컬 모델보다 이상함 | `generated/ui-ir/*.ui-ir.json` 을 `GenHarness` 로 재생성해 프롬프트 문제와 생성기 문제를 분리. 프롬프트는 `prompts/gemini-vision-ui-ir.txt` |

### 15.6 테스트

```powershell
$cp = ((Get-ChildItem src\main\webapp\WEB-INF\lib\*.jar).FullName) -join ';'
javac -encoding UTF-8 -d out -cp "$cp;ci-lib\clx\cleopatra_server.jar" (Get-ChildItem -Recurse src\main\java\com\tomatosystem -Filter *.java).FullName
javac -encoding UTF-8 -d out -cp "out;$cp" tools\harness\GeminiHarness.java tools\harness\GeminiStreamHarness.java

# (1) 오프라인: 가짜 Gemini API(SSE)로 요청 형식/스트림 파서/CLX 생성 확인 (키 불필요)
#     콘솔에 실제로 보낸 엔드포인트, 헤더, inline_data, responseSchema 가 출력된다
java -Dexconverter.gemini.url=http://127.0.0.1:18436 -Dexconverter.gemini.apiKey=test -Dfile.encoding=UTF-8 `
  -cp "out;$cp;src\main\resources" GeminiStreamHarness docs\samples\crypto-sample.ui-ir.json `
  "clx-src\result\2026-09-13\스크린샷 2026-09-13 110550.png" out\gemini-fake.clx

# (2) 실제 API: 이미지 → Gemini → CLX. out\gemini.ui-ir.json 에 모델 원본 출력 저장
$env:GEMINI_API_KEY = "AIza..."
java -Dfile.encoding=UTF-8 -cp "out;$cp;src\main\resources" GeminiHarness `
  "clx-src\result\2026-09-13\스크린샷 2026-09-13 110550.png" out\gemini.clx
```

검증 이력 1 — 가짜 API(2026-09-17):
- 스트리밍/비스트리밍 양쪽에서 엔드포인트 경로, `x-goog-api-key` 헤더, `systemInstruction`, `inline_data(image/png)`, `responseMimeType`, `responseSchema` 전송 확인
- `thought:true` 파트를 건너뛰고 답변 텍스트만 누적하는지 확인
- `usageMetadata` 4개 카운터 수집, 템플릿 P4-6 선택, ClxValidator 오류 0, CLX 18,815 bytes
- 오류 경로 5종 확인: 429 두 번 후 성공(`retryDelay` 1초 존중), 400 즉시 실패, `MAX_TOKENS` 처리, `blockReason=SAFETY`, 503 재시도 소진
- 추론 설정 4가지 확인: 기본 `{"thinkingLevel":"MINIMAL"}`, `HIGH` 전달, `NONE` 이면 `thinkingConfig` 생략, `NONE`+`thinkingBudget=0` 이면 레거시 필드 전송
- 최종 기본값(스키마 off, maxOutputTokens 8192)으로 재확인

검증 이력 2 — 실제 Gemini API(2026-09-17, `스크린샷 2026-09-13 110550.png`, `gemini-3.5-flash`):

기본값을 찾는 과정에서 실패 6회를 거쳤다. 순서대로 `maxOutputTokens=8192` + 추론 기본(MEDIUM) → 추론이 예산 소진, `maxOutputTokens=32768` → 반복 루프 62,085자, MEDIUM/temperature 0.3/영어 description/description 제거 → 모두 붕괴, 스키마 off + `maxOutputTokens=32768` → 반복 루프 65,336자. 원인과 대응은 §15.1 에 정리했다.

최종 기본값으로 3회 연속 실행한 결과:

| 실행 | 소요 | 출력 토큰 | 종료사유 | 결과 |
|---|---|---|---|---|
| 1 | 25초 | 1,103 | STOP | 템플릿 P4-6, ClxValidator 오류 0 |
| 2 | 19초 | 1,103 | STOP | 동일 |
| 3 | 11초 | 1,103 | STOP | 동일 |

세 번 모두 재시도 없이 1회차에 성공했고, region 구성은 `title → description → description → search → grid → grid → buttons`, **컬럼 헤더 14개가 정답 샘플(`docs/samples/crypto-sample.ui-ir.json`)과 완전히 일치**했다(빈 헤더 포함). 조회영역의 `김길동`/이메일도 라벨이 아니라 `value` 로 올바르게 들어갔고, 그리드 제목은 설명문 없이 빈 문자열이었다. 로컬 `qwen3-vl:4b` 가 같은 이미지에 9~11분 걸리고 표 구조를 자주 틀리는 것과 비교된다(§11).

아직 안 한 것: 생성 CLX 를 e6-compiler 로 컴파일해 `BUILD SUCCESS` 확인(§9.2). `ClxGenerator` 를 수정하지 않았고 ClxValidator 는 통과했으므로 위험은 낮지만, 확인은 남아 있다.

### 15.7 변경 파일 목록 (2026-09-17)

| 파일 | 변경 |
|---|---|
| `service/GeminiUiIrAnalyzer.java` | 신규. Gemini 호출(SSE/비스트리밍), responseSchema 생성, 재시도, 오류 매핑, 이미지 축소·인코딩, 설정 조회 |
| `web/GeminiConversionController.java` | 신규. `/EXConverter/gemini/uploadAndGenerate.do`, `/status.do` |
| `resources/exconverter/prompts/gemini-vision-ui-ir.txt` | 신규. Gemini 시스템 프롬프트 |
| `resources/exconverter/exconverter.properties` | `exconverter.gemini.*` 추가 |
| `tools/harness/GeminiHarness.java`, `GeminiStreamHarness.java` | 신규. 실제 API / 가짜 API 하니스 |
| `README.md` | §1 원칙, §2 Phase 9, §3 환경, §4 구조, §10, §12 규칙 3, §13, §15 |
| 기존 로컬 경로 (`ImageUiIrAnalyzer`, `ImageConversionController`, `vision-ui-ir.txt`) | **변경 없음** |

### 15.8 Gemini Flash-Lite 엔진 (2026-09-18 추가)

무료 등급 쿼터는 **모델별**로 따로 계산된다. 2026-09-02 실측(429 응답의 QuotaFailure 값): `gemini-3.5-flash` 분당 5회 / **하루 20회**, `gemini-3.5-flash-lite` 분당 15회 / **하루 500회**. 하루 한도는 태평양 시간 자정에 초기화되고, API 키가 아니라 Google Cloud 프로젝트 단위로 계산된다. Google 은 이 수치를 공식 문서에 싣지 않고 예고 없이 바꾸므로 실제 값은 AI Studio 의 Rate limit 화면에서 확인한다.

그래서 `gemini-3.5-flash` 엔진(§15.1~15.7, 실측 검증 완료)은 그대로 두고, 모델만 다른 엔드포인트를 하나 더 둔다.

| 메서드/경로 | 설명 |
|---|---|
| `POST /EXConverter/gemini-lite/uploadAndGenerate.do` | `/EXConverter/gemini/uploadAndGenerate.do` 와 같은 multipart 계약, 같은 응답 필드. `engine:"gemini-lite"` |
| `GET /EXConverter/gemini-lite/status.do` | `/gemini/status.do` 와 같은 형식, `model` 만 lite |

- 모델: `exconverter.gemini.lite.model` (기본 `gemini-3.5-flash-lite`). **나머지 설정(키, url, maxOutputTokens, thinkingLevel, 재시도, 이미지 크기, 프록시)은 `exconverter.gemini.*` 를 그대로 공유한다.** 키도 같은 키 하나로 된다.
- 구조: `GeminiLiteUiIrAnalyzer` 는 `GeminiUiIrAnalyzer.analyze(image, name, model)` 오버로드에 모델만 넘기는 얇은 서비스다. 하위 클래스로 만들지 않은 이유: `GeminiUiIrAnalyzer` 타입의 빈이 2개가 되면 `GeminiConversionController` 의 타입 기반 `@Autowired` 가 깨진다.
- 기존 flash 경로의 변경은 `analyze(image, name)` 가 `analyze(image, name, model())` 에 위임하도록 바뀐 것뿐이며 동작은 같다.
- 화면: `convertTest.clx` Submission `action` 을 `../EXConverter/gemini-lite/uploadAndGenerate.do` 로 바꾼다.
- 콘솔 로그 머리말은 `[Gemini-Lite]`, 응답의 `usage.model` / `analysisMode` 로 실제 응답 모델을 확인한다.
- 오프라인 확인: `GeminiStreamHarness --lite <ui-ir.json> [image] [out.clx]` → 가짜 API 로그에 `path=/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse` 가 찍힌다(2026-09-18 확인, P4-6 선택, ClxValidator 오류 0).
- 호출은 성공했는데 UI-IR 파싱이 실패하면 모델 원본 출력을 `generated/ui-ir/<파일명>.gemini-failed.raw.txt` 에 저장하고, 400 사유를 콘솔에 `변환 실패(400): ...` 로 남긴다(flash/lite 공통).

실제 API 1차 결과(2026-09-18, `스크린샷 2026-09-17 175014.png` 1611x688, 기본 설정 그대로):
- `thinkingLevel=MINIMAL` 을 거부하지 않았다. 9초, 입력 2,504토큰, 출력 992토큰(추론 0), `STOP`.
- **`regions` 를 최상위가 아니라 `screen` 안에 넣어** `regions is required` 400. `UiIrParser` 가 `screen.regions` 를 허용하도록 보정했다(§6).
- 보정 후 같은 출력으로: 조회 3필드, 그리드 3개(헤더 5/6/6), 설명문 1개 → 템플릿 P4-6, ClxValidator 오류 0, e6-compiler `BUILD SUCCESS`. 전체 회귀 7샘플 × 77템플릿 = 539건 실패 0.
- 판독 품질 메모: 그리드 제목에 건수 표시(`사용자 목록  총 0건`)가 그대로 들어옴, 텍스트 없는 아이콘 버튼 2개는 빈 텍스트로 와서 버려짐.
