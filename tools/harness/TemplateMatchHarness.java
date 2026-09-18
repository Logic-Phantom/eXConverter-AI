import com.tomatosystem.exconverter.service.TemplateCatalog;
import com.tomatosystem.exconverter.service.TemplateInspector;
import java.io.File;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.List;

/**
 * Command-line run of the same check {@link com.tomatosystem.exconverter.service.TemplateWatcher} runs in the
 * server: every template is reversed into its ideal UI-IR, then selection and roundtrip are verified
 * (see {@link TemplateInspector}).
 *
 * Usage: java -cp "out;<libs>;src\main\resources" TemplateMatchHarness [templates] [-v] [-o dir]
 *   -v      one line per template
 *   -o dir  write each roundtrip CLX (rtN.clx) for a headless e6-compiler run
 */
public class TemplateMatchHarness {
	public static void main(String[] args) throws Exception {
		List<String> argList = Arrays.asList(args);
		File root = new File(args.length > 0 && !args[0].startsWith("-") ? args[0] : "templates");
		boolean verbose = argList.contains("-v");
		int o = argList.indexOf("-o");
		File outDir = o >= 0 && o + 1 < args.length ? new File(args[o + 1]) : null;
		if (outDir != null) outDir.mkdirs();

		TemplateCatalog catalog = new TemplateCatalog();
		int measured = 0, selection = 0, roundtrip = 0, unsupported = 0, written = 0;
		StringBuilder problems = new StringBuilder();
		for (File file : TemplateCatalog.templateFiles(root)) {
			TemplateInspector.Inspection i = TemplateInspector.inspect(root, file, catalog, null, outDir != null);
			if (i.generated != null) Files.write(new File(outDir, "rt" + (++written) + ".clx").toPath(), i.generated);
			if (!i.measured()) unsupported++;
			else { measured++; if (i.selectionOk) selection++; if (i.roundtripOk) roundtrip++; }
			boolean problem = i.measured() && (!i.selectionOk || !i.roundtripOk) || TemplateInspector.ERROR.equals(i.status);
			if (problem) problems.append("MISS ").append(i.id).append("  ").append(String.join(" | ", i.messages)).append('\n');
			if (verbose) System.out.println(String.format("%-15s %s  %s%s", i.status, i.id, i.structureKey, i.messages.isEmpty() ? "" : "\n                " + String.join("\n                ", i.messages)));
		}
		System.out.print(problems);
		System.out.println("templates=" + (measured + unsupported) + " measured=" + measured + " unsupported=" + unsupported
			+ " selection=" + selection + "/" + measured + " roundtrip=" + roundtrip + "/" + measured);
	}
}
