import com.tomatosystem.exconverter.model.UiIr;
import com.tomatosystem.exconverter.service.ClxGenerator;
import com.tomatosystem.exconverter.service.ClxValidator;
import com.tomatosystem.exconverter.service.TemplateCatalog;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

/**
 * Measures how well template selection and CLX generation cover the template repository.
 *
 * For every template it derives the UI-IR that a perfect image analysis of that screen would return
 * (regions in visual order, side for left/right panes, inTab for tab content, paging, grid/form title
 * buttons, shuttle arrows), then checks two things:
 *
 *   selection  TemplateCatalog.selectFor(derived) picks a template with the same structure key
 *              (the template itself, or a structurally identical twin such as 버티컬/폼 copies)
 *   roundtrip  ClxGenerator.generate(template, derived) produces a CLX whose derived structure key
 *              equals the template's, i.e. the generator rebuilds the template's layout
 *
 * Usage: java -cp "out;<libs>;src\main\resources" TemplateMatchHarness [templates] [-v]
 */
public class TemplateMatchHarness {
	static final String CL = "http://tomatosystem.co.kr/cleopatra";

	public static void main(String[] args) throws Exception {
		File root = new File(args.length > 0 && !args[0].startsWith("-") ? args[0] : "templates");
		boolean verbose = java.util.Arrays.asList(args).contains("-v");
		int o = java.util.Arrays.asList(args).indexOf("-o");
		File outDir = o >= 0 && o + 1 < args.length ? new File(args[o + 1]) : null; // roundtrip CLX for e6-compiler
		if (outDir != null) outDir.mkdirs();
		int written = 0;
		List<File> files;
		try (Stream<java.nio.file.Path> walk = Files.walk(root.toPath())) {
			files = walk.filter(p -> p.toString().endsWith(".clx")).map(java.nio.file.Path::toFile).sorted(Comparator.comparing(File::getPath)).collect(Collectors.toList());
		}
		TemplateCatalog catalog = new TemplateCatalog();
		int selectOk = 0, roundOk = 0, unsupported = 0;
		Map<String, String> misses = new TreeMap<String, String>();
		for (File file : files) {
			String id = root.toPath().relativize(file.toPath()).toString().replace(File.separatorChar, '/');
			Derived source = derive(Files.readAllBytes(file.toPath()), file.getName());
			if (source.unsupported != null) { unsupported++; if (verbose) System.out.println("SKIP  " + id + "  (" + source.unsupported + ")"); continue; }
			String key = key(source.ir);

			TemplateCatalog.TemplateMatch match = catalog.selectFor(source.ir);
			String chosenKey = key(derive(Files.readAllBytes(match.getFile().toPath()), match.getFile().getName()).ir);
			boolean selected = key.equals(chosenKey);
			if (selected) selectOk++; else misses.put(id, "select → " + match.getId() + "\n        want " + key + "\n        got  " + chosenKey);

			String roundKey;
			try {
				byte[] clx = new ClxGenerator().generate(file, source.ir);
				List<String> errors = ClxValidator.validate(clx);
				if (outDir != null) Files.write(new File(outDir, "rt" + (++written) + ".clx").toPath(), clx);
				roundKey = errors.isEmpty() ? key(derive(clx, file.getName()).ir) : "INVALID " + errors;
			} catch (Exception e) { roundKey = "ERROR " + e.getMessage(); }
			boolean round = key.equals(roundKey);
			if (round) roundOk++; else misses.merge(id, "roundtrip\n        want " + key + "\n        got  " + roundKey, (a, b) -> a + "\n    " + b);
			if (verbose) System.out.println((selected ? "ok   " : "MISS ") + (round ? "ok   " : "MISS ") + id + "  " + key);
		}
		int measured = files.size() - unsupported;
		for (Map.Entry<String, String> miss : misses.entrySet()) System.out.println("MISS " + miss.getKey() + "\n    " + miss.getValue());
		System.out.println("templates=" + files.size() + " measured=" + measured + " unsupported=" + unsupported
			+ " selection=" + selectOk + "/" + measured + " roundtrip=" + roundOk + "/" + measured);
	}

