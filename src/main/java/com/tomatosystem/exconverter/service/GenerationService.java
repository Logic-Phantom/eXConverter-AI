package com.tomatosystem.exconverter.service;

import com.tomatosystem.exconverter.model.UiIr;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

@Service
public class GenerationService {
	private final TemplateCatalog catalog = new TemplateCatalog();
	private final ClxGenerator generator = new ClxGenerator();
	public GenerationResult generate(UiIr ir) {
		if (ir.getGridColumns().size() > 30) throw new IllegalArgumentException("P1-1 supports up to 30 grid columns");
		TemplateCatalog.TemplateMatch template = catalog.selectFor(ir);
		byte[] clx = generator.generate(template.getFile(), ir); List<String> errors = ClxValidator.validate(clx);
		if (!errors.isEmpty()) throw new IllegalStateException("Generated CLX is invalid: " + errors);
		try {
			String id = UUID.randomUUID().toString(); File directory = new File(System.getProperty("exconverter.generated.root", "generated"));
			if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Could not create output directory: " + directory.getAbsolutePath());
			File output = new File(directory, id + ".clx"); Files.write(output.toPath(), clx, StandardOpenOption.CREATE_NEW); return new GenerationResult(id, output, template.getId());
		} catch (Exception e) { throw new IllegalStateException("Could not save generated CLX", e); }
	}
	public File find(String id) { if (!id.matches("[0-9a-fA-F-]{36}")) throw new IllegalArgumentException("Invalid generation id"); return new File(System.getProperty("exconverter.generated.root", "generated"), id + ".clx"); }
	public static class GenerationResult { private final String id; private final File file; private final String templateId; GenerationResult(String id, File file, String templateId) { this.id = id; this.file = file; this.templateId = templateId; } public String getId() { return id; } public File getFile() { return file; } public String getTemplateId() { return templateId; } }
}
