package com.tomatosystem.exconverter.web;

import com.tomatosystem.exconverter.service.GenerationService;
import com.tomatosystem.exconverter.service.ImageUiIrAnalyzer;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
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
			File upload = save(file); ImageUiIrAnalyzer.Analysis analysis = imageAnalyzer.analyze(upload); GenerationService.GenerationResult generated = generationService.generate(analysis.getUiIr());
			response.setStatus(HttpServletResponse.SC_CREATED); write(response, "{\"id\":\"" + generated.getId() + "\",\"templateId\":\"" + escape(generated.getTemplateId()) + "\",\"analysisMode\":\"" + analysis.getMode() + "\",\"image\":{\"width\":" + analysis.getWidth() + ",\"height\":" + analysis.getHeight() + "},\"downloadUrl\":\"" + request.getContextPath() + "/api/exconverter/download.do?id=" + generated.getId() + "\"}");
		} catch (IllegalArgumentException e) { response.setStatus(HttpServletResponse.SC_BAD_REQUEST); write(response, "{\"error\":\"" + escape(e.getMessage()) + "\"}"); }
		catch (Exception e) { LOGGER.error("Image-to-CLX generation failed", e); response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR); write(response, "{\"error\":\"" + escape(e.getMessage()) + "\"}"); }
	}
	/** eXBuilder6 uses the original file name as the multipart field name. */
	private MultipartFile firstUploadedFile(MultipartHttpServletRequest request) {
		java.util.Iterator<String> names = request.getFileNames();
		while (names.hasNext()) { MultipartFile candidate = request.getFile(names.next()); if (candidate != null && !candidate.isEmpty()) return candidate; }
		return null;
	}
	private File save(MultipartFile source) throws IOException {
		File dir = new File(System.getProperty("exconverter.generated.root", "generated"), "uploads"); if (!dir.exists() && !dir.mkdirs()) throw new IOException("Cannot create upload directory");
		File target = new File(dir, UUID.randomUUID().toString() + ".img");
		try (InputStream input = source.getInputStream()) { Files.copy(input, target.toPath(), StandardCopyOption.REPLACE_EXISTING); }
		return target;
	}
	private void write(HttpServletResponse response, String value) throws IOException { response.setContentType("application/json;charset=UTF-8"); response.getWriter().write(value); }
	private String escape(String value) { return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", " ").replace("\n", " "); }
}
