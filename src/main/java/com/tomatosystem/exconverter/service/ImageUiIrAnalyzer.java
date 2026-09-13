package com.tomatosystem.exconverter.service;

import com.tomatosystem.exconverter.model.UiIr;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.imageio.ImageIO;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Image-to-UI-IR adapter. Order of preference:
 * 1. exconverter.vision.command: local bridge (e.g. PaddleOCR + Qwen3-VL) printing UI-IR JSON.
 * 2. Local Ollama vision model (exconverter.ollama.model, or the first installed *-vl model).
 * 3. Structural fallback when no local AI is reachable (clearly reported as such).
 */
@Service
public class ImageUiIrAnalyzer {
	private static final Logger LOGGER = LoggerFactory.getLogger(ImageUiIrAnalyzer.class);
	private static final String PROMPT_RESOURCE = "exconverter/prompts/vision-ui-ir.txt";

	public Analysis analyze(File image) {
		return analyze(image, image.getName());
	}

	public Analysis analyze(File image, String originalName) {
		try {
			BufferedImage buffered = ImageIO.read(image);
			if (buffered == null) throw new IllegalArgumentException("Only decodable image files are supported");
			if (buffered.getWidth() > 10000 || buffered.getHeight() > 10000) throw new IllegalArgumentException("Image dimensions exceed 10000px");
			ProgressLog.step("이미지 확인: {} ({}x{})", originalName, buffered.getWidth(), buffered.getHeight());
			String command = ExConverterConfig.get("exconverter.vision.command", "");
			if (!command.isEmpty()) {
				String json = runLocalVision(command, image);
				return new Analysis(finish(UiIrParser.parse(json), originalName, buffered.getWidth()), "local-vision", buffered.getWidth(), buffered.getHeight(), json);
			}
			String baseUrl = ollamaBaseUrl();
			String model = ExConverterConfig.get("exconverter.ollama.model", "");
			if (model.isEmpty()) model = detectVisionModel(baseUrl);
			if (!model.isEmpty()) {
				BufferedImage scaled = downscale(buffered, ExConverterConfig.getInt("exconverter.vision.maxImageSide", 1280));
				String json = runOllamaVision(baseUrl, model, scaled);
				UiIr ir = UiIrParser.parse(json);
				return new Analysis(finish(ir, originalName, scaled.getWidth()), "ollama:" + model, buffered.getWidth(), buffered.getHeight(), json);
			}
			ProgressLog.step("경고: 로컬 비전 AI를 찾지 못해 임시(placeholder) UI-IR로 생성합니다. Ollama 실행/모델 설치를 확인하세요: {}", baseUrl);
			UiIr draft = createStructuralDraft(originalName);
			draft.getWarnings().add("No local vision AI reachable at " + baseUrl + "; placeholder UI-IR was used. Start Ollama with a *-vl model or set exconverter.ollama.model.");
			return new Analysis(draft, "structural-fallback", buffered.getWidth(), buffered.getHeight(), "");
		} catch (IllegalArgumentException e) {
			throw e;
		} catch (Exception e) {
			throw new IllegalStateException("Image analysis failed: " + e.getMessage(), e);
		}
	}

	private UiIr finish(UiIr ir, String originalName, int sourceWidth) {
		if (ir.getSourceWidth() <= 0) ir.setSourceWidth(sourceWidth);
		if ("생성 화면".equals(ir.getScreenName())) ir.setScreenName(baseName(originalName));
		return ir;
	}

	private String runLocalVision(String command, File image) throws Exception {
		Process process = new ProcessBuilder(command, image.getAbsolutePath()).redirectErrorStream(true).start();
		String json = new String(readAll(process.getInputStream()), StandardCharsets.UTF_8);
		if (process.waitFor() != 0) throw new IllegalStateException("Local vision command failed: " + json);
		return json;
	}

	private String ollamaBaseUrl() {
		String url = ExConverterConfig.get("exconverter.ollama.url", "http://127.0.0.1:11434").replaceAll("/+$", "");
		return url.endsWith("/api/generate") ? url.substring(0, url.length() - "/api/generate".length()) : url;
	}

