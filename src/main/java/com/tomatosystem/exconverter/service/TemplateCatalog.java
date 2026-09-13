package com.tomatosystem.exconverter.service;

import com.tomatosystem.exconverter.model.UiIr;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.net.URL;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/** Metadata/rule-based template retrieval; Phase 1 has one approved SEARCH_GRID template. */
public class TemplateCatalog {
	public TemplateMatch selectFor(UiIr ir) {
		File root = resolveTemplateRoot();
		if (!root.isDirectory()) throw new IllegalStateException("Template directory not found: " + root.getAbsolutePath());
		List<File> candidates = new ArrayList<File>();
		try (Stream<java.nio.file.Path> files = Files.walk(root.toPath())) {
			files.filter(path -> path.toString().toLowerCase().endsWith(".clx")).forEach(path -> candidates.add(path.toFile()));
		} catch (IOException e) { throw new IllegalStateException("Could not read template directory", e); }
		if (candidates.isEmpty()) throw new IllegalStateException("No CLX template exists under " + root.getAbsolutePath());
		candidates.sort(Comparator.comparingInt((File file) -> score(file, ir)).reversed().thenComparing(File::getPath));
		File selected = candidates.get(0);
		return new TemplateMatch(selected, root.toPath().relativize(selected.toPath()).toString().replace(File.separatorChar, '/'));
	}
	/** Uses an explicit server path when supplied; otherwise uses templates packaged by WTP. */
	private File resolveTemplateRoot() {
		String configuredRoot = System.getProperty("exconverter.template.root", "").trim();
		if (!configuredRoot.isEmpty()) return new File(configuredRoot);
		try {
			URL packagedTemplates = Thread.currentThread().getContextClassLoader().getResource("exconverter/templates");
			if (packagedTemplates != null && "file".equalsIgnoreCase(packagedTemplates.getProtocol())) return new File(packagedTemplates.toURI());
		} catch (Exception ignored) { /* The local development fallback below remains valid. */ }
		return new File("templates");
	}
	private int score(File template, UiIr ir) {
		try {
			String xml = new String(Files.readAllBytes(template.toPath()), StandardCharsets.UTF_8).toLowerCase(); int score = 0;
			if (xml.contains("<cl:grid")) score += ir.getGridColumns().isEmpty() ? 0 : 50;
			if (xml.contains("grpsearch") || xml.contains("search-box")) score += ir.getSearchFields().isEmpty() ? 0 : 30;
			if (xml.contains("<cl:formlayout")) score += 10;
			if (template.getName().contains("P1-1")) score += 5;
			return score;
		} catch (IOException e) { return Integer.MIN_VALUE; }
	}
	public static class TemplateMatch {
		private final File file; private final String id;
		TemplateMatch(File file, String id) { this.file = file; this.id = id; }
		public File getFile() { return file; }
		public String getId() { return id; }
	}
}
