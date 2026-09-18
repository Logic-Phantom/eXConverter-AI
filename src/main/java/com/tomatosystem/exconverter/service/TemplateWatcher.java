package com.tomatosystem.exconverter.service;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.stereotype.Component;

/**
 * Keeps analysing the template repository. At startup and then every exconverter.template.scanSeconds
 * (default 30; 0 = startup only; -1 = off) it lists templates/**.clx, runs {@link TemplateInspector} on every
 * template that was added or edited, re-checks selection for the rest when the set changed (a new template can
 * take over from an old one), and reports:
 *
 * <ul>
 *   <li>Eclipse console: a summary at startup, then one line per added / edited / removed template and per
 *       existing template whose result changed</li>
 *   <li>generated/template-report.json: every template with status, layout, selection and roundtrip</li>
 *   <li>GET /EXConverter/templates/status.do and /rescan.do</li>
 * </ul>
 *
 * Selection itself needs none of this: TemplateCatalog reads the folder on every request, so an added template
 * is a candidate at once. The watcher tells whether it will actually be chosen and rebuilt correctly.
 */
@Component
public class TemplateWatcher implements InitializingBean, DisposableBean {
	private static final Logger LOGGER = LoggerFactory.getLogger(TemplateWatcher.class);
	// Static on purpose: both the root context (context-common.xml) and the dispatcher context scan
	// com.tomatosystem, so Spring creates this bean twice. One scheduler and one state serve both.
	private static final TemplateCatalog catalog = new TemplateCatalog();
	private static final Map<String, TemplateInspector.Inspection> inspections = new TreeMap<String, TemplateInspector.Inspection>();
	private static ScheduledExecutorService scheduler;
	private static volatile JSONObject report = new JSONObject().put("status", "not scanned yet");
	private static File lastRoot;
	private boolean owner;

	@Override
	public void afterPropertiesSet() {
		int seconds = ExConverterConfig.getInt("exconverter.template.scanSeconds", 30);
		if (seconds < 0) return;
		synchronized (TemplateWatcher.class) {
			if (scheduler != null) return;
			owner = true;
			scheduler = Executors.newSingleThreadScheduledExecutor(r -> { Thread t = new Thread(r, "exconverter-template-watch"); t.setDaemon(true); return t; });
		}
		scheduler.schedule(() -> safeScan(false), 3, TimeUnit.SECONDS);
		if (seconds > 0) scheduler.scheduleWithFixedDelay(() -> safeScan(false), seconds, seconds, TimeUnit.SECONDS);
	}

	@Override
	public void destroy() {
		synchronized (TemplateWatcher.class) {
			if (!owner || scheduler == null) return;
			scheduler.shutdownNow();
			scheduler = null;
		}
	}

	public JSONObject report() { return report; }

	private void safeScan(boolean force) {
		try { scan(force); }
		catch (Exception e) { LOGGER.warn("Template scan failed: {}", e.getMessage()); ProgressLog.step("[템플릿] 분석 실패: {}", e.getMessage()); }
	}

	/** Analyses what changed since the last scan; force re-inspects every template. */
	public JSONObject scan(boolean force) {
		synchronized (TemplateWatcher.class) { return scanLocked(force); }
	}

	private JSONObject scanLocked(boolean force) {
		File root = TemplateCatalog.templateRoot();
		boolean first = lastRoot == null || !lastRoot.equals(root);
		if (first) inspections.clear();
		lastRoot = root;
		Map<String, File> files = new LinkedHashMap<String, File>();
		for (File file : TemplateCatalog.templateFiles(root)) files.put(TemplateCatalog.idOf(root, file), file);

		List<String> added = new ArrayList<String>();
		List<String> edited = new ArrayList<String>();
		List<String> removed = new ArrayList<String>();
		for (Map.Entry<String, File> entry : files.entrySet()) {
			TemplateInspector.Inspection old = inspections.get(entry.getKey());
			if (old == null) added.add(entry.getKey());
			else if (old.lastModified != entry.getValue().lastModified() || old.size != entry.getValue().length()) edited.add(entry.getKey());
		}
		for (String id : inspections.keySet()) { if (!files.containsKey(id)) removed.add(id); }
		boolean setChanged = !added.isEmpty() || !removed.isEmpty() || !edited.isEmpty();
		if (!setChanged && !force) return report;

		long started = System.currentTimeMillis();
		Map<String, String> before = new HashMap<String, String>();
		for (TemplateInspector.Inspection i : inspections.values()) before.put(i.id, i.status + "|" + i.selected);
		for (String id : removed) inspections.remove(id);
		for (Map.Entry<String, File> entry : files.entrySet()) {
			String id = entry.getKey();
			boolean changed = force || added.contains(id) || edited.contains(id);
			// Unchanged templates keep their roundtrip result but re-run selection, which other templates affect.
			TemplateInspector.Inspection previous = changed ? null : inspections.get(id);
			inspections.put(id, TemplateInspector.inspect(root, entry.getValue(), catalog, previous, false));
		}
		linkTwins();
		report = buildReport(root, System.currentTimeMillis() - started);
		writeReport(report);

		if (first || force) logSummary(root);
		else {
			for (String id : added) logOne("추가", inspections.get(id));
			for (String id : edited) logOne("변경", inspections.get(id));
			for (String id : removed) ProgressLog.step("[템플릿] 삭제: {}", id);
			for (TemplateInspector.Inspection i : inspections.values()) {
				String was = before.get(i.id);
				if (was != null && !added.contains(i.id) && !edited.contains(i.id) && !was.equals(i.status + "|" + i.selected)) logOne("영향", i);
			}
			logTotals();
		}
		return report;
	}