	/** Picks an installed vision-capable model so a fresh Ollama install works without configuration. */
	private String detectVisionModel(String baseUrl) {
		try {
			HttpURLConnection connection = (HttpURLConnection) new URL(baseUrl + "/api/tags").openConnection();
			connection.setConnectTimeout(2000);
			connection.setReadTimeout(5000);
			if (connection.getResponseCode() != 200) return "";
			JSONArray models = new JSONObject(new String(readAll(connection.getInputStream()), StandardCharsets.UTF_8)).optJSONArray("models");
			if (models == null) return "";
			for (int i = 0; i < models.length(); i++) {
				JSONObject model = models.getJSONObject(i);
				String name = model.optString("name", "");
				JSONArray capabilities = model.optJSONArray("capabilities");
				boolean vision = capabilities != null && capabilities.toList().contains("vision");
				if (vision || name.toLowerCase().contains("-vl") || name.toLowerCase().contains("llava")) {
					ProgressLog.step("Ollama 비전 모델 자동 선택: {}", name);
					return name;
				}
			}
		} catch (ConnectException e) {
			LOGGER.warn("Ollama is not reachable at {}", baseUrl);
		} catch (Exception e) {
			LOGGER.warn("Ollama model detection failed: {}", e.getMessage());
		}
		return "";
	}