	// ------------------------------------------------------------------ structure key

	/** Structure only: titles, captions and field labels are placeholders and are ignored. */
	static String key(UiIr ir) {
		StringBuilder sb = new StringBuilder(ir.getScreenType().contains("POPUP") ? "popup " : "page ");
		for (UiIr.Region r : ir.getRegions()) {
			if (UiIr.TITLE.equals(r.getType())) continue;
			sb.append(r.getType());
			if (!r.getSide().isEmpty()) sb.append('@').append(r.getSide().charAt(0));
			if (r.isInTab()) sb.append("^tab");
			if (r.isPaging()) sb.append("+pg");
			if (UiIr.BUTTONS.equals(r.getType())) sb.append('(').append(String.join("", r.getButtons().stream().map(b -> arrow(b) ? b : "b").collect(Collectors.toList()))).append(')');
			else if (!r.getButtons().isEmpty()) sb.append("+btn");
			sb.append(' ');
		}
		return sb.toString().trim();
	}

	static boolean arrow(String caption) { return caption.matches("[▲▼◀▶]"); }

	// ------------------------------------------------------------------ CLX → ideal UI-IR

	static final class Derived { final UiIr ir = new UiIr(); String unsupported; }

	static Derived derive(byte[] clx, String fileName) throws Exception {
		DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
		factory.setNamespaceAware(true);
		Document doc = factory.newDocumentBuilder().parse(new ByteArrayInputStream(clx));
		Element body = (Element) doc.getElementsByTagNameNS("*", "body").item(0);
		Derived d = new Derived();
		UiIr ir = d.ir;
		ir.setScreenName("화면");
		ir.setWidth(1440); ir.setHeight(860); ir.setSourceWidth(1408);
		boolean popup = fileName.matches(".*_P\\.clx$") || !groupsByClass(body, "pop-content-body").isEmpty();
		ir.setScreenType(popup ? "POPUP" : "");
		UiIr.Region title = new UiIr.Region(UiIr.TITLE); title.setText("화면"); ir.getRegions().add(title);

		Element data = firstGroupByClass(body, "content-body", "pop-content-body");
		for (Element search : groupsByClass(body, "search-box")) {
			if (data == null || !isAncestor(data, search)) { ir.getRegions().add(searchRegion(search)); break; }
		}
		if (data == null) { d.unsupported = "no content-body"; return d; }
		for (String exotic : new String[] { "uicontrolshell", "embeddedpage", "accordion" }) {
			// UI-IR has no region type for these, so an image of them cannot be described, let alone matched.
			if (data.getElementsByTagNameNS("*", exotic).getLength() > 0) d.unsupported = "no UI-IR type for " + exotic;
		}
		walk(data, "", false, ir.getRegions());
		Element footer = firstGroupByClass(body, "content-footer", "pop-content-footer");
		if (footer != null && !groupsByClass(footer, "footer-button-group").isEmpty()) {
			UiIr.Region buttons = new UiIr.Region(UiIr.BUTTONS);
			buttons.getButtons().add("저장");
			ir.getRegions().add(buttons);
		}
		return d;
	}