	/** Templates whose structure key is identical; only the smallest of them is ever selected. */
	private void linkTwins() {
		Map<String, List<String>> byKey = new HashMap<String, List<String>>();
		for (TemplateInspector.Inspection i : inspections.values()) {
			if (!i.structureKey.isEmpty()) byKey.computeIfAbsent(i.structureKey, k -> new ArrayList<String>()).add(i.id);
		}
		for (TemplateInspector.Inspection i : inspections.values()) {
			i.twins.clear();
			for (String other : byKey.getOrDefault(i.structureKey, new ArrayList<String>())) { if (!other.equals(i.id)) i.twins.add(other); }
		}
	}

	private void logSummary(File root) {
		ProgressLog.step("[템플릿] {}개 분석 완료 ({}) — {}", inspections.size(), root.getAbsolutePath(), counts());
		for (TemplateInspector.Inspection i : inspections.values()) {
			boolean problem = TemplateInspector.SELECT_FAIL.equals(i.status) || TemplateInspector.ROUNDTRIP_FAIL.equals(i.status) || TemplateInspector.ERROR.equals(i.status) || !i.unknownControls.isEmpty() && i.measured();
			if (problem) logOne("점검 필요", i);
		}
		ProgressLog.step("[템플릿] 상세 리포트: {} (또는 GET /EXConverter/templates/status.do)", reportFile().getAbsolutePath());
	}

	private void logOne(String event, TemplateInspector.Inspection i) {
		String verdict;
		switch (i.status) {
			case TemplateInspector.OK: verdict = "정상 (선택·재현 OK)"; break;
			case TemplateInspector.DUPLICATE: verdict = "주의"; break;
			case TemplateInspector.UNSUPPORTED: verdict = "미지원"; break;
			default: verdict = "오류 " + i.status;
		}
		ProgressLog.step("[템플릿] {}: {} — 본문 {} — {}{}", event, i.id, i.body.replaceFirst(".*body=", ""), verdict, i.messages.isEmpty() ? "" : " | " + String.join(" | ", i.messages));
	}

	private void logTotals() { ProgressLog.step("[템플릿] 현재 {}개 — {}", inspections.size(), counts()); }

	private String counts() {
		int measured = 0, selection = 0, roundtrip = 0;
		Map<String, Integer> byStatus = new TreeMap<String, Integer>();
		for (TemplateInspector.Inspection i : inspections.values()) {
			byStatus.merge(i.status, 1, Integer::sum);
			if (!i.measured()) continue;
			measured++;
			if (i.selectionOk) selection++;
			if (i.roundtripOk) roundtrip++;
		}
		return "선택 " + selection + "/" + measured + ", 재현 " + roundtrip + "/" + measured + ", 상태 " + byStatus;
	}

	private JSONObject buildReport(File root, long elapsedMs) {
		JSONArray templates = new JSONArray();
		int measured = 0, selection = 0, roundtrip = 0;
		JSONObject byStatus = new JSONObject();
		for (TemplateInspector.Inspection i : inspections.values()) {
			templates.put(i.toJson());
			byStatus.put(i.status, byStatus.optInt(i.status, 0) + 1);
			if (!i.measured()) continue;
			measured++;
			if (i.selectionOk) selection++;
			if (i.roundtripOk) roundtrip++;
		}
		return new JSONObject().put("root", root.getAbsolutePath()).put("scannedAt", LocalDateTime.now().toString()).put("elapsedMs", elapsedMs)
			.put("templates", inspections.size()).put("measured", measured).put("selectionOk", selection).put("roundtripOk", roundtrip)
			.put("byStatus", byStatus).put("items", templates);
	}

	private File reportFile() { return new File(ExConverterConfig.get("exconverter.generated.root", "generated"), "template-report.json"); }

	private void writeReport(JSONObject value) {
		try {
			File file = reportFile();
			if (!file.getParentFile().exists()) file.getParentFile().mkdirs();
			Files.write(file.toPath(), value.toString(2).getBytes(StandardCharsets.UTF_8));
		} catch (Exception e) { LOGGER.warn("Could not write the template report: {}", e.getMessage()); }
	}
}