	private String runOllamaVision(String baseUrl, String model, BufferedImage image) throws Exception {
		JSONObject request = new JSONObject();
		request.put("model", model);
		request.put("stream", true);
		request.put("think", false);
		request.put("format", "json");
		request.put("keep_alive", "30m");
		request.put("prompt", loadPrompt());
		request.put("images", new JSONArray().put(Base64.getEncoder().encodeToString(png(image))));
		JSONObject options = new JSONObject();
		options.put("temperature", 0);
		options.put("num_ctx", ExConverterConfig.getInt("exconverter.ollama.numCtx", 8192));
		options.put("num_predict", 3000);
		request.put("options", options);
		HttpURLConnection connection = (HttpURLConnection) new URL(baseUrl + "/api/generate").openConnection();
		connection.setRequestMethod("POST");
		connection.setConnectTimeout(5000);
		connection.setReadTimeout(ExConverterConfig.getInt("exconverter.ollama.timeoutSeconds", 1800) * 1000);
		connection.setDoOutput(true);
		connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
		final long started = System.currentTimeMillis();
		ProgressLog.step("AI 분석 시작: model={}, 전송 이미지 {}x{} (CPU 위주 PC는 수 분~10분 이상 소요)", model, image.getWidth(), image.getHeight());
		final StringBuilder response = new StringBuilder();
		final StringBuilder thinking = new StringBuilder();
		final java.util.concurrent.atomic.AtomicInteger tokens = new java.util.concurrent.atomic.AtomicInteger();
		// Heartbeat: before the first token the model is encoding the image, which alone can take minutes.
		java.util.concurrent.ScheduledExecutorService heartbeat = java.util.concurrent.Executors.newSingleThreadScheduledExecutor(r -> { Thread t = new Thread(r, "exconverter-ai-heartbeat"); t.setDaemon(true); return t; });
		heartbeat.scheduleAtFixedRate(() -> {
			long elapsed = (System.currentTimeMillis() - started) / 1000;
			int n = tokens.get();
			if (n == 0) ProgressLog.step("AI 분석 중... {}s 경과 - 이미지/프롬프트 처리 단계 (아직 응답 토큰 없음)", elapsed);
			else ProgressLog.step("AI 분석 중... {}s 경과 - UI-IR 생성 단계 ({}토큰, 보통 1,000~2,000토큰)", elapsed, n);
		}, 15, 15, java.util.concurrent.TimeUnit.SECONDS);
		try {
			try (OutputStream output = connection.getOutputStream()) { output.write(request.toString().getBytes(StandardCharsets.UTF_8)); }
			int status = connection.getResponseCode();
			InputStream responseStream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
			if (responseStream == null) throw new IllegalStateException("Ollama returned HTTP " + status);
			if (status >= 400) throw new IllegalStateException("Ollama returned HTTP " + status + ": " + new String(readAll(responseStream), StandardCharsets.UTF_8));
			try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(responseStream, StandardCharsets.UTF_8))) {
				String line;
				while ((line = reader.readLine()) != null) {
					if (line.trim().isEmpty()) continue;
					JSONObject chunk = new JSONObject(line);
					if (chunk.has("error")) throw new IllegalStateException("Ollama error: " + chunk.optString("error"));
					response.append(chunk.optString("response", ""));
					// qwen3-vl on Ollama may put the whole JSON answer in "thinking" even with think=false.
					thinking.append(chunk.optString("thinking", ""));
					if (tokens.incrementAndGet() == 1) ProgressLog.step("AI 첫 응답 토큰 수신 ({}s) - UI-IR 생성 시작", (System.currentTimeMillis() - started) / 1000);
					if (chunk.optBoolean("done", false)) {
						ProgressLog.step("AI 분석 완료: {}s, 입력 {}토큰, 출력 {}토큰, 종료사유={}", (System.currentTimeMillis() - started) / 1000, chunk.optInt("prompt_eval_count"), chunk.optInt("eval_count"), chunk.optString("done_reason"));
					}
				}
			}
		} finally {
			heartbeat.shutdownNow();
		}
		String uiIrJson = response.toString().trim();
		if (uiIrJson.isEmpty()) uiIrJson = thinking.toString().trim();
		if (uiIrJson.isEmpty()) throw new IllegalStateException("Ollama returned an empty response");
		return uiIrJson;
	}

	private String loadPrompt() throws Exception {
		try (InputStream input = getClass().getClassLoader().getResourceAsStream(PROMPT_RESOURCE)) {
			if (input == null) throw new IllegalStateException("Prompt resource missing: " + PROMPT_RESOURCE);
			return new String(readAll(input), StandardCharsets.UTF_8);
		}
	}

	private static BufferedImage downscale(BufferedImage source, int maxSide) {
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

	private static byte[] png(BufferedImage image) throws Exception {
		ByteArrayOutputStream output = new ByteArrayOutputStream();
		ImageIO.write(image, "png", output);
		return output.toByteArray();
	}

	private static byte[] readAll(InputStream input) throws Exception {
		try (InputStream in = input) { return in.readAllBytes(); }
	}

	private UiIr createStructuralDraft(String originalName) {
		UiIr ir = new UiIr();
		ir.setScreenName(baseName(originalName));
		ir.setWidth(1440);
		ir.setHeight(860);
		UiIr.Region search = new UiIr.Region(UiIr.SEARCH);
		search.getFields().add(new UiIr.Field("조회 조건", "inputbox", false));
		search.getButtons().add("초기화");
		search.getButtons().add("조회");
		ir.getRegions().add(search);
		UiIr.Region grid = new UiIr.Region(UiIr.GRID);
		for (String header : new String[] { "번호", "항목 1", "항목 2", "항목 3", "비고" }) grid.getColumns().add(new UiIr.Column(header, "번호".equals(header) ? "rowindex" : "output", 0, ""));
		ir.getRegions().add(grid);
		return ir;
	}

	private static String baseName(String name) {
		String n = name == null ? "" : name.replace('\\', '/');
		n = n.substring(n.lastIndexOf('/') + 1).replaceFirst("\\.[^.]+$", "").trim();
		return n.isEmpty() ? "생성 화면" : n;
	}

	public static class Analysis {
		private final UiIr uiIr; private final String mode; private final int width; private final int height; private final String rawJson;
		Analysis(UiIr uiIr, String mode, int width, int height, String rawJson) { this.uiIr = uiIr; this.mode = mode; this.width = width; this.height = height; this.rawJson = rawJson; }
		public UiIr getUiIr() { return uiIr; } public String getMode() { return mode; } public int getWidth() { return width; } public int getHeight() { return height; }
		public String getRawJson() { return rawJson; }
	}
}
