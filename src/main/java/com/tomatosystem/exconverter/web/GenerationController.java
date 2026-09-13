package com.tomatosystem.exconverter.web;

import com.tomatosystem.exconverter.model.UiIr;
import com.tomatosystem.exconverter.service.GenerationService;
import com.tomatosystem.exconverter.service.UiIrParser;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

@Controller
@RequestMapping("/api/exconverter")
public class GenerationController {
	@Autowired private GenerationService generationService;
	@RequestMapping(value = "/generate.do", method = RequestMethod.POST, produces = "application/json;charset=UTF-8")
	public void generate(HttpServletRequest request, HttpServletResponse response) throws IOException {
		try { UiIr ir = UiIrParser.parse(new String(request.getInputStream().readAllBytes(), StandardCharsets.UTF_8)); GenerationService.GenerationResult result = generationService.generate(ir); response.setStatus(HttpServletResponse.SC_CREATED); writeJson(response, "{\"id\":\"" + result.getId() + "\",\"templateId\":\"" + escape(result.getTemplateId()) + "\",\"downloadUrl\":\"" + request.getContextPath() + "/api/exconverter/download.do?id=" + result.getId() + "\"}"); }
		catch (IllegalArgumentException e) { response.setStatus(HttpServletResponse.SC_BAD_REQUEST); writeJson(response, "{\"error\":\"" + escape(e.getMessage()) + "\"}"); }
		catch (Exception e) { response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR); writeJson(response, "{\"error\":\"" + escape(e.getMessage()) + "\"}"); }
	}
	@RequestMapping(value = "/download.do", method = RequestMethod.GET)
	public void download(HttpServletRequest request, HttpServletResponse response) throws IOException {
		File file = generationService.find(request.getParameter("id")); if (!file.isFile()) { response.sendError(HttpServletResponse.SC_NOT_FOUND); return; }
		response.setContentType("application/xml"); response.setHeader("Content-Disposition", "attachment; filename=generated.clx"); response.setContentLengthLong(file.length()); Files.copy(file.toPath(), response.getOutputStream());
	}
	private void writeJson(HttpServletResponse response, String body) throws IOException { response.setContentType("application/json;charset=UTF-8"); response.getWriter().write(body); }
	private String escape(String text) { return text == null ? "Unexpected error" : text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " "); }
}
