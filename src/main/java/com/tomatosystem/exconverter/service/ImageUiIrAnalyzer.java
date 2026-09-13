package com.tomatosystem.exconverter.service;

import com.tomatosystem.exconverter.model.UiIr;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.util.Base64;
import javax.imageio.ImageIO;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

/**
 * Image-to-UI-IR adapter. Configure -Dexconverter.vision.command with a local
	 * PaddleOCR/Ollama bridge executable to obtain semantic UI-IR. Alternatively,
	 * configure exconverter.ollama.model for a local Qwen3-VL Ollama model. Without it the
 * safe fallback creates a clearly marked structural SEARCH_GRID draft.
 */
@Service
public class ImageUiIrAnalyzer {
	public Analysis analyze(File image) {
		try {
			BufferedImage buffered = ImageIO.read(image);
			if (buffered == null) throw new IllegalArgumentException("Only decodable image files are supported");
			if (buffered.getWidth() > 10000 || buffered.getHeight() > 10000) throw new IllegalArgumentException("Image dimensions exceed 10000px");
			String command = System.getProperty("exconverter.vision.command", "").trim();
			if (!command.isEmpty()) return new Analysis(runLocalVision(command, image), "local-vision", buffered.getWidth(), buffered.getHeight());
			String ollamaModel = System.getProperty("exconverter.ollama.model", "").trim();
			if (!ollamaModel.isEmpty()) return new Analysis(runOllamaVision(ollamaModel, image), "ollama-vision", buffered.getWidth(), buffered.getHeight());
			return new Analysis(createStructuralDraft(image.getName(), buffered.getWidth(), buffered.getHeight()), "structural-fallback", buffered.getWidth(), buffered.getHeight());
		} catch (IllegalArgumentException e) { throw e; } catch (Exception e) { throw new IllegalStateException("Image analysis failed", e); }
	}
	private UiIr runLocalVision(String command, File image) throws Exception {
		Process process = new ProcessBuilder(command, image.getAbsolutePath()).redirectErrorStream(true).start();
		String json = new String(process.getInputStream().readAllBytes(), "UTF-8");
		if (process.waitFor() != 0) throw new IllegalStateException("Local vision command failed: " + json);
		return UiIrParser.parse(json);
	}
	private UiIr runOllamaVision(String model, File image) throws Exception {
		String endpoint = System.getProperty("exconverter.ollama.url", "http://127.0.0.1:11434/api/generate");
		JSONObject request = new JSONObject(); request.put("model", model); request.put("stream", false);
		request.put("prompt", "Analyze this eXBuilder6 screen design. Return ONLY valid UI-IR JSON with screen{name,width,height} and regions. Include a search region with fields[{label,component,required}] when present and a grid region with columns. Use component values inputbox, dateinput, combobox, searchinput, button, grid.");
		request.put("images", new org.json.JSONArray().put(Base64.getEncoder().encodeToString(Files.readAllBytes(image.toPath()))));
		HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection(); connection.setRequestMethod("POST"); connection.setConnectTimeout(5000); connection.setReadTimeout(120000); connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
		try (OutputStream output = connection.getOutputStream()) { output.write(request.toString().getBytes("UTF-8")); }
		int status = connection.getResponseCode(); java.io.InputStream responseStream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
		if (responseStream == null) throw new IllegalStateException("Ollama returned HTTP " + status);
		String response; try (java.io.InputStream input = responseStream) { response = new String(input.readAllBytes(), "UTF-8"); }
		if (status >= 400) throw new IllegalStateException("Ollama returned HTTP " + status + ": " + response);
		String uiIrJson = new JSONObject(response).getString("response").trim();
		if (uiIrJson.startsWith("```")) { int firstNewline = uiIrJson.indexOf('\n'); int lastFence = uiIrJson.lastIndexOf("```"); uiIrJson = firstNewline >= 0 && lastFence > firstNewline ? uiIrJson.substring(firstNewline + 1, lastFence).trim() : uiIrJson; }
		return UiIrParser.parse(uiIrJson);
	}
	private UiIr createStructuralDraft(String name, int width, int height) {
		UiIr ir = new UiIr(); ir.setScreenName(name.replaceFirst("\\.[^.]+$", "") + " 화면"); ir.setWidth(Math.max(1024, width)); ir.setHeight(Math.max(580, height));
		ir.getSearchFields().add(new UiIr.Field("조회 조건", "inputbox", false));
		ir.getGridColumns().add("번호"); ir.getGridColumns().add("항목 1"); ir.getGridColumns().add("항목 2"); ir.getGridColumns().add("항목 3"); ir.getGridColumns().add("비고");
		return ir;
	}
	public static class Analysis {
		private final UiIr uiIr; private final String mode; private final int width; private final int height;
		Analysis(UiIr uiIr, String mode, int width, int height) { this.uiIr = uiIr; this.mode = mode; this.width = width; this.height = height; }
		public UiIr getUiIr() { return uiIr; } public String getMode() { return mode; } public int getWidth() { return width; } public int getHeight() { return height; }
	}
}
