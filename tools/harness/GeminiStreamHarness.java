import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.tomatosystem.exconverter.model.UiIr;
import com.tomatosystem.exconverter.service.ClxGenerator;
import com.tomatosystem.exconverter.service.ClxValidator;
import com.tomatosystem.exconverter.service.GeminiUiIrAnalyzer;
import com.tomatosystem.exconverter.service.ImageUiIrAnalyzer;
import com.tomatosystem.exconverter.service.TemplateCatalog;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import javax.imageio.ImageIO;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Offline check of the Gemini engine. Starts a fake generativelanguage API on 18436 that replays a UI-IR
 * sample as an SSE stream, or as a single JSON body when the caller used :generateContent, then runs
 * GeminiUiIrAnalyzer against it and generates and validates CLX. No API key and no network needed.
 *
 * It also prints back what the analyzer actually sent, which is the point of the harness: the endpoint path,
 * the x-goog-api-key header, the systemInstruction length, the inline_data mime type, and whether a
 * responseSchema was attached.
 *
 * Usage:
 *   java -Dexconverter.gemini.url=http://127.0.0.1:18436 -Dexconverter.gemini.apiKey=test
 *        -cp "out;&lt;libs&gt;;src\main\resources" GeminiStreamHarness &lt;ui-ir.json&gt; [image.png] [out.clx]
 */
public class GeminiStreamHarness {
	public static void main(String[] args) throws Exception {
		String uiIr = new String(Files.readAllBytes(new File(args[0]).toPath()), StandardCharsets.UTF_8);
		File image = args.length > 1 ? new File(args[1]) : syntheticImage();
		File out = new File(args.length > 2 ? args[2] : "gemini-stream-harness.clx");
		HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 18436), 0);
		server.createContext("/v1beta", exchange -> serve(exchange, uiIr));
		server.start();
		try {
			ImageUiIrAnalyzer.Analysis analysis = new GeminiUiIrAnalyzer().analyze(image, image.getName());
			UiIr ir = analysis.getUiIr();
			System.out.println("mode=" + analysis.getMode() + " regions=" + ir.getRegions().size() + " warnings=" + ir.getWarnings());
			TemplateCatalog.TemplateMatch match = new TemplateCatalog().selectFor(ir);
			byte[] clx = new ClxGenerator().generate(match.getFile(), ir);
			System.out.println("template=" + match.getId() + " validation errors=" + ClxValidator.validate(clx));
			Files.write(out.toPath(), clx);
			System.out.println("clx=" + out.getAbsolutePath() + " (" + clx.length + " bytes)");
		} finally {
			server.stop(0);
		}
	}

	private static void serve(HttpExchange exchange, String uiIr) throws java.io.IOException {
		JSONObject request = new JSONObject(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
		String path = exchange.getRequestURI().toString();
		boolean stream = path.contains("streamGenerateContent");
		JSONObject generationConfig = request.optJSONObject("generationConfig");
		JSONArray parts = request.getJSONArray("contents").getJSONObject(0).getJSONArray("parts");
		JSONObject inline = parts.getJSONObject(0).getJSONObject("inline_data");
		System.out.println("[fake api] path=" + path);
		System.out.println("[fake api] x-goog-api-key present=" + (exchange.getRequestHeaders().getFirst("x-goog-api-key") != null)
			+ " stream=" + stream
			+ " systemInstruction=" + request.getJSONObject("systemInstruction").getJSONArray("parts").getJSONObject(0).optString("text").length() + " chars");
		System.out.println("[fake api] inline_data mime_type=" + inline.optString("mime_type") + " base64 length=" + inline.optString("data").length()
			+ " textPart=" + parts.getJSONObject(1).optString("text"));
		System.out.println("[fake api] generationConfig responseMimeType=" + generationConfig.optString("responseMimeType")
			+ " responseSchema=" + (generationConfig.has("responseSchema") ? "attached, required=" + generationConfig.getJSONObject("responseSchema").optJSONArray("required") : "none")
			+ " maxOutputTokens=" + generationConfig.optInt("maxOutputTokens")
			+ " thinkingConfig=" + generationConfig.opt("thinkingConfig"));

		if (!stream) {
			JSONObject body = new JSONObject()
				.put("candidates", new JSONArray().put(new JSONObject()
					.put("content", new JSONObject().put("role", "model").put("parts", new JSONArray().put(new JSONObject().put("text", uiIr))))
					.put("finishReason", "STOP")))
				.put("usageMetadata", usage())
				.put("modelVersion", "gemini-fake-1.0");
			byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json");
			exchange.sendResponseHeaders(200, bytes.length);
			try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
			return;
		}

		exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
		exchange.sendResponseHeaders(200, 0);
		try (OutputStream os = exchange.getResponseBody()) {
			// A thinking part first, like a real thinking model; the analyzer must skip it.
			data(os, new JSONObject().put("candidates", new JSONArray().put(new JSONObject()
					.put("content", new JSONObject().put("role", "model").put("parts", new JSONArray().put(new JSONObject().put("text", "먼저 표를 확인한다").put("thought", true))))))
				.put("modelVersion", "gemini-fake-1.0"));
			for (int i = 0; i < uiIr.length(); i += 48) {
				String slice = uiIr.substring(i, Math.min(uiIr.length(), i + 48));
				data(os, new JSONObject().put("candidates", new JSONArray().put(new JSONObject()
					.put("content", new JSONObject().put("role", "model").put("parts", new JSONArray().put(new JSONObject().put("text", slice)))))));
				os.flush();
				try { Thread.sleep(2); } catch (InterruptedException ignored) { /* test only */ }
			}
			data(os, new JSONObject()
				.put("candidates", new JSONArray().put(new JSONObject().put("content", new JSONObject().put("role", "model").put("parts", new JSONArray())).put("finishReason", "STOP")))
				.put("usageMetadata", usage())
				.put("modelVersion", "gemini-fake-1.0"));
		}
	}

	private static JSONObject usage() {
		return new JSONObject().put("promptTokenCount", 1290).put("candidatesTokenCount", 1420).put("thoughtsTokenCount", 210).put("totalTokenCount", 2920);
	}

	private static void data(OutputStream os, JSONObject payload) throws java.io.IOException {
		os.write(("data: " + payload + "\n\n").getBytes(StandardCharsets.UTF_8));
	}

	private static File syntheticImage() throws Exception {
		BufferedImage img = new BufferedImage(1578, 818, BufferedImage.TYPE_INT_RGB);
		java.awt.Graphics2D g = img.createGraphics();
		g.setColor(java.awt.Color.WHITE); g.fillRect(0, 0, 1578, 818);
		g.setColor(java.awt.Color.DARK_GRAY); g.drawString("synthetic design", 20, 40); g.drawRect(20, 60, 1500, 700);
		g.dispose();
		File file = File.createTempFile("gemini-harness", ".png");
		ImageIO.write(img, "png", file);
		return file;
	}
}
