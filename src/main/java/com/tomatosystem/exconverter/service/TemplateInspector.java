package com.tomatosystem.exconverter.service;

import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Health check of one template, run by {@link TemplateWatcher} whenever a template is added or edited, and by
 * tools/harness/TemplateMatchHarness for the whole repository.
 *
 * <ol>
 *   <li>Reverse the template into the UI-IR a perfect image analysis would return ({@link TemplateReverse}).</li>
 *   <li>Selection: does that UI-IR select a template of the same structure? If a structural twin wins (same
 *       structure, smaller file), this file itself is never used.</li>
 *   <li>Roundtrip: generate CLX from that UI-IR with this template, validate it, reverse it again: same structure?</li>
 *   <li>Controls the generator does not know are listed; they are dropped when a screen is generated.</li>
 * </ol>
 */
public final class TemplateInspector {
	public static final String OK = "OK";
	public static final String DUPLICATE = "DUPLICATE";
	public static final String UNSUPPORTED = "UNSUPPORTED";
	public static final String UNUSABLE = "UNUSABLE";
	public static final String SELECT_FAIL = "SELECT_FAIL";
	public static final String ROUNDTRIP_FAIL = "ROUNDTRIP_FAIL";
	public static final String ERROR = "ERROR";

	private TemplateInspector() { }

	public static final class Inspection {
		public String id;
		public long size;
		public long lastModified;
		public String status = OK;
		public String body = "";
		public String structureKey = "";
		public String selected = "";
		public boolean selectionOk;
		public boolean roundtripOk;
		public String roundtripKey = "";
		public String unsupported;
		public final List<String> unknownControls = new ArrayList<String>();
		public final List<String> twins = new ArrayList<String>();
		public final List<String> messages = new ArrayList<String>();
		/** The last generated CLX, kept only when requested (harness writes it out for e6-compiler). */
		public byte[] generated;

		public boolean measured() { return !UNSUPPORTED.equals(status) && !UNUSABLE.equals(status) && !ERROR.equals(status); }

		public JSONObject toJson() {
			return new JSONObject().put("id", id).put("status", status).put("body", body).put("structureKey", structureKey)
				.put("selected", selected).put("selectionOk", selectionOk).put("roundtripOk", roundtripOk).put("roundtripKey", roundtripKey)
				.put("unsupported", unsupported == null ? "" : unsupported).put("unknownControls", new JSONArray(unknownControls))
				.put("twins", new JSONArray(twins)).put("messages", new JSONArray(messages)).put("size", size).put("lastModified", lastModified);
		}
	}

	/** Full check. {@code previous} (same file, unchanged) lets the watcher skip regenerating and only re-run selection. */
	public static Inspection inspect(File root, File file, TemplateCatalog catalog, Inspection previous, boolean keepGenerated) {
		Inspection result = new Inspection();
		result.id = TemplateCatalog.idOf(root, file);
		result.size = file.length();
		result.lastModified = file.lastModified();
		try {
			TemplateReverse.Result reversed = TemplateReverse.analyze(Files.readAllBytes(file.toPath()), file.getName());
			result.body = catalog.describe(file);
			result.unknownControls.addAll(reversed.unknownControls);
			if (!reversed.usable) {
				result.status = UNUSABLE;
				result.unsupported = reversed.unsupported;
				result.messages.add("선택 후보에서 제외: " + reversed.unsupported);
				return result;
			}
			result.structureKey = TemplateReverse.structureKey(reversed.ir);
			if (!result.unknownControls.isEmpty()) result.messages.add("생성기가 모르는 컨트롤 " + result.unknownControls + " — 화면 생성 시 제거됨");
			if (reversed.unsupported != null) {
				result.status = UNSUPPORTED;
				result.unsupported = reversed.unsupported;
				result.messages.add(reversed.unsupported + " — 이미지 분석 결과로는 이 템플릿이 선택될 수 없음");
				return result;
			}

			TemplateCatalog.TemplateMatch match = catalog.selectFor(reversed.ir, root);
			result.selected = match.getId();
			boolean self = match.getId().equals(result.id);
			String selectedKey = self ? result.structureKey
				: TemplateReverse.structureKey(TemplateReverse.analyze(Files.readAllBytes(match.getFile().toPath()), match.getFile().getName()).ir);
			result.selectionOk = result.structureKey.equals(selectedKey);

			if (previous != null && previous.lastModified == result.lastModified && previous.size == result.size && !keepGenerated) {
				result.roundtripOk = previous.roundtripOk;
				result.roundtripKey = previous.roundtripKey;
			} else {
				byte[] clx = new ClxGenerator().generate(file, reversed.ir);
				List<String> errors = ClxValidator.validate(clx);
				if (keepGenerated) result.generated = clx;
				result.roundtripKey = errors.isEmpty() ? TemplateReverse.structureKey(TemplateReverse.analyze(clx, file.getName()).ir) : "INVALID " + errors;
				result.roundtripOk = result.structureKey.equals(result.roundtripKey);
			}

			if (!result.roundtripOk) {
				result.status = ROUNDTRIP_FAIL;
				result.messages.add("생성기가 이 템플릿 구조를 재현하지 못함: 기대 [" + result.structureKey + "] 실제 [" + result.roundtripKey + "]");
			} else if (!result.selectionOk) {
				result.status = SELECT_FAIL;
				result.messages.add("이 구조의 화면에 다른 구조의 템플릿이 선택됨: " + result.selected + " — 선택 규칙(LayoutShape)이 구분하지 못하는 요소가 있음");
			} else if (!self) {
				result.status = DUPLICATE;
				result.messages.add("구조가 같은 " + result.selected + " 이(가) 먼저 선택됨(파일이 더 작음) — 이 파일은 사용되지 않음");
			}
		} catch (Exception e) {
			result.status = ERROR;
			result.messages.add("분석 실패: " + e.getMessage());
		}
		return result;
	}
}
