# eXConverter AI MVP (Phase 1)

The current project is a Spring MVC 5/eXBuilder6 application, so this implementation uses its existing `src/main/java`, `src/main/resources`, and `src/main/webapp` layout. It does not introduce Spring Boot, Maven, or a Java-version change. Eclipse WTP packages `templates/` into `WEB-INF/classes/exconverter/templates`, so local server operation does not require a template-root JVM argument.

`templates/P1_Single Pattern/버티컬/Single Pattern P1-1.clx` is read-only source material. `GenerationService` selects it for a SEARCH_GRID UI-IR, `ClxGenerator` changes only known template nodes, and `ClxValidator` checks XML, duplicate IDs, screen, and grid presence before saving a result in `generated/`.

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

When no vision adapter is configured, the response contains `"analysisMode":"structural-fallback"`; it derives screen size but uses placeholder labels and columns. For direct local Qwen3-VL analysis, set `-Dexconverter.ollama.model=qwen3-vl:<your-tag>`; the default endpoint is `http://127.0.0.1:11434/api/generate`, and can be changed with `-Dexconverter.ollama.url=...`. The model must be vision-capable and return UI-IR JSON.

For PaddleOCR plus custom layout logic, configure a local executable with `-Dexconverter.vision.command=C:\path\to\vision-bridge.exe`. It receives the image path as its only argument and must print UI-IR JSON to stdout. The executable takes precedence over the Ollama setting. Both options keep the design image inside the local network.
