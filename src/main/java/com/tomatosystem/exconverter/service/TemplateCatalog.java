package com.tomatosystem.exconverter.service;

import com.tomatosystem.exconverter.model.UiIr;
import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Metadata/rule-based template retrieval. Each CLX under the template root is profiled
 * (search box, grid/form/tab/tree counts, popup) and compared with the UI-IR's regions.
 * Adding a CLX to the repository is enough to make it selectable; nothing is retrained.
 */
public class TemplateCatalog {
	private final Map<String, TemplateProfile> profiles = new ConcurrentHashMap<String, TemplateProfile>();

	public TemplateMatch selectFor(UiIr ir) {
		File root = resolveTemplateRoot();
		if (!root.isDirectory()) throw new IllegalStateException("Template directory not found: " + root.getAbsolutePath());
		List<File> candidates = new ArrayList<File>();
		try (Stream<java.nio.file.Path> files = Files.walk(root.toPath())) {
			files.filter(path -> path.toString().toLowerCase().endsWith(".clx")).forEach(path -> candidates.add(path.toFile()));
		} catch (IOException e) { throw new IllegalStateException("Could not read template directory", e); }
		if (candidates.isEmpty()) throw new IllegalStateException("No CLX template exists under " + root.getAbsolutePath());
		Features wanted = Features.of(ir);
		List<TemplateMatch> ranked = new ArrayList<TemplateMatch>();
		for (File file : candidates) {
			TemplateProfile profile = profile(file);
			if (profile == null) continue;
			String id = root.toPath().relativize(file.toPath()).toString().replace(File.separatorChar, '/');
			ranked.add(new TemplateMatch(file, id, profile.score(wanted), profile.describe()));
		}
		if (ranked.isEmpty()) throw new IllegalStateException("No readable CLX template exists under " + root.getAbsolutePath());
		ranked.sort(Comparator.comparingInt(TemplateMatch::getScore).reversed().thenComparingLong((TemplateMatch m) -> m.getFile().length()).thenComparing(TemplateMatch::getId));
		return ranked.get(0);
	}

	/** Uses an explicit server path when supplied; otherwise uses templates packaged by WTP. */
	private File resolveTemplateRoot() {
		String configuredRoot = ExConverterConfig.get("exconverter.template.root", "");
		if (!configuredRoot.isEmpty()) return new File(configuredRoot);
		try {
			URL packagedTemplates = Thread.currentThread().getContextClassLoader().getResource("exconverter/templates");
			if (packagedTemplates != null && "file".equalsIgnoreCase(packagedTemplates.getProtocol())) return new File(packagedTemplates.toURI());
		} catch (Exception ignored) { /* The local development fallback below remains valid. */ }
		File local = new File("templates");
		if (local.isDirectory()) return local;
		try { return new File(ProjectRootResolver.resolve(null), "templates"); } catch (Exception e) { return local; }
	}

	private TemplateProfile profile(File file) {
		String key = file.getAbsolutePath() + ":" + file.lastModified();
		TemplateProfile cached = profiles.get(key);
		if (cached != null) return cached;
		try {
			TemplateProfile profile = TemplateProfile.of(file.getName(), new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
			profiles.put(key, profile);
			return profile;
		} catch (IOException e) { return null; }
	}

	/** What the design image asks for. */
	static final class Features {
		boolean search; int grids; int forms; boolean tabs; boolean tree; boolean popup; boolean footer;
		static Features of(UiIr ir) {
			Features f = new Features();
			f.search = ir.firstRegion(UiIr.SEARCH) != null;
			f.grids = ir.regionsOf(UiIr.GRID).size();
			f.forms = ir.regionsOf(UiIr.FORM).size();
			f.tabs = ir.firstRegion(UiIr.TABS) != null;
			f.tree = ir.firstRegion(UiIr.TREE) != null;
			f.popup = ir.getScreenType().toUpperCase().contains("POPUP");
			f.footer = !ir.getRegions().isEmpty() && UiIr.BUTTONS.equals(ir.getRegions().get(ir.getRegions().size() - 1).getType());
			return f;
		}
	}

	/** Structural fingerprint of a template CLX. */
	static final class TemplateProfile {
		boolean search; int grids; int forms; boolean tabs; boolean tree; boolean popup; boolean shuttle; boolean footer;

		static TemplateProfile of(String fileName, String xml) {
			TemplateProfile p = new TemplateProfile();
			p.search = xml.contains("class=\"search-box\"");
			p.grids = count(xml, "<cl:grid ");
			p.forms = count(xml, "class=\"form-base\"");
			p.tabs = xml.contains("<cl:tabfolder");
			p.tree = xml.contains("<cl:tree ");
			p.popup = fileName.matches(".*_P\\.clx$") || xml.contains("pop-content-body");
			p.shuttle = xml.contains("shuttle-button-group");
			p.footer = xml.contains("footer-button-group");
			return p;
		}

		int score(Features w) {
			int score = 100;
			score += w.search == search ? 40 : -40;
			score -= Math.abs(w.grids - grids) * 25;
			score -= Math.abs(w.forms - forms) * 20;
			score += w.tabs == tabs ? 0 : -60;
			score += w.tree == tree ? 0 : -60;
			score += w.popup == popup ? 0 : -80;
			score -= shuttle ? 50 : 0;
			score += w.footer == footer ? 5 : 0;
			return score;
		}

		String describe() {
			return "search=" + search + ", grids=" + grids + ", forms=" + forms + ", tabs=" + tabs + ", tree=" + tree + ", popup=" + popup;
		}

		private static int count(String text, String token) {
			Matcher matcher = Pattern.compile(Pattern.quote(token)).matcher(text);
			int n = 0;
			while (matcher.find()) n++;
			return n;
		}
	}

	public static class TemplateMatch {
		private final File file; private final String id; private final int score; private final String profile;
		TemplateMatch(File file, String id, int score, String profile) { this.file = file; this.id = id; this.score = score; this.profile = profile; }
		public File getFile() { return file; }
		public String getId() { return id; }
		public int getScore() { return score; }
		public String getProfile() { return profile; }
	}
}
