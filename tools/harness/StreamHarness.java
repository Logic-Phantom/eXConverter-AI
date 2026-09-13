import com.sun.net.httpserver.HttpServer;
import com.tomatosystem.exconverter.service.ImageUiIrAnalyzer;
import java.io.File;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONObject;

/** Fake Ollama that streams the saved UI-IR in the "thinking" field, slowly. Usage: StreamHarness <image> <ui-ir.json> */
public class StreamHarness {
	public static void main(String[] args) throws Exception {
		String json = new String(Files.readAllBytes(new File(args[1]).toPath()), StandardCharsets.UTF_8);
		HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 18434), 0);
		server.createContext("/api/generate", exchange -> {
			exchange.getRequestBody().readAllBytes();
			exchange.sendResponseHeaders(200, 0);
			try (OutputStream out = exchange.getResponseBody()) {
				try { Thread.sleep(17000); } catch (InterruptedException ignored) { }
				int step = Math.max(1, json.length() / 40);
				for (int i = 0; i < json.length(); i += step) {
					JSONObject chunk = new JSONObject().put("response", "").put("thinking", json.substring(i, Math.min(json.length(), i + step))).put("done", false);
					out.write((chunk + "\n").getBytes(StandardCharsets.UTF_8)); out.flush();
					try { Thread.sleep(400); } catch (InterruptedException ignored) { }
				}
				out.write((new JSONObject().put("response", "").put("done", true).put("done_reason", "stop").put("prompt_eval_count", 1635).put("eval_count", 40) + "\n").getBytes(StandardCharsets.UTF_8));
			}
		});
		server.start();
		System.setProperty("exconverter.ollama.url", "http://127.0.0.1:18434");
		System.setProperty("exconverter.ollama.model", "fake-vl");
		ImageUiIrAnalyzer.Analysis a = new ImageUiIrAnalyzer().analyze(new File(args[0]), "스크린샷 2026-09-13 110550.png");
		System.out.println("mode=" + a.getMode() + " regions=" + a.getUiIr().getRegions().size() + " sourceWidth=" + a.getUiIr().getSourceWidth());
		server.stop(0);
	}
}
