package com.tomatosystem.exconverter.web;

import com.tomatosystem.exconverter.model.UiIr;
import com.tomatosystem.exconverter.service.ExConverterConfig;
import com.tomatosystem.exconverter.service.GenerationService;
import com.tomatosystem.exconverter.service.ImageUiIrAnalyzer;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import javax.servlet.http.HttpServletResponse;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Multipart endpoint for PNG/JPEG screen designs. */
@Controller
@RequestMapping("/EXConverter")
public class ImageConversionController {
	private static final long MAX_IMAGE_BYTES = 20L * 1024L * 1024L;
	private static final Logger LOGGER = LoggerFactory.getLogger(ImageConversionController.class);
	@Autowired private ImageUiIrAnalyzer imageAnalyzer;
	@Autowired private GenerationService generationService;
	@RequestMapping(value = "/uploadAndGenerate.do", method = RequestMethod.POST, produces = "application/json;charset=UTF-8")
	public void uploadAndGenerate(MultipartHttpServletRequest request, HttpServletResponse response) throws IOException {
		try {
			MultipartFile file = firstUploadedFile(request);
			if (file == null || file.isEmpty()) throw new IllegalArgumentException("An image file is required");
			if (file.getSize() > MAX_IMAGE_BYTES) throw new IllegalArgumentException("Image must not exceed 20 MB");
			String originalName = file.getOriginalFilename();
			if (originalName == null || originalName.trim().isEmpty()) originalName = file.getName();
			long started = System.currentTimeMillis();
			File upload = save(file);
			com.tomatosystem.exconverter.service.ProgressLog.step("===== 설계서 → CLX 변환 시작: {} ({} KB) =====", originalName, file.getSize() / 1024);
			ImageUiIrAnalyzer.Analysis analysis = imageAnalyzer.analyze(upload, originalName);
			GenerationService.GenerationResult generated = generationService.generate(analysis.getUiIr(), originalName, analysis.getRawJson());
			com.tomatosystem.exconverter.service.ProgressLog.step("===== 변환 완료: 총 {}s, 분석모드={} =====", (System.currentTimeMillis() - started) / 1000, analysis.getMode());
			JSONObject body = new JSONObject();
			body.put("id", generated.getId());
			body.put("templateId", generated.getTemplateId());
			body.put("analysisMode", analysis.getMode());
			body.put("image", new JSONObject().put("width", analysis.getWidth()).put("height", analysis.getHeight()));
			body.put("regions", summarize(analysis.getUiIr()));
			body.put("warnings", new JSONArray(generated.getWarnings()));
			body.put("saved", new JSONObject().put("directory", generated.getFile().getParent()).put("clx", generated.getFile().getAbsolutePath()).put("js", generated.getJsFile().getAbsolutePath()));
			response.setStatus(HttpServletResponse.SC_CREATED);
			write(response, body.toString());
		} catch (IllegalArgumentException e) { response.setStatus(HttpServletResponse.SC_BAD_REQUEST); write(response, new JSONObject().put("error", String.valueOf(e.getMessage())).toString()); }
		catch (Exception e) { com.tomatosystem.exconverter.service.ProgressLog.step("===== 변환 실패: {} =====", e.getMessage()); LOGGER.error("Image-to-CLX generation failed", e); response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR); write(response, new JSONObject().put("error", String.valueOf(e.getMessage())).toString()); }
	}

	/** Compact view of what the analyzer recognised, so the caller can see why the CLX looks the way it does. */
	static JSONArray summarize(UiIr ir) {
		JSONArray regions = new JSONArray();
		for (UiIr.Region region : ir.getRegions()) {
			JSONObject r = new JSONObject().put("type", region.getType());
			if (!region.getFields().isEmpty()) { JSONArray f = new JSONArray(); for (UiIr.Field field : region.getFields()) f.put(field.getLabel() + ":" + field.getComponent()); r.put("fields", f); }
			if (!region.getColumns().isEmpty()) { JSONArray c = new JSONArray(); for (UiIr.Column column : region.getColumns()) c.put(column.getHeader() + ":" + column.getEditor()); r.put("columns", c); }
			if (!region.getButtons().isEmpty()) r.put("buttons", new JSONArray(region.getButtons()));
			regions.put(r);
		}
		return regions;
	}

	/** eXBuilder6 uses the original file name as the multipart field name. */
	private MultipartFile firstUploadedFile(MultipartHttpServletRequest request) {
		java.util.Iterator<String> names = request.getFileNames();
		while (names.hasNext()) { MultipartFile candidate = request.getFile(names.next()); if (candidate != null && !candidate.isEmpty()) return candidate; }
		return null;
	}
	private File save(MultipartFile source) throws IOException {
		File dir = new File(ExConverterConfig.get("exconverter.generated.root", "generated"), "uploads"); if (!dir.exists() && !dir.mkdirs()) throw new IOException("Cannot create upload directory");
		File target = new File(dir, UUID.randomUUID().toString() + ".img");
		try (InputStream input = source.getInputStream()) { Files.copy(input, target.toPath(), StandardCopyOption.REPLACE_EXISTING); }
		return target;
	}
	private void write(HttpServletResponse response, String value) throws IOException { response.setContentType("application/json;charset=UTF-8"); response.getWriter().write(value); }
}
