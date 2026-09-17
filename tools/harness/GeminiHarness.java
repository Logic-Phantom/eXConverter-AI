import com.tomatosystem.exconverter.model.UiIr;
import com.tomatosystem.exconverter.service.ClxGenerator;
import com.tomatosystem.exconverter.service.ClxValidator;
import com.tomatosystem.exconverter.service.GeminiUiIrAnalyzer;
import com.tomatosystem.exconverter.service.ImageUiIrAnalyzer;
import com.tomatosystem.exconverter.service.TemplateCatalog;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;

/**
 * Runs the Gemini engine without Tomcat: image -> Gemini -> UI-IR -> template selection -> CLX + validation.
 *
 * Usage:
 *   set GEMINI_API_KEY=...
 *   java -cp "out;<libs>;src\main\resources" GeminiHarness &lt;image.png&gt; &lt;out.clx&gt; [template.clx]
 *
 * Writes &lt;out&gt;.ui-ir.json next to the CLX so the raw model output can be inspected, diffed against the
 * Ollama output, or replayed through GenHarness. The template root falls back to ./templates outside the webapp.
 */
public class GeminiHarness {
	public static void main(String[] args) throws Exception {
		if (args.length < 2) { System.err.println("usage: GeminiHarness <image> <out.clx> [template.clx]"); System.exit(2); }
		if (!GeminiUiIrAnalyzer.isConfigured()) { System.err.println("GEMINI_API_KEY (or -Dexconverter.gemini.apiKey) is not set"); System.exit(3); }
		File image = new File(args[0]);
		File out = new File(args[1]);
		ImageUiIrAnalyzer.Analysis analysis = new GeminiUiIrAnalyzer().analyze(image, image.getName());
		UiIr ir = analysis.getUiIr();
		File irFile = new File(out.getAbsolutePath().replaceFirst("\\.clx$", "") + ".ui-ir.json");
		Files.write(irFile.toPath(), analysis.getRawJson().getBytes(StandardCharsets.UTF_8));
		System.out.println("mode=" + analysis.getMode() + " ui-ir=" + irFile.getAbsolutePath());
		File template;
		if (args.length > 2) template = new File(args[2]);
		else {
			TemplateCatalog.TemplateMatch match = new TemplateCatalog().selectFor(ir);
			template = match.getFile();
			System.out.println("template=" + match.getId() + " score=" + match.getScore() + " " + match.getProfile());
		}
		byte[] clx = new ClxGenerator().generate(template, ir);
		List<String> errors = ClxValidator.validate(clx);
		System.out.println("validation errors=" + errors);
		System.out.println("warnings=" + ir.getWarnings());
		Files.write(out.toPath(), clx);
		System.out.println("clx=" + out.getAbsolutePath());
	}
}