	static void walk(Element container, String side, boolean inTab, List<UiIr.Region> out) {
		for (Element child : ordered(container)) {
			String name = child.getLocalName();
			if ("grid".equals(name)) { out.add(gridRegion(child, side, inTab)); continue; }
			if ("tree".equals(name)) { UiIr.Region tree = tagged(new UiIr.Region(UiIr.TREE), side, inTab); tree.setTitle("트리"); addTitleButtons((Element) child.getParentNode(), tree); out.add(tree); continue; }
			if ("textarea".equals(name)) { out.add(tagged(new UiIr.Region(UiIr.TEXTAREA), side, inTab)); continue; }
			if ("tabfolder".equals(name)) {
				UiIr.Region tabs = tagged(new UiIr.Region(UiIr.TABS), side, inTab);
				List<Element> items = children(child, "tabitem");
				for (Element item : items) tabs.getTabs().add(item.getAttribute("text"));
				out.add(tabs);
				if (!items.isEmpty()) walk(items.get(0), side, true, out);
				continue;
			}
			if (!"group".equals(name)) {
				if ("accordion".equals(name) || "sectionitem".equals(name)) walk(child, side, inTab, out);
				continue;
			}
			if (hasClass(child, "content-title-box") || hasClass(child, "title-button-group")) continue;
			if (hasClass(child, "form-base")) { out.add(formRegion(child, side, inTab)); continue; }
			if (hasClass(child, "search-box")) { UiIr.Region s = searchRegion(child); out.add(tagged(s, side, inTab)); continue; }
			if (hasClass(child, "shuttle-button-group")) { out.add(tagged(arrowButtons(child), side, inTab)); continue; }
			if (hasClass(child, "division-group")) { walkDivision(child, inTab, out); continue; }
			walk(child, side, inTab, out);
		}
	}

	/** Left pane, then (shuttle column), then right pane, as the prompt asks the model to list them. */
	static void walkDivision(Element division, boolean inTab, List<UiIr.Region> out) {
		Element layout = child(division, "formlayout");
		int columns = layout == null ? 2 : children(layout, "columns").size();
		Map<Integer, Element> wrappers = new TreeMap<Integer, Element>();
		List<List<Element>> byCol = new ArrayList<List<Element>>();
		for (int c = 0; c < columns; c++) byCol.add(new ArrayList<Element>());
		for (Element child : ordered(division)) { int col = Math.min(columns - 1, attr(child, "col")); byCol.get(col).add(child); }
		for (int c = 0; c < columns; c++) {
			boolean shuttle = columns == 3 && c == 1;
			String side = shuttle ? "" : (c == 0 ? UiIr.LEFT : UiIr.RIGHT);
			for (Element e : byCol.get(c)) {
				List<UiIr.Region> part = new ArrayList<UiIr.Region>();
				walk(wrap(e), side, inTab, part);
				out.addAll(part);
			}
		}
	}

	static UiIr.Region gridRegion(Element grid, String side, boolean inTab) {
		UiIr.Region region = tagged(new UiIr.Region(UiIr.GRID), side, inTab);
		int columns = children(grid, "gridcolumn").size();
		for (int i = 0; i < Math.max(1, columns); i++) region.getColumns().add(new UiIr.Column("컬럼" + (i + 1), "output", 0, ""));
		Element content = (Element) grid.getParentNode();
		region.setTitle("목록");
		addTitleButtons(content, region);
		region.setPaging(!children(content, "pageindexer").isEmpty());
		return region;
	}

	static UiIr.Region formRegion(Element form, String side, boolean inTab) {
		UiIr.Region region = tagged(new UiIr.Region(UiIr.FORM), side, inTab);
		int labels = countLabels(form);
		for (int i = 0; i < Math.max(1, labels); i++) region.getFields().add(new UiIr.Field("항목" + (i + 1), "inputbox", false));
		Element layout = child(form, "formlayout");
		int cols = layout == null ? 6 : children(layout, "columns").size();
		region.setColumnsPerRow(Math.max(1, Math.min(6, cols / 2)));
		region.setTitle("상세");
		addTitleButtons((Element) form.getParentNode(), region);
		return region;
	}

	static UiIr.Region searchRegion(Element search) {
		UiIr.Region region = new UiIr.Region(UiIr.SEARCH);
		int labels = countLabels(search);
		for (int i = 0; i < Math.max(1, labels); i++) region.getFields().add(new UiIr.Field("조건" + (i + 1), "inputbox", false));
		region.getButtons().add("조회");
		return region;
	}

