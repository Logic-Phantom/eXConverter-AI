package com.tomatosystem.exconverter.service;

import com.tomatosystem.exconverter.model.UiIr;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.imageio.ImageIO;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Image-to-UI-IR adapter backed by the Google Gemini API.
 *
 * A second analyzer next to {@link ImageUiIrAnalyzer} (local Ollama). Only the dedicated Gemini endpoint
 * uses it, so the local pipeline is untouched. Everything after the model call is shared:
 * UiIrParser -> UiIrNormalizer -> TemplateCatalog -> ClxGenerator -> ClxValidator -> save.
 *
 * API surface: the Generate Content REST API, which Google now labels "legacy" but still documents in full
 * and ships without a deprecation date. It is the right fit here because the whole call is one POST and the
 * request/response field names are stable. The newer Interactions API (POST /v1beta/interactions, with an
 * `input` array and a `steps[]` response) is the eventual replacement; only {@link #buildRequest} and the two
 * response readers would have to change. See README section 15.
 *
 * Request shape: systemInstruction (the prompt) + one user turn [inline_data(base64 PNG/JPEG), text],
 * with generationConfig.responseMimeType=application/json and a responseSchema that pins the UI-IR shape,
 * so the model cannot return prose or a differently shaped object. Streaming SSE by default so the Eclipse
 * console shows progress and long outputs never hit the HTTP read timeout.
 *
 * Why raw HttpURLConnection instead of the Google SDK: this project has no Maven/Gradle and manages jars by
 * hand in WEB-INF/lib. The Google client libraries pull in a large dependency tree (gRPC, Guava, protobuf,
 * a newer Jackson) that collides with the existing Jackson 2.11. The Ollama call already uses this pattern.
 */
@Service
public class GeminiUiIrAnalyzer {
	private static final Logger LOGGER = LoggerFactory.getLogger(GeminiUiIrAnalyzer.class);
	static final String PROMPT_RESOURCE = "exconverter/prompts/gemini-vision-ui-ir.txt";
	static final String FALLBACK_PROMPT_RESOURCE = "exconverter/prompts/vision-ui-ir.txt";
	static final String DEFAULT_MODEL = "gemini-3.5-flash";
	static final String DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
	static final String API_VERSION = "v1beta";
	/** The whole request (prompt + inline bytes) must stay under 20 MB; keep well clear of it. */
	private static final int MAX_IMAGE_BYTES = 7_000_000;

	// ---------------------------------------------------------------- configuration

	public static String apiKey() {
		String key = ExConverterConfig.get("exconverter.gemini.apiKey", "");
		if (key.isEmpty()) key = valueOf(System.getenv("GEMINI_API_KEY"));
		if (key.isEmpty()) key = valueOf(System.getenv("GOOGLE_API_KEY"));
		return key;
	}
	public static boolean isConfigured() { return !apiKey().isEmpty(); }
	public static String model() { return ExConverterConfig.get("exconverter.gemini.model", DEFAULT_MODEL); }
	private static String baseUrl() { return ExConverterConfig.get("exconverter.gemini.url", DEFAULT_BASE_URL).replaceAll("/+$", ""); }
	private static boolean streaming() { return !"false".equalsIgnoreCase(ExConverterConfig.get("exconverter.gemini.stream", "true")); }
	/**
	 * Off by default, against expectation. Pinning the UI-IR shape with responseSchema looks like the safer
	 * choice, but on gemini-3.5-flash it makes the model collapse: on a dense design screenshot it emitted
	 * the easy regions correctly, then, exactly where the first grid's columns had to start, degenerated into
	 * an endless chain of invented sentences and burned the whole token budget. Measured 2026-09-17 on the
	 * same image, everything else held constant: schema on collapsed past 15,000-62,000 characters on four
	 * runs out of five (Korean descriptions, English descriptions, no descriptions, thinkingLevel MEDIUM,
	 * temperature 0.3); schema off finished in 17 seconds with both grids and all 14 column headers.
	 * responseMimeType=application/json still forces JSON, and UiIrParser plus UiIrNormalizer already absorb
	 * the shape variance they were written for. Turn this back on only with evidence on a newer model.
	 */
	private static boolean useResponseSchema() { return "true".equalsIgnoreCase(ExConverterConfig.get("exconverter.gemini.responseSchema", "false")); }
	/**
	 * Off by default, and this is not a preference. With any per-field description in the schema, gemini-3.5-flash
	 * reliably starts writing prose into a value and then degenerates into an endless chain of unrelated
	 * sentences, burning the whole token budget (measured 2026-09-17 on the same screenshot: descriptions on,
	 * Korean or English, collapsed past 15,000 characters every time; descriptions off finished in 7 seconds
	 * with 460 output tokens). All field guidance therefore lives in prompts/gemini-vision-ui-ir.txt instead.
	 */
	private static boolean schemaDescriptions() { return "true".equalsIgnoreCase(ExConverterConfig.get("exconverter.gemini.schemaDescriptions", "false")); }
	/**
	 * Thinking tokens are drawn from the same budget, so this is not just the answer size. Gemini 3.x Flash
	 * allows up to 65k. The UI-IR itself is 1,000-3,000 tokens; the headroom is for reasoning.
	 */
	private static int maxOutputTokens() { return ExConverterConfig.getInt("exconverter.gemini.maxOutputTokens", 32768); }
	private static int timeoutSeconds() { return ExConverterConfig.getInt("exconverter.gemini.timeoutSeconds", 600); }
	private static int maxImageSide() { return ExConverterConfig.getInt("exconverter.gemini.maxImageSide", 1536); }
	private static int maxRetries() { return ExConverterConfig.getInt("exconverter.gemini.maxRetries", 2); }
	/**
	 * Hard stop for runaway generation. A correct UI-IR for a dense screen is under 10,000 characters, so
	 * anything far past that means the model is looping (one region per data row, repeated columns) and the
	 * rest of the call is wasted minutes. Aborting mid-stream turns a 6-minute timeout into a fast failure.
	 */
	private static int maxResponseChars() { return ExConverterConfig.getInt("exconverter.gemini.maxResponseChars", 40000); }
	/** Greedy decoding (0) is the most deterministic but also the most prone to repetition loops. */
	private static double temperature() {
		try { return Double.parseDouble(ExConverterConfig.get("exconverter.gemini.temperature", "0")); }
		catch (NumberFormatException e) { return 0; }
	}
	/**
	 * Preferred thinking control on Gemini 3.x: MINIMAL / LOW / MEDIUM / HIGH (the model default is MEDIUM).
	 * Reading a layout is extraction, not hard reasoning, so MINIMAL keeps the whole output budget for the
	 * UI-IR. NONE (or OFF) leaves thinkingConfig out of the request entirely; a blank value cannot express
	 * that, because ExConverterConfig treats blank as "unset" and falls through to the properties file.
	 */
	private static String thinkingLevel() {
		String level = ExConverterConfig.get("exconverter.gemini.thinkingLevel", "MINIMAL").trim().toUpperCase(java.util.Locale.ROOT);
		return "NONE".equals(level) || "OFF".equals(level) ? "" : level;
	}
	/**
	 * Legacy integer budget, kept only for older models that predate thinkingLevel. -1 means "do not send".
	 * Sending both thinkingLevel and thinkingBudget in one request is a 400, so thinkingLevel wins.
	 */
	private static int thinkingBudget() { return ExConverterConfig.getInt("exconverter.gemini.thinkingBudget", -1); }

	/** Effective settings for the status endpoint. Never includes the key itself. */
	public static JSONObject describe() { return describe("gemini", model()); }

	/** Same settings for another engine that shares this analyzer with a different model (e.g. gemini-lite). */
	public static JSONObject describe(String engine, String model) {
		JSONObject status = new JSONObject();
		status.put("engine", engine);
		status.put("configured", isConfigured());
		status.put("model", model);
		status.put("url", baseUrl());
		status.put("apiVersion", API_VERSION);
		status.put("stream", streaming());
		status.put("responseSchema", useResponseSchema());
		status.put("maxOutputTokens", maxOutputTokens());
		status.put("maxImageSide", maxImageSide());
		status.put("thinkingLevel", thinkingLevel());
		status.put("thinkingBudget", thinkingBudget());
		status.put("timeoutSeconds", timeoutSeconds());
		status.put("maxRetries", maxRetries());
		status.put("maxResponseChars", maxResponseChars());
		status.put("temperature", temperature());
		return status;
	}

	// ---------------------------------------------------------------- public API

	public ImageUiIrAnalyzer.Analysis analyze(File image, String originalName) { return analyze(image, originalName, model()); }

	/**
	 * Same pipeline with an explicit model, so another engine (GeminiLiteUiIrAnalyzer) can reuse every setting
	 * except exconverter.gemini.model. Quota is counted per model, so each engine draws on its own daily limit.
	 */
	public ImageUiIrAnalyzer.Analysis analyze(File image, String originalName, String model) {
		try {
			if (!isConfigured()) throw new IllegalStateException("Gemini API key is not configured. Set exconverter.gemini.apiKey (properties / -D / EXCONVERTER_GEMINI_APIKEY) or the GEMINI_API_KEY environment variable.");
			BufferedImage buffered = ImageIO.read(image);
			if (buffered == null) throw new IllegalArgumentException("Only decodable image files are supported");
			if (buffered.getWidth() > 10000 || buffered.getHeight() > 10000) throw new IllegalArgumentException("Image dimensions exceed 10000px");
			ProgressLog.step("이미지 확인: {} ({}x{})", originalName, buffered.getWidth(), buffered.getHeight());
			BufferedImage scaled = downscale(buffered, maxImageSide());
			partialText.remove();
			ModelOutput output;
			try {
				output = callGemini(scaled, model);
			} catch (Exception e) {
				// Whatever the model did produce is the only evidence for why it failed, so keep it.
				dumpRaw(originalName, partial());
				throw e;
			}
			UiIr ir;
			try {
				ir = UiIrParser.parse(output.text);
			} catch (RuntimeException e) {
				// The call succeeded but the JSON breaks a UI-IR rule; without the raw text the cause is a guess.
				File raw = dumpRaw(originalName, output.text);
				String where = raw == null ? "" : " (모델 원본 출력: " + raw.getAbsolutePath() + ")";
				if (e instanceof IllegalArgumentException) throw new IllegalArgumentException("Gemini 출력이 UI-IR 규칙에 맞지 않습니다: " + e.getMessage() + where, e);
				throw new IllegalStateException("Gemini 출력을 UI-IR 로 파싱하지 못했습니다: " + e.getMessage() + where, e);
			}
			if (ir.getSourceWidth() <= 0) ir.setSourceWidth(scaled.getWidth());
			if ("생성 화면".equals(ir.getScreenName())) ir.setScreenName(baseName(originalName));
			lastUsage.set(output.usage());
			return new ImageUiIrAnalyzer.Analysis(ir, "gemini:" + output.model, buffered.getWidth(), buffered.getHeight(), output.text);
		} catch (IllegalArgumentException e) {
			throw e;
		} catch (Exception e) {
			throw new IllegalStateException("Gemini image analysis failed: " + e.getMessage(), e);
		} finally {
			partialText.remove();
		}
	}

	/** Text accumulated so far on this thread, so a failed call can still be inspected. */
	private static final ThreadLocal<StringBuilder> partialText = new ThreadLocal<StringBuilder>();
	private static String partial() { StringBuilder sb = partialText.get(); return sb == null ? "" : sb.toString(); }

	/**
	 * Writes the model's raw output next to the successful ones, suffixed .raw.txt so it is never mistaken for UI-IR.
	 * Returns the file, or null when there was nothing to save or the write failed.
	 */
	private static File dumpRaw(String originalName, String text) {
		if (text == null || text.trim().isEmpty()) return null;
		try {
			File dir = new File(ExConverterConfig.get("exconverter.generated.root", "generated"), "ui-ir");
			if (!dir.exists() && !dir.mkdirs()) return null;
			File file = new File(dir, baseName(originalName) + ".gemini-failed.raw.txt");
			java.nio.file.Files.write(file.toPath(), text.getBytes(StandardCharsets.UTF_8));
			ProgressLog.step("실패한 Gemini 원본 출력 저장: {} ({}자)", file.getAbsolutePath(), text.length());
			return file;
		} catch (Exception e) {
			LOGGER.warn("Could not save the failed Gemini output: {}", e.getMessage());
			return null;
		}
	}

	/** Token usage of the most recent call on this thread, surfaced in the HTTP response for quota visibility. */
	private final ThreadLocal<JSONObject> lastUsage = new ThreadLocal<JSONObject>();
	public JSONObject lastUsage() { JSONObject usage = lastUsage.get(); return usage == null ? new JSONObject() : usage; }

	// ---------------------------------------------------------------- Gemini call

	static final class ModelOutput {
		String text = ""; String model = ""; String finishReason = ""; String blockReason = "";
		int promptTokens; int outputTokens; int thoughtTokens; int totalTokens; long elapsedMs;
		JSONObject usage() {
			return new JSONObject().put("promptTokenCount", promptTokens).put("candidatesTokenCount", outputTokens)
				.put("thoughtsTokenCount", thoughtTokens).put("totalTokenCount", totalTokens)
				.put("model", model).put("finishReason", finishReason).put("elapsedSeconds", elapsedMs / 1000);
		}
	}

	/**
	 * One call, with two independent retry reasons.
	 *
	 * Transport failures (429, 5xx, dropped connections) are retried with the same request and a backoff.
	 * Degenerate output is retried with a *different* request: the same prompt at a higher temperature.
	 * That second case is not defensive padding. On this model the identical request succeeds or collapses
	 * from one run to the next, and greedy decoding has no way out of a repetition once it starts, so the
	 * only useful retry is one that changes the decode path. Temperatures walk 0 (or the configured value),
	 * then 0.4, then 0.8.
	 */
	private ModelOutput callGemini(BufferedImage image, String model) throws Exception {
		boolean stream = streaming();
		EncodedImage encoded = encode(image);
		String prompt = loadPrompt();
		boolean omitThinking = false;
		ProgressLog.step("Gemini 분석 시작: model={}, 전송 이미지 {}x{} ({} {} KB, 타일 약 {}개), thinkingLevel={}, maxOutputTokens={}, responseSchema={}{}", model, image.getWidth(), image.getHeight(), encoded.mediaType, encoded.bytes.length / 1024, tiles(image), thinkingLevel().isEmpty() ? "(생략)" : thinkingLevel(), maxOutputTokens(), useResponseSchema(), stream ? ", 스트리밍" : "");

		int attempts = maxRetries() + 1;
		Exception last = null;
		for (int attempt = 1; attempt <= attempts; attempt++) {
			double temperature = attempt == 1 ? temperature() : Math.min(1.0, 0.4 * (attempt - 1));
			byte[] body = buildRequest(encoded, prompt, omitThinking, temperature).toString().getBytes(StandardCharsets.UTF_8);
			long started = System.currentTimeMillis();
			try {
				ModelOutput output = stream ? streamOnce(model, body, started) : requestOnce(model, body);
				output.elapsedMs = System.currentTimeMillis() - started;
				ProgressLog.step("Gemini 분석 완료: {}s, 입력 {}토큰, 출력 {}토큰(추론 {}), 종료사유={}, 응답 모델={}", output.elapsedMs / 1000, output.promptTokens, output.outputTokens, output.thoughtTokens, output.finishReason, output.model);
				verify(output);
				return output;
			} catch (UnsupportedThinkingException e) {
				if (omitThinking) throw e;
				omitThinking = true;
				ProgressLog.step("이 모델은 thinkingLevel 을 지원하지 않아 thinkingConfig 없이 재요청합니다: model={}", model);
				attempt--; // The rejected request never reached the model, so it does not use up an attempt.
			} catch (DegenerateOutputException e) {
				last = e;
				if (attempt == attempts) break;
				ProgressLog.step("Gemini 출력이 비정상이라 재시도 {}/{}: {} → 다음 시도는 temperature={}", attempt, attempts - 1, e.getMessage(), Math.min(1.0, 0.4 * attempt));
			} catch (RetryableException e) {
				last = e;
				if (attempt == attempts) break;
				long wait = e.retryAfterMs > 0 ? e.retryAfterMs : (long) Math.pow(2, attempt) * 1000L;
				ProgressLog.step("Gemini 호출 재시도 {}/{}: {} ({}초 후)", attempt, attempts - 1, e.getMessage(), wait / 1000);
				Thread.sleep(wait);
			}
		}
		if (last instanceof DegenerateOutputException) throw new IllegalStateException("Gemini 가 " + attempts + "회 모두 비정상 출력을 냈습니다: " + last.getMessage(), last);
		throw new IllegalStateException("Gemini API unavailable after " + attempts + " attempts: " + (last == null ? "" : last.getMessage()), last);
	}

	/** Turns the model's own stop signals into actionable errors instead of letting an empty parse fail later. */
	private void verify(ModelOutput output) {
		if (!output.blockReason.isEmpty()) throw new IllegalStateException("Gemini blocked the prompt (blockReason=" + output.blockReason + ")");
		String reason = output.finishReason;
		if ("MAX_TOKENS".equals(reason)) {
			// Thinking and the answer share maxOutputTokens, so a large thoughtsTokenCount is one cause; the
			// other, far more common here, is a repetition loop that never reaches the closing brace.
			String cause = output.thoughtTokens > 0 && output.thoughtTokens >= output.outputTokens
				? "추론이 예산을 소진했습니다. exconverter.gemini.thinkingLevel 을 MINIMAL 로 낮추세요"
				: "정상 UI-IR 은 이 예산의 10분의 1이면 충분하므로, 모델이 반복 생성에 빠진 것입니다";
			throw new DegenerateOutputException("maxOutputTokens=" + maxOutputTokens() + " 에서 잘림"
				+ " (추론 " + output.thoughtTokens + "토큰 + 답변 " + output.outputTokens + "토큰, thinkingLevel=" + thinkingLevel() + "). " + cause);
		}
		if ("SAFETY".equals(reason) || "PROHIBITED_CONTENT".equals(reason) || "BLOCKLIST".equals(reason) || "SPII".equals(reason)) throw new IllegalStateException("Gemini stopped for safety reasons (finishReason=" + reason + ")");
		if ("RECITATION".equals(reason)) throw new IllegalStateException("Gemini stopped with finishReason=RECITATION");
		if (output.text.trim().isEmpty()) throw new IllegalStateException("Gemini returned an empty response (finishReason=" + reason + ")");
	}

	/**
	 * systemInstruction carries the fixed prompt; the user turn carries the image first, then the instruction
	 * line. Image-before-text is what the image-understanding guide recommends for a single image.
	 */
	static JSONObject buildRequest(EncodedImage image, String systemPrompt, boolean omitThinking, double temperature) {
		JSONObject request = new JSONObject();
		request.put("systemInstruction", new JSONObject().put("parts", new JSONArray().put(new JSONObject().put("text", systemPrompt))));
		JSONArray parts = new JSONArray();
		parts.put(new JSONObject().put("inline_data", new JSONObject().put("mime_type", image.mediaType).put("data", Base64.getEncoder().encodeToString(image.bytes))));
		parts.put(new JSONObject().put("text", "이 화면 설계 이미지(" + image.width + "x" + image.height + "px)를 분석해 UI-IR JSON만 반환하세요. screen.sourceWidth 는 " + image.width + " 로 설정하세요."));
		request.put("contents", new JSONArray().put(new JSONObject().put("role", "user").put("parts", parts)));

		JSONObject generationConfig = new JSONObject();
		generationConfig.put("temperature", temperature);
		generationConfig.put("maxOutputTokens", maxOutputTokens());
		generationConfig.put("responseMimeType", "application/json");
		if (useResponseSchema()) {
			JSONObject schema = uiIrResponseSchema();
			if (!schemaDescriptions()) stripKey(schema, "description");
			generationConfig.put("responseSchema", schema);
		}
		// Exactly one of the two, never both: the API rejects the pair with a 400.
		String level = omitThinking ? "" : thinkingLevel();
		int budget = omitThinking ? -1 : thinkingBudget();
		if (!level.isEmpty()) {
			generationConfig.put("thinkingConfig", new JSONObject().put("thinkingLevel", level));
			if (budget >= 0) LOGGER.warn("Both exconverter.gemini.thinkingLevel and thinkingBudget are set; sending thinkingLevel only (sending both is a 400).");
		} else if (budget >= 0) {
			generationConfig.put("thinkingConfig", new JSONObject().put("thinkingBudget", budget));
		}
		request.put("generationConfig", generationConfig);
		return request;
	}

	/**
	 * The UI-IR contract expressed in the JSON-Schema subset Gemini accepts for responseSchema, so the model
	 * is structurally unable to return prose, a code fence or a differently shaped object. Deliberately
	 * narrower than ui-ir.schema.json: the legacy string form of columns is left out (the parser still accepts
	 * it from Ollama), and only the fields that identify a region are required, so the model is never pushed
	 * into inventing a label or a width it cannot see.
	 */
	static JSONObject uiIrResponseSchema() {
		// Descriptions are deliberately English: Korean ones were continued as Korean prose inside the
		// values and collapsed the response (see schemaDescriptions()).
		JSONObject screen = object()
			.put("properties", new JSONObject()
				.put("name", type("string", "Page title as shown"))
				.put("type", type("string", "Empty string, or POPUP for a dialog"))
				.put("sourceWidth", type("integer", "Width in pixels of the analysed image")));
		JSONObject field = object()
			.put("properties", new JSONObject()
				.put("label", type("string", "Label text shown left of the control"))
				.put("component", enumType(new String[] { "inputbox", "dateinput", "daterange", "combobox", "searchinput", "checkbox", "radiobutton", "numbereditor", "maskeditor", "textarea", "output" }))
				.put("value", type("string", "Text shown inside the input, else empty"))
				.put("required", type("boolean", "True when the label carries a required mark")))
			.put("required", new JSONArray().put("label"));
		JSONObject column = object()
			.put("properties", new JSONObject()
				.put("header", type("string", "Header cell text, copied exactly"))
				.put("editor", enumType(new String[] { "output", "checkbox", "rowindex", "inputbox", "maskeditor", "numbereditor", "combobox", "dateinput", "button" }))
				.put("width", type("integer", "Column width in image pixels, 0 if unknown"))
				.put("cellText", type("string", "Text in the first data cell, else empty")))
			.put("required", new JSONArray().put("header"));
		JSONObject region = object()
			.put("properties", new JSONObject()
				.put("type", enumType(new String[] { "title", "description", "sectionTitle", "search", "form", "grid", "tabs", "tree", "buttons", "textarea" }))
				.put("text", type("string", "Text of a title, description or sectionTitle region"))
				.put("title", type("string", "Heading attached to this grid, form or textarea, copied exactly, or empty"))
				.put("align", enumType(new String[] { "left", "right", "center" }))
				.put("side", enumType(new String[] { "", "left", "right" }))
				.put("columnsPerRow", type("integer", "Label and input pairs per row in a form"))
				.put("fields", array(field).put("description", "Label and input pairs of a search or form region"))
				.put("columns", array(column).put("description", "Required for every grid region: one entry per visible column header, left to right"))
				.put("buttons", array(type("string", "Button caption")))
				.put("tabs", array(type("string", "Tab header text"))))
			.put("required", new JSONArray().put("type"));
		return object()
			.put("properties", new JSONObject().put("screen", screen).put("regions", array(region)))
			.put("required", new JSONArray().put("screen").put("regions"));
	}

	/** Removes a keyword from every object in the schema tree. */
	private static void stripKey(JSONObject node, String keyword) {
		node.remove(keyword);
		for (String key : node.keySet().toArray(new String[0])) {
			Object value = node.get(key);
			if (value instanceof JSONObject) stripKey((JSONObject) value, keyword);
		}
	}

	private static JSONObject object() { return new JSONObject().put("type", "object"); }
	/**
	 * Do not add maxItems here. It would be the natural brake on runaway arrays, but this API rejects the
	 * schema with a bare 400 INVALID_ARGUMENT once it appears in this document (measured 2026-09-17; the
	 * same keyword is accepted in a smaller schema, so the rejection is not simply "unsupported keyword").
	 * Runaway output is bounded by exconverter.gemini.maxResponseChars instead, which is provider-independent.
	 */
	private static JSONObject array(JSONObject items) { return new JSONObject().put("type", "array").put("items", items); }
	private static JSONObject type(String type, String description) { return new JSONObject().put("type", type).put("description", description); }
	private static JSONObject enumType(String[] values) { return new JSONObject().put("type", "string").put("enum", new JSONArray(values)); }

	// ---------------------------------------------------------------- HTTP

	private HttpURLConnection open(String model, boolean stream, byte[] body) throws IOException {
		String method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
		URL url = new URL(baseUrl() + "/" + API_VERSION + "/models/" + model + ":" + method);
		String proxyHost = ExConverterConfig.get("exconverter.gemini.proxyHost", "");
		HttpURLConnection connection = (HttpURLConnection) (proxyHost.isEmpty() ? url.openConnection() : url.openConnection(new Proxy(Proxy.Type.HTTP, new InetSocketAddress(proxyHost, ExConverterConfig.getInt("exconverter.gemini.proxyPort", 8080)))));
		connection.setRequestMethod("POST");
		connection.setConnectTimeout(10000);
		connection.setReadTimeout(timeoutSeconds() * 1000);
		connection.setDoOutput(true);
		connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
		// Header form, not ?key=..., so the key never lands in an access log or a proxy trace.
		connection.setRequestProperty("x-goog-api-key", apiKey());
		connection.setFixedLengthStreamingMode(body.length);
		try (OutputStream output = connection.getOutputStream()) { output.write(body); }
		return connection;
	}

	/** 429/5xx and connection failures are retryable; 400/401/403/404 are not. */
	private InputStream openAndCheck(HttpURLConnection connection) throws IOException {
		int status;
		try { status = connection.getResponseCode(); }
		catch (IOException e) { throw new RetryableException("connection failed: " + e.getMessage(), 0, e); }
		if (status < 400) return connection.getInputStream();
		String raw = connection.getErrorStream() == null ? "" : new String(readAll(connection.getErrorStream()), StandardCharsets.UTF_8);
		String message = "Gemini API HTTP " + status;
		long retryAfterMs = 0;
		try {
			JSONObject error = errorOf(raw);
			if (error != null) {
				message += " " + error.optString("status", "") + ": " + error.optString("message", "");
				retryAfterMs = retryDelayMs(error);
			} else {
				message += ": " + raw;
			}
		} catch (Exception ignored) { message += ": " + raw; }
		// Older models (2.5 and earlier) reject thinkingLevel outright; retry once without any thinkingConfig
		// so switching exconverter.gemini.model does not also require changing the thinking setting.
		if (status == 400 && message.toLowerCase(java.util.Locale.ROOT).contains("thinking level is not supported")) throw new UnsupportedThinkingException(message);
		if (status == 429 || status == 408 || status == 409 || status >= 500) {
			if (retryAfterMs == 0) {
				try { String header = connection.getHeaderField("retry-after"); if (header != null) retryAfterMs = Long.parseLong(header.trim()) * 1000L; }
				catch (NumberFormatException ignored) { /* exponential backoff applies */ }
			}
			throw new RetryableException(message, retryAfterMs, null);
		}
		throw new IllegalStateException(message);
	}

	/** An error body is either {"error":{...}} or, from the non-SSE stream endpoint, [{"error":{...}}]. */
	private static JSONObject errorOf(String raw) {
		String text = raw == null ? "" : raw.trim();
		if (text.startsWith("[")) {
			JSONArray array = new JSONArray(text);
			return array.length() == 0 ? null : array.getJSONObject(0).optJSONObject("error");
		}
		if (text.startsWith("{")) return new JSONObject(text).optJSONObject("error");
		return null;
	}

	/** Quota errors carry a RetryInfo detail such as {"@type":"...RetryInfo","retryDelay":"37s"}. */
	private static long retryDelayMs(JSONObject error) {
		JSONArray details = error.optJSONArray("details");
		if (details == null) return 0;
		for (int i = 0; i < details.length(); i++) {
			JSONObject detail = details.optJSONObject(i);
			if (detail == null) continue;
			String delay = detail.optString("retryDelay", "");
			if (delay.endsWith("s")) {
				try { return (long) (Double.parseDouble(delay.substring(0, delay.length() - 1)) * 1000); }
				catch (NumberFormatException ignored) { /* fall through */ }
			}
		}
		return 0;
	}

	private ModelOutput requestOnce(String model, byte[] body) throws Exception {
		HttpURLConnection connection = open(model, false, body);
		ModelOutput output = new ModelOutput();
		output.model = model;
		JSONObject response = new JSONObject(new String(readAll(openAndCheck(connection)), StandardCharsets.UTF_8));
		StringBuilder text = new StringBuilder();
		partialText.set(text);
		readResponse(response, output, text);
		output.text = text.toString();
		return output;
	}

	/**
	 * alt=sse emits one `data:` line per chunk, each a partial GenerateContentResponse. Text arrives in
	 * candidates[0].content.parts[].text; finishReason and usageMetadata land on the last chunks.
	 */
	private ModelOutput streamOnce(String model, byte[] body, long started) throws Exception {
		HttpURLConnection connection = open(model, true, body);
		ModelOutput output = new ModelOutput();
		output.model = model;
		final StringBuilder text = new StringBuilder();
		partialText.set(text);
		final AtomicInteger chunks = new AtomicInteger();
		ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(r -> { Thread t = new Thread(r, "exconverter-gemini-heartbeat"); t.setDaemon(true); return t; });
		heartbeat.scheduleAtFixedRate(() -> {
			long elapsed = (System.currentTimeMillis() - started) / 1000;
			int n = chunks.get();
			if (n == 0) ProgressLog.step("Gemini 분석 중... {}s 경과 - 이미지 처리/추론 단계 (아직 응답 토큰 없음)", elapsed);
			else ProgressLog.step("Gemini 분석 중... {}s 경과 - UI-IR 생성 단계 ({}청크, {}자)", elapsed, n, text.length());
		}, 10, 10, TimeUnit.SECONDS);
		try (BufferedReader reader = new BufferedReader(new InputStreamReader(openAndCheck(connection), StandardCharsets.UTF_8))) {
			StringBuilder data = new StringBuilder();
			String line;
			while ((line = reader.readLine()) != null) {
				if (line.isEmpty()) {
					if (data.length() > 0) handleChunk(data.toString(), output, text, chunks, started);
					data.setLength(0);
					continue;
				}
				if (line.startsWith("data:")) { if (data.length() > 0) data.append('\n'); data.append(line.substring(5).trim()); }
				// `event:` and `:` comment lines carry nothing we need.
			}
			if (data.length() > 0) handleChunk(data.toString(), output, text, chunks, started);
		} finally {
			heartbeat.shutdownNow();
		}
		output.text = text.toString();
		return output;
	}

	private void handleChunk(String data, ModelOutput output, StringBuilder text, AtomicInteger chunks, long started) {
		if ("[DONE]".equals(data)) return;
		JSONObject chunk;
		try { chunk = new JSONObject(data); } catch (Exception e) { LOGGER.warn("Unparseable SSE data: {}", data); return; }
		JSONObject error = chunk.optJSONObject("error");
		if (error != null) {
			String status = error.optString("status", "");
			String message = status + ": " + error.optString("message", "");
			if ("UNAVAILABLE".equals(status) || "RESOURCE_EXHAUSTED".equals(status) || "INTERNAL".equals(status)) throw new RetryableException("stream error " + message, retryDelayMs(error), null);
			throw new IllegalStateException("Gemini stream error " + message);
		}
		int before = text.length();
		readResponse(chunk, output, text);
		if (text.length() > before && chunks.incrementAndGet() == 1) ProgressLog.step("Gemini 첫 응답 토큰 수신 ({}s) - UI-IR 생성 시작", (System.currentTimeMillis() - started) / 1000);
		int limit = maxResponseChars();
		if (text.length() > limit) throw new DegenerateOutputException("출력이 " + limit + "자를 넘어 중단(" + text.length() + "자, " + (System.currentTimeMillis() - started) / 1000 + "s). 정상 UI-IR 은 1만자 미만이므로 같은 구조를 반복 생성한 것입니다.");
	}

	/** The model rejected thinkingLevel; the caller retries once without any thinkingConfig. */
	static final class UnsupportedThinkingException extends RuntimeException {
		private static final long serialVersionUID = 1L;
		UnsupportedThinkingException(String message) { super(message); }
	}

	/**
	 * The call succeeded but the model produced garbage: a repetition loop, or output that ran past the token
	 * cap. Retried with a higher temperature rather than the identical request, which would loop again.
	 */
	static final class DegenerateOutputException extends RuntimeException {
		private static final long serialVersionUID = 1L;
		DegenerateOutputException(String message) { super(message); }
	}

	/** Shared reader for a full response and for one streamed chunk; both use the same field names. */
	private static void readResponse(JSONObject response, ModelOutput output, StringBuilder text) {
		output.model = response.optString("modelVersion", output.model);
		JSONObject promptFeedback = response.optJSONObject("promptFeedback");
		if (promptFeedback != null) output.blockReason = promptFeedback.optString("blockReason", output.blockReason);
		JSONObject usage = response.optJSONObject("usageMetadata");
		if (usage != null) {
			output.promptTokens = usage.optInt("promptTokenCount", output.promptTokens);
			output.outputTokens = usage.optInt("candidatesTokenCount", output.outputTokens);
			output.thoughtTokens = usage.optInt("thoughtsTokenCount", output.thoughtTokens);
			output.totalTokens = usage.optInt("totalTokenCount", output.totalTokens);
		}
		JSONArray candidates = response.optJSONArray("candidates");
		if (candidates == null || candidates.length() == 0) return;
		JSONObject candidate = candidates.getJSONObject(0);
		output.finishReason = candidate.optString("finishReason", output.finishReason);
		JSONObject content = candidate.optJSONObject("content");
		if (content == null) return;
		JSONArray parts = content.optJSONArray("parts");
		if (parts == null) return;
		for (int i = 0; i < parts.length(); i++) {
			JSONObject part = parts.getJSONObject(i);
			// Thinking models mark reasoning parts with "thought": true; those are not the answer.
			if (part.optBoolean("thought", false)) continue;
			text.append(part.optString("text", ""));
		}
	}

	static final class RetryableException extends RuntimeException {
		private static final long serialVersionUID = 1L;
		final long retryAfterMs;
		RetryableException(String message, long retryAfterMs, Throwable cause) { super(message, cause); this.retryAfterMs = retryAfterMs; }
	}

	// ---------------------------------------------------------------- prompt & image helpers

	static String loadPrompt() throws Exception {
		ClassLoader loader = GeminiUiIrAnalyzer.class.getClassLoader();
		try (InputStream input = loader.getResourceAsStream(PROMPT_RESOURCE)) {
			if (input != null) return new String(readAll(input), StandardCharsets.UTF_8);
		}
		try (InputStream input = loader.getResourceAsStream(FALLBACK_PROMPT_RESOURCE)) {
			if (input == null) throw new IllegalStateException("Prompt resource missing: " + PROMPT_RESOURCE);
			return new String(readAll(input), StandardCharsets.UTF_8);
		}
	}

	static final class EncodedImage {
		final byte[] bytes; final String mediaType; final int width; final int height;
		EncodedImage(byte[] bytes, String mediaType, int width, int height) { this.bytes = bytes; this.mediaType = mediaType; this.width = width; this.height = height; }
	}

	/** PNG keeps small UI text crisp; JPEG is only a fallback when PNG would make the request too large. */
	static EncodedImage encode(BufferedImage image) throws Exception {
		byte[] png = write(image, "png");
		if (png.length <= MAX_IMAGE_BYTES) return new EncodedImage(png, "image/png", image.getWidth(), image.getHeight());
		byte[] jpeg = write(image, "jpg");
		if (jpeg.length > MAX_IMAGE_BYTES) throw new IllegalArgumentException("Image is too large for one Gemini request even after downscaling; lower exconverter.gemini.maxImageSide");
		return new EncodedImage(jpeg, "image/jpeg", image.getWidth(), image.getHeight());
	}

	/** Gemini bills 258 tokens per 768x768 tile, so the tile count is the useful size signal in the log. */
	private static int tiles(BufferedImage image) {
		if (image.getWidth() <= 384 && image.getHeight() <= 384) return 1;
		return (int) (Math.ceil(image.getWidth() / 768.0) * Math.ceil(image.getHeight() / 768.0));
	}

	private static byte[] write(BufferedImage image, String format) throws Exception {
		ByteArrayOutputStream output = new ByteArrayOutputStream();
		if (!ImageIO.write(image, format, output)) throw new IllegalStateException("No ImageIO writer for " + format);
		return output.toByteArray();
	}

	static BufferedImage downscale(BufferedImage source, int maxSide) {
		int longest = Math.max(source.getWidth(), source.getHeight());
		double scale = longest > maxSide ? maxSide / (double) longest : 1.0;
		int w = (int) Math.round(source.getWidth() * scale);
		int h = (int) Math.round(source.getHeight() * scale);
		BufferedImage target = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
		Graphics2D g = target.createGraphics();
		g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
		g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
		g.setColor(java.awt.Color.WHITE);
		g.fillRect(0, 0, w, h);
		g.drawImage(source, 0, 0, w, h, null);
		g.dispose();
		return target;
	}

	private static byte[] readAll(InputStream input) throws IOException {
		try (InputStream in = input) { return in.readAllBytes(); }
	}

	private static String baseName(String name) {
		String n = name == null ? "" : name.replace('\\', '/');
		n = n.substring(n.lastIndexOf('/') + 1).replaceFirst("\\.[^.]+$", "").trim();
		return n.isEmpty() ? "생성 화면" : n;
	}

	private static String valueOf(String value) { return value == null ? "" : value.trim(); }
}
