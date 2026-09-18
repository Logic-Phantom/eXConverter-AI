package com.tomatosystem.exconverter.web;

import com.tomatosystem.exconverter.service.ExConverterConfig;
import com.tomatosystem.exconverter.service.GeminiLiteUiIrAnalyzer;
import com.tomatosystem.exconverter.service.GenerationService;
import com.tomatosystem.exconverter.service.ImageUiIrAnalyzer;
import com.tomatosystem.exconverter.service.ProgressLog;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Iterator;
import java.util.UUID;
import javax.servlet.http.HttpServletResponse;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

/**
 * gemini-3.5-flash-lite twin of {@link GeminiConversionController}. Same multipart contract and response JSON
 * (engine = "gemini-lite"), so an eXBuilder6 Submission only needs a different action URL:
 *
 * <pre>
 *   POST /EXConverter/gemini-lite/uploadAndGenerate.do   multipart/form-data, first file part = image
 *   GET  /EXConverter/gemini-lite/status.do              {configured, model, ...}
 * </pre>
 *
 * The gemini-3.5-flash endpoint (/EXConverter/gemini/...) and the local Ollama endpoint are unchanged.
 */
@Controller
@RequestMapping("/EXConverter/gemini-lite")
public class GeminiLiteConversionController {
	private static final long MAX_IMAGE_BYTES = 20L * 1024L * 1024L;
	private static final Logger LOGGER = LoggerFactory.getLogger(GeminiLiteConversionController.class);
	private static final String ENGINE = GeminiLiteUiIrAnalyzer.ENGINE;
	@Autowired private GeminiLiteUiIrAnalyzer liteAnalyzer;
	@Autowired private GenerationService generationService;

	@RequestMapping(value = "/status.do", method = { RequestMethod.GET, RequestMethod.POST }, produces = "application/json;charset=UTF-8")
	public void status(HttpServletResponse response) throws IOException {
		write(response, GeminiLiteUiIrAnalyzer.describe().toString());
	}

	@RequestMapping(value = "/uploadAndGenerate.do", method = RequestMethod.POST, produces = "application/json;charset=UTF-8")
	public void uploadAndGenerate(MultipartHttpServletRequest request, HttpServletResponse response) throws IOException {
		try {
			if (!GeminiLiteUiIrAnalyzer.isConfigured()) {
				response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
				write(response, new JSONObject().put("engine", ENGINE).put("error", "Gemini API key is not configured (exconverter.gemini.apiKey or GEMINI_API_KEY)").toString());
				return;
			}
			MultipartFile file = firstUploadedFile(request);
			if (file == null || file.isEmpty()) throw new IllegalArgumentException("An image file is required");
			if (file.getSize() > MAX_IMAGE_BYTES) throw new IllegalArgumentException("Image must not exceed 20 MB");
			String originalName = file.getOriginalFilename();
			if (originalName == null || originalName.trim().isEmpty()) originalName = file.getName();
			long started = System.currentTimeMillis();
			File upload = save(file);
			ProgressLog.step("===== [Gemini-Lite] 설계서 → CLX 변환 시작: {} ({} KB, model={}) =====", originalName, file.getSize() / 1024, GeminiLiteUiIrAnalyzer.model());
			ImageUiIrAnalyzer.Analysis analysis = liteAnalyzer.analyze(upload, originalName);
			GenerationService.GenerationResult generated = generationService.generate(analysis.getUiIr(), originalName, analysis.getRawJson());
			long elapsed = (System.currentTimeMillis() - started) / 1000;
			ProgressLog.step("===== [Gemini-Lite] 변환 완료: 총 {}s, 분석모드={} =====", elapsed, analysis.getMode());
			JSONObject body = new JSONObject();
			body.put("id", generated.getId());
			body.put("engine", ENGINE);
			body.put("templateId", generated.getTemplateId());
			body.put("analysisMode", analysis.getMode());
			body.put("image", new JSONObject().put("width", analysis.getWidth()).put("height", analysis.getHeight()));
			body.put("regions", ImageConversionController.summarize(analysis.getUiIr()));
			body.put("warnings", new JSONArray(generated.getWarnings()));
			body.put("usage", liteAnalyzer.lastUsage());
			body.put("elapsedSeconds", elapsed);
			body.put("saved", new JSONObject().put("directory", generated.getFile().getParent()).put("clx", generated.getFile().getAbsolutePath()).put("js", generated.getJsFile().getAbsolutePath()));
			response.setStatus(HttpServletResponse.SC_CREATED);
			write(response, body.toString());
		} catch (IllegalArgumentException e) {
			ProgressLog.step("===== [Gemini-Lite] 변환 실패(400): {} =====", e.getMessage());
			response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
			write(response, new JSONObject().put("engine", ENGINE).put("error", String.valueOf(e.getMessage())).toString());
		} catch (Exception e) {
			ProgressLog.step("===== [Gemini-Lite] 변환 실패: {} =====", e.getMessage());
			LOGGER.error("Gemini-Lite image-to-CLX generation failed", e);
			response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
			write(response, new JSONObject().put("engine", ENGINE).put("error", String.valueOf(e.getMessage())).toString());
		}
	}

	/** eXBuilder6 uses the original file name as the multipart field name, so take the first real file part. */
	private MultipartFile firstUploadedFile(MultipartHttpServletRequest request) {
		Iterator<String> names = request.getFileNames();
		while (names.hasNext()) { MultipartFile candidate = request.getFile(names.next()); if (candidate != null && !candidate.isEmpty()) return candidate; }
		return null;
	}

	private File save(MultipartFile source) throws IOException {
		File dir = new File(ExConverterConfig.get("exconverter.generated.root", "generated"), "uploads");
		if (!dir.exists() && !dir.mkdirs()) throw new IOException("Cannot create upload directory");
		File target = new File(dir, UUID.randomUUID().toString() + ".img");
		try (InputStream input = source.getInputStream()) { Files.copy(input, target.toPath(), StandardCopyOption.REPLACE_EXISTING); }
		return target;
	}

	private void write(HttpServletResponse response, String value) throws IOException { response.setContentType("application/json;charset=UTF-8"); response.getWriter().write(value); }
}
