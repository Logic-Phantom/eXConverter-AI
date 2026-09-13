import com.tomatosystem.exconverter.model.UiIr;
import com.tomatosystem.exconverter.service.ClxGenerator;
import com.tomatosystem.exconverter.service.ClxValidator;
import com.tomatosystem.exconverter.service.UiIrParser;
import java.io.File;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Usage:
 *   GenHarness <ui-ir.json> <out.clx> [template.clx]          single generation (template auto-selected when omitted)
 *   GenHarness --all <samples dir> <templates dir> <out dir>   every sample × every template in one JVM
 */
public class GenHarness {
	public static void main(String[] args) throws Exception {
		if ("--all".equals(args[0])) { runAll(new File(args[1]), new File(args[2]), new File(args[3])); return; }
		UiIr ir = UiIrParser.parse(read(new File(args[0])));
		File template;
		if (args.length > 2) template = new File(args[2]);
		else {
			Object catalog = Class.forName("com.tomatosystem.exconverter.service.TemplateCatalog").getDeclaredConstructor().newInstance();
			Method select = catalog.getClass().getMethod("selectFor", UiIr.class);
			Object match = select.invoke(catalog, ir);
			template = (File) match.getClass().getMethod("getFile").invoke(match);
			System.out.println("template=" + match.getClass().getMethod("getId").invoke(match) + " score=" + match.getClass().getMethod("getScore").invoke(match) + " " + match.getClass().getMethod("getProfile").invoke(match));
		}
		byte[] clx = new ClxGenerator().generate(template, ir);
		List<String> errors = ClxValidator.validate(clx);
		System.out.println("validation errors=" + errors);
		System.out.println("warnings=" + ir.getWarnings());
		Files.write(new File(args[1]).toPath(), clx);
	}

	private static void runAll(File samples, File templates, File out) throws Exception {
		if (!out.isDirectory() && !out.mkdirs()) throw new IllegalStateException("cannot create " + out);
		File[] irs = samples.listFiles((dir, name) -> name.endsWith(".json"));
		List<File> clxs;
		try (Stream<java.nio.file.Path> walk = Files.walk(templates.toPath())) { clxs = walk.filter(p -> p.toString().endsWith(".clx")).map(java.nio.file.Path::toFile).collect(Collectors.toList()); }
		int cases = 0;
		List<String> failures = new ArrayList<String>();
		for (File irFile : irs) {
			for (int t = 0; t < clxs.size(); t++) {
				cases++;
				try {
					UiIr ir = UiIrParser.parse(read(irFile));
					byte[] clx = new ClxGenerator().generate(clxs.get(t), ir);
					List<String> errors = ClxValidator.validate(clx);
					if (!errors.isEmpty()) failures.add(irFile.getName() + " × " + clxs.get(t).getName() + ": " + errors);
					Files.write(new File(out, irFile.getName().replace(".json", "") + "-t" + t + ".clx").toPath(), clx);
				} catch (Exception e) {
					failures.add(irFile.getName() + " × " + clxs.get(t).getName() + ": " + e);
				}
			}
		}
		System.out.println("cases=" + cases + " failures=" + failures.size());
		for (String failure : failures) System.out.println("FAIL " + failure);
	}

	private static String read(File file) throws Exception {
		return new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
	}
}
