# eXConverter AI MVP (Phase 1)

The current project is a Spring MVC 5/eXBuilder6 application, so this implementation uses its existing `src/main/java`, `src/main/resources`, and `src/main/webapp` layout. It does not introduce Spring Boot, Maven, or a Java-version change. Eclipse WTP packages `templates/` into `WEB-INF/classes/exconverter/templates`, so local server operation does not require a template-root JVM argument.

Every CLX under `templates/` is read-only skeleton material.

1. `TemplateCatalog` profiles each template (search box, grid/form counts, tabs, tree, popup) and picks the closest skeleton for the UI-IR's regions.
2. `ClxGenerator` keeps the skeleton — responsive screens, `udcComAppHeader`, `content-header`/`search-box`, `content-body`/`content` (incl. `udcComGridTitle`), `content-footer`, style classes and spacing — and rebuilds the contents from the UI-IR: search label/control pairs and buttons, one `content` group per grid with its dataset, columns, header text and cell editors, forms (`form-base`), description text, section titles, tabs, textareas and footer buttons. Placeholder controls from the template are removed.
3. `ClxValidator` checks XML, duplicate `id`/`std:sid`, grid column indexes, dataset references and formdata positions against their formlayout.

Generated CLX can additionally be checked with the eXBuilder6 headless compiler: `java -jar ci-lib/clx/e6-compiler.jar -s <project> -o <out>`.

## Generate

`POST /api/exconverter/generate.do` with JSON:

```json
{
  "screen": { "name": "사용자 조회", "width": 1440, "height": 860 },
  "regions": [
    { "type": "search", "fields": [{ "label": "성명", "component": "inputbox" }, { "label": "등록일", "component": "dateinput", "required": true }] },
    { "type": "grid", "columns": ["번호", "성명", "이메일", "연락처", "등록일"] }
  ]
}
```

The endpoint responds with an id and a `downloadUrl`; use that URL to retrieve the `.clx` file. In a deployed server, set `-Dexconverter.template.root=<template directory>` and `-Dexconverter.generated.root=<output directory>` to make paths explicit.

Phase 2 adapters (PaddleOCR and local Ollama/Qwen3-VL) must output this UI-IR contract; they must not write CLX directly.

## Image upload API

`POST /EXConverter/uploadAndGenerate.do` as `multipart/form-data`, with the image in the `file` field. The server verifies that it is a decodable image, saves it under `generated/uploads/`, derives a UI-IR, chooses the closest CLX under `templates/`, and returns a CLX download URL.

The eXBuilder6 `FileUpload` control registers a selected file with `subSend.setFileParameters(each.name, each)`. It uses the original filename as the multipart field name and also sends `_JSONREQUESTOBJ_`; the controller deliberately reads the first actual multipart file rather than requiring a fixed field name.

Settings live in `src/main/resources/exconverter/exconverter.properties` (JVM `-D` options and environment variables override them). If `exconverter.ollama.model` is empty, the first installed vision model in the local Ollama (`/api/tags`) is used automatically. The prompt is `exconverter/prompts/vision-ui-ir.txt`; the model's raw UI-IR is saved to `generated/ui-ir/<name>.ui-ir.json`. The response lists `analysisMode`, the recognised `regions` and any `warnings`.

Only when no local vision AI is reachable does the response contain `"analysisMode":"structural-fallback"` with placeholder labels and columns. On CPU-only PCs a 4B vision model needs several minutes per image, so `exconverter.ollama.timeoutSeconds` defaults to 1800 and images are downscaled to `exconverter.vision.maxImageSide` (1280).

For PaddleOCR plus custom layout logic, configure a local executable with `-Dexconverter.vision.command=C:\path\to\vision-bridge.exe`. It receives the image path as its only argument and must print UI-IR JSON to stdout. The executable takes precedence over the Ollama setting. Both options keep the design image inside the local network.