	static UiIr.Region arrowButtons(Element group) {
		UiIr.Region region = new UiIr.Region(UiIr.BUTTONS);
		region.setAlign("center");
		for (Element button : children(group, "button")) {
			String cls = button.getAttribute("class");
			region.getButtons().add(cls.contains("btn-up") ? "▲" : cls.contains("btn-down") ? "▼" : cls.contains("btn-left") ? "◀" : cls.contains("btn-right") ? "▶" : button.getAttribute("value"));
		}
		return region;
	}

	/** Title-row buttons of the content that holds this grid/form: template placeholders stand for real buttons. */
	static void addTitleButtons(Element content, UiIr.Region region) {
		for (Element box : children(content, "group")) {
			if (!hasClass(box, "content-title-box")) continue;
			for (Element group : children(box, "group")) {
				if (!hasClass(group, "title-button-group")) continue;
				for (Element button : children(group, "button")) region.getButtons().add(button.getAttribute("value").isEmpty() ? "버튼" : button.getAttribute("value"));
			}
		}
	}

	static UiIr.Region tagged(UiIr.Region region, String side, boolean inTab) { region.setSide(side); region.setInTab(inTab); return region; }

	// ------------------------------------------------------------------ DOM helpers

	/** Wraps one element so walk() visits it as a child. */
	static Element wrap(Element e) {
		Element holder = e.getOwnerDocument().createElementNS(CL, "cl:group");
		holder.appendChild(e.cloneNode(true));
		return holder;
	}

	static List<Element> ordered(Element parent) {
		List<Element> list = new ArrayList<Element>();
		for (Element e : children(parent, null)) { if (CL.equals(e.getNamespaceURI()) && !isLayoutOrData(e)) list.add(e); }
		list.sort(Comparator.comparingInt((Element e) -> attr(e, "row")).thenComparingInt(e -> attr(e, "col")));
		return list;
	}

	static int attr(Element e, String name) {
		Element fd = child(e, "formdata");
		if (fd == null) return 0;
		try { return Integer.parseInt(fd.getAttribute(name)); } catch (NumberFormatException ex) { return 0; }
	}

	static boolean isLayoutOrData(Element e) {
		String n = e.getLocalName();
		return n.endsWith("layout") || n.endsWith("data") || "property".equals(n) || "listener".equals(n) || "rows".equals(n) || "columns".equals(n);
	}

	static List<Element> children(Element parent, String localName) {
		List<Element> list = new ArrayList<Element>();
		NodeList nodes = parent.getChildNodes();
		for (int i = 0; i < nodes.getLength(); i++) {
			Node n = nodes.item(i);
			if (n instanceof Element && (localName == null || localName.equals(n.getLocalName()))) list.add((Element) n);
		}
		return list;
	}

	static Element child(Element parent, String localName) { List<Element> l = children(parent, localName); return l.isEmpty() ? null : l.get(0); }

	static int countLabels(Element root) {
		int n = 0;
		NodeList outputs = root.getElementsByTagNameNS("*", "output");
		for (int i = 0; i < outputs.getLength(); i++) { if (((Element) outputs.item(i)).getAttribute("class").matches(".*\\blabel\\b.*")) n++; }
		return n;
	}

	static List<Element> groupsByClass(Element root, String cls) {
		List<Element> list = new ArrayList<Element>();
		NodeList groups = root.getElementsByTagNameNS("*", "group");
		for (int i = 0; i < groups.getLength(); i++) { if (hasClass((Element) groups.item(i), cls)) list.add((Element) groups.item(i)); }
		return list;
	}

	static Element firstGroupByClass(Element root, String... classes) {
		for (String cls : classes) { List<Element> l = groupsByClass(root, cls); if (!l.isEmpty()) return l.get(0); }
		return null;
	}

	static boolean hasClass(Element e, String cls) {
		for (String c : e.getAttribute("class").trim().split("\\s+")) { if (c.equals(cls)) return true; }
		return false;
	}

	static boolean isAncestor(Element ancestor, Node node) {
		for (Node n = node.getParentNode(); n != null; n = n.getParentNode()) { if (n == ancestor) return true; }
		return false;
	}
}
