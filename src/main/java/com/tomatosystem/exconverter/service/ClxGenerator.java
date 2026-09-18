package com.tomatosystem.exconverter.service;

import com.tomatosystem.exconverter.model.UiIr;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.file.Files;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

/**
 * Deterministic UI-IR → CLX compiler.
 *
 * The selected template supplies the skeleton: responsive screens, udcComAppHeader,
 * content-header/search-box, content-body/content, content-footer and their style classes
 * and spacing. Everything inside those containers is rebuilt from the UI-IR regions, so the
 * number of search fields, grids, grid columns and buttons follows the design image
 * instead of the template's placeholder controls.
 */
public class ClxGenerator {
	static final String CL = "http://tomatosystem.co.kr/cleopatra";
	static final String STD = "http://tomatosystem.co.kr/cleopatra/studio";

	public byte[] generate(File template, UiIr ir) {
		try {
			DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
			factory.setNamespaceAware(true);
			factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
			Document doc = factory.newDocumentBuilder().parse(new ByteArrayInputStream(Files.readAllBytes(template.toPath())));
			new Compiler(doc, ir).compile();
			return serialize(doc);
		} catch (IllegalArgumentException e) {
			throw e;
		} catch (Exception e) {
			throw new IllegalStateException("CLX generation failed: " + e.getMessage(), e);
		}
	}

	private static byte[] serialize(Document doc) throws Exception {
		ByteArrayOutputStream output = new ByteArrayOutputStream();
		output.write("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".getBytes(java.nio.charset.StandardCharsets.UTF_8));
		Transformer transformer = TransformerFactory.newInstance().newTransformer();
		transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "yes");
		transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
		transformer.setOutputProperty(OutputKeys.INDENT, "yes");
		transformer.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "2");
		transformer.transform(new DOMSource(doc), new StreamResult(output));
		return output.toByteArray();
	}

	/** One compilation; holds id/sid generators so every generated node is unique. */
	private static final class Compiler {
		private static final int CONTENT_WIDTH = 1408;
		private static final int FIELDS_PER_ROW = 3;
		private static final Map<String, String> SID_PREFIX = new HashMap<String, String>();
		private static final Map<String, String> ID_PREFIX = new HashMap<String, String>();
		static {
			String[][] sids = { { "output", "output" }, { "inputbox", "i-box" }, { "dateinput", "d-input" }, { "combobox", "c-box" },
				{ "searchinput", "s-input" }, { "button", "button" }, { "group", "group" }, { "grid", "grid" }, { "gridcolumn", "g-column" },
				{ "gridheader", "gh-band" }, { "griddetail", "gd-band" }, { "gridrow", "g-row" }, { "formdata", "f-data" },
				{ "flowlayoutdata", "f-data" }, { "verticaldata", "v-data" }, { "formlayout", "f-layout" }, { "flowlayout", "f-layout" },
				{ "verticallayout", "v-layout" }, { "udc", "ud-control" }, { "dataset", "d-set" }, { "datacolumn", "d-column" },
				{ "textarea", "t-area" }, { "checkbox", "c-box" }, { "radiobutton", "r-button" }, { "numbereditor", "n-editor" },
				{ "maskeditor", "m-editor" }, { "tabfolder", "t-folder" }, { "tabitem", "t-item" }, { "tree", "tree" } };
			for (String[] s : sids) SID_PREFIX.put(s[0], s[1]);
			String[][] ids = { { "output", "opt" }, { "inputbox", "ipb" }, { "dateinput", "dti" }, { "combobox", "cmb" }, { "searchinput", "sipb" },
				{ "button", "btn" }, { "grid", "grd" }, { "textarea", "txa" }, { "checkbox", "cbx" }, { "radiobutton", "rdb" },
				{ "numbereditor", "nbe" }, { "maskeditor", "mse" }, { "tree", "tre" }, { "tabfolder", "tab" } };
			for (String[] s : ids) ID_PREFIX.put(s[0], s[1]);
		}

		private final Document doc;
		private final UiIr ir;
		private final SecureRandom random = new SecureRandom();
		private final Set<String> sids = new HashSet<String>();
		private final Set<String> ids = new HashSet<String>();
		private Element model;
		/** Grids built so far, across panes, for the fallback titles (screen name, then "목록 N"). */
		private int gridIndex;

		Compiler(Document doc, UiIr ir) { this.doc = doc; this.ir = ir; }

		void compile() {
			stripWhitespace(doc.getDocumentElement());
			Element body = firstByLocalName(doc.getDocumentElement(), "body");
			if (body == null) throw new IllegalStateException("Template has no body");
			model = firstByLocalName(doc.getDocumentElement(), "model");
			Element appHeader = findUdc(body, "udcComAppHeader");
			Element header = findGroup(body, "grpHeader", "content-header", "pop-content-header");
			Element search = findGroup(body, "grpSearch", "search-box", null);
			Element data = findGroup(body, "grpData", "content-body", "pop-content-body");
			Element footer = findGroup(body, "grpFooter", "content-footer", "pop-content-footer");
			Element contentPrototype = data == null ? null : findContentPrototype(data);
			if (contentPrototype != null) contentPrototype = (Element) contentPrototype.cloneNode(true);
			// Left/right panes keep the template's column ratio (1:1, 2:5, 250px:1 ...).
			List<Element> divisions = data == null ? new ArrayList<Element>() : descendantsByClass(data, "division-group");
			Element divisionPrototype = divisions.isEmpty() ? null : (Element) divisions.get(0).cloneNode(true);

			// Split regions by where the eXBuilder6 skeleton expects them.
			List<UiIr.Region> headerRegions = new ArrayList<UiIr.Region>();
			List<UiIr.Region> bodyRegions = new ArrayList<UiIr.Region>();
			UiIr.Region searchRegion = null;
			UiIr.Region footerRegion = null;
			String title = ir.getScreenName();
			List<UiIr.Region> regions = new ArrayList<UiIr.Region>(ir.getRegions());
			if (!regions.isEmpty() && UiIr.BUTTONS.equals(regions.get(regions.size() - 1).getType()) && footer != null) footerRegion = regions.remove(regions.size() - 1);
			for (java.util.Iterator<UiIr.Region> it = regions.iterator(); it.hasNext();) {
				UiIr.Region region = it.next();
				if (UiIr.TITLE.equals(region.getType())) { title = firstNonBlank(region.getText(), region.getTitle(), title); it.remove(); }
			}
			int searchIndex = -1;
			if (search != null) { for (int i = 0; i < regions.size() && searchIndex < 0; i++) { if (UiIr.SEARCH.equals(regions.get(i).getType())) searchIndex = i; } }
			if (searchIndex >= 0) searchRegion = regions.get(searchIndex);
			// Explanatory text directly above the search box belongs to content-header; anything else keeps visual order in the body.
			boolean headerPrefix = searchIndex > 0 && header != null;
			for (int i = 0; i < searchIndex && headerPrefix; i++) headerPrefix = isHeaderFriendly(regions.get(i));
			for (int i = 0; i < regions.size(); i++) {
				if (i == searchIndex) continue;
				if (headerPrefix && i < searchIndex) headerRegions.add(regions.get(i));
				else bodyRegions.add(regions.get(i));
			}

			pruneGenerated(body, search, data, footer);
			collectExisting(doc.getDocumentElement());

			if (appHeader != null) setUdcProperty(appHeader, "title", title);
			if (searchRegion != null) buildSearch(search, searchRegion);
			else if (search != null) search.getParentNode().removeChild(search);
			if (header != null) buildHeaderExtras(header, search, headerRegions);
			if (data != null) buildBody(data, bodyRegions, contentPrototype, divisionPrototype);
			else if (!bodyRegions.isEmpty()) ir.getWarnings().add("Template has no content-body; " + bodyRegions.size() + " regions skipped");
			if (footer != null) {
				if (footerRegion != null) buildFooter(footer, footerRegion);
				else footer.getParentNode().removeChild(footer);
			}
			if (header != null && childElements(header, true).isEmpty()) header.getParentNode().removeChild(header);
		}

		// ------------------------------------------------------------------ skeleton handling

		private boolean isHeaderFriendly(UiIr.Region region) {
			String type = region.getType();
			return UiIr.DESCRIPTION.equals(type) || UiIr.SECTION_TITLE.equals(type);
		}

		/** Removes the template's placeholder controls; containers and their layout rules stay. */
		private void pruneGenerated(Element body, Element search, Element data, Element footer) {
			if (search != null) removeControls(search);
			if (data != null) removeControls(data);
			if (footer != null) {
				for (Element buttons : descendantsByClass(footer, "footer-button-group")) {
					for (Element side : childElements(buttons, true)) removeControls(side);
				}
			}
		}

		private Element findContentPrototype(Element data) {
			for (Element group : descendantsByLocalName(data, "group")) {
				if (hasClass(group, "content") && !descendantsByLocalName(group, "grid").isEmpty()) return group;
			}
			return null;
		}

		private void buildHeaderExtras(Element header, Element search, List<UiIr.Region> regions) {
			Element anchor = search != null && search.getParentNode() == header ? search : layoutOf(header);
			for (UiIr.Region region : regions) {
				Element control = buildRegion(region, null);
				if (control == null) continue;
				control.insertBefore(verticalData(CONTENT_WIDTH, heightOf(region), false), control.getFirstChild());
				header.insertBefore(control, anchor);
			}
			int total = 0;
			List<Element> children = childElements(header, true);
			for (Element child : children) {
				Element vd = firstChildByLocalName(child, "verticaldata");
				total += vd == null ? 24 : parsePx(vd.getAttribute("height"), 24);
			}
			Element vd = firstChildByLocalName(header, "verticaldata");
			if (vd != null) vd.setAttribute("height", (total + Math.max(0, children.size() - 1) * 12) + "px");
		}

		/**
		 * Stacks the body regions top to bottom. The run from the first to the last region that has a side
		 * becomes one division-group row with a left and a right pane; regions before and after it span the width.
		 */
		private void buildBody(Element data, List<UiIr.Region> regions, Element contentPrototype, Element divisionPrototype) {
			Element layout = layoutOf(data);
			int first = -1;
			int last = -1;
			for (int i = 0; i < regions.size(); i++) { if (!regions.get(i).getSide().isEmpty()) { if (first < 0) first = i; last = i; } }
			Stack stack = new Stack();
			for (int i = 0; i < regions.size(); i++) {
				Placed placed = i == first ? buildDivision(regions.subList(first, last + 1), contentPrototype, divisionPrototype) : place(regions.get(i), contentPrototype);
				if (i == first) i = last;
				if (placed == null) continue;
				placed.control.insertBefore(formData(stack.rows.size(), 0), placed.control.getFirstChild());
				data.insertBefore(placed.control, layout);
				stack.add(placed);
			}
			Element newLayout = formLayout(stack.rows(), cols(new String[] { "1", "FRACTION" }), 12, 12);
			if (layout != null) data.replaceChild(newLayout, layout); else data.appendChild(newLayout);
			Element vd = firstChildByLocalName(data, "verticaldata");
			if (vd != null) vd.setAttribute("height", Math.max(parsePx(vd.getAttribute("height"), 650), stack.needed) + "px");
		}

		/** A built region and the formlayout row it needs: 1fr when flexible (grid/tabs/tree), else its pixel height. */
		private static final class Placed {
			final Element control; final boolean flexible; final int height;
			Placed(Element control, boolean flexible, int height) { this.control = control; this.flexible = flexible; this.height = height; }
		}

		/** Rows of a vertical formlayout (12px gaps) and the height they need, counting 260px per flexible row. */
		private static final class Stack {
			private final List<String[]> rows = new ArrayList<String[]>();
			int needed;
			boolean flexible;
			void add(Placed placed) {
				rows.add(placed.flexible ? new String[] { "1", "FRACTION" } : new String[] { String.valueOf(placed.height), "PIXEL" });
				needed += placed.height + (rows.size() > 1 ? 12 : 0);
				flexible |= placed.flexible;
			}
			List<String[]> rows() { return rows.isEmpty() ? rowsOf(new String[] { "1", "FRACTION" }) : rows; }
		}

		private Placed place(UiIr.Region region, Element contentPrototype) {
			Element control = UiIr.GRID.equals(region.getType()) ? buildGridContent(region, contentPrototype, ++gridIndex) : buildRegion(region, contentPrototype);
			return control == null ? null : new Placed(control, isFlexible(region), heightOf(region));
		}

		private Placed buildDivision(List<UiIr.Region> split, Element contentPrototype, Element divisionPrototype) {
			List<UiIr.Region> left = new ArrayList<UiIr.Region>();
			List<UiIr.Region> right = new ArrayList<UiIr.Region>();
			String side = UiIr.LEFT;
			for (UiIr.Region region : split) {
				// A full-width region between two paned ones is read as part of the pane above it.
				if (!region.getSide().isEmpty()) side = region.getSide();
				(UiIr.RIGHT.equals(side) ? right : left).add(region);
			}
			Element division;
			Element prototypeLayout = divisionPrototype == null ? null : layoutOf(divisionPrototype);
			if (prototypeLayout != null && tracks(prototypeLayout, "columns") == 2 && tracks(prototypeLayout, "rows") == 1) {
				division = (Element) divisionPrototype.cloneNode(true);
				stripLayoutData(division);
				removeControls(division);
				reassign(division);
			} else {
				// Shuttle templates have a third (button) column; a plain 1:1 split is the safe default.
				division = element("group");
				division.setAttribute("class", "division-group");
				division.appendChild(formLayout(rowsOf(new String[] { "1", "FRACTION" }), cols(new String[] { "1", "FRACTION" }, new String[] { "1", "FRACTION" }), 16, 12));
			}
			Element layout = layoutOf(division);
			Placed[] panes = { pane(left, contentPrototype), pane(right, contentPrototype) };
			boolean flexible = false;
			int height = 0;
			for (int col = 0; col < panes.length; col++) {
				panes[col].control.insertBefore(formData(0, col), panes[col].control.getFirstChild());
				division.insertBefore(panes[col].control, layout);
				flexible |= panes[col].flexible;
				height = Math.max(height, panes[col].height);
			}
			return new Placed(division, flexible, height);
		}

		/** One pane: a lone region goes in directly (as the templates do), several are stacked in a plain group. */
		private Placed pane(List<UiIr.Region> regions, Element contentPrototype) {
			List<Placed> placed = new ArrayList<Placed>();
			for (UiIr.Region region : regions) { Placed p = place(region, contentPrototype); if (p != null) placed.add(p); }
			if (placed.size() == 1) return placed.get(0);
			Element group = element("group");
			group.setAttribute("id", uniqueId("grp"));
			Stack stack = new Stack();
			for (Placed p : placed) {
				p.control.insertBefore(formData(stack.rows.size(), 0), p.control.getFirstChild());
				group.appendChild(p.control);
				stack.add(p);
			}
			group.appendChild(formLayout(stack.rows(), cols(new String[] { "1", "FRACTION" }), 12, 12));
			return new Placed(group, stack.flexible, stack.needed);
		}

		private static int tracks(Element layout, String name) {
			int n = 0;
			for (Element child : childElements(layout, false)) { if (name.equals(child.getLocalName())) n++; }
			return n;
		}

		private boolean isFlexible(UiIr.Region region) {
			String type = region.getType();
			return UiIr.GRID.equals(type) || UiIr.TABS.equals(type) || UiIr.TREE.equals(type);
		}

		private int heightOf(UiIr.Region region) {
			String type = region.getType();
			if (UiIr.DESCRIPTION.equals(type)) return Math.max(1, lines(region.getText()).size()) * 18 + 8;
			if (UiIr.SECTION_TITLE.equals(type)) return 24;
			if (UiIr.BUTTONS.equals(type)) return 28;
			if (UiIr.TEXTAREA.equals(type)) return 160;
			// A second search region in the body is drawn by buildForm, so it is sized like one.
			if (UiIr.FORM.equals(type) || UiIr.SEARCH.equals(type)) {
				int rows = (int) Math.ceil(region.getFields().size() / (double) perRow(region));
				return (hasText(region.getTitle()) ? 36 : 0) + Math.max(1, rows) * 29 + 4;
			}
			return 260;
		}

		private Element buildRegion(UiIr.Region region, Element contentPrototype) {
			String type = region.getType();
			if (UiIr.DESCRIPTION.equals(type)) return buildDescription(region);
			if (UiIr.SECTION_TITLE.equals(type)) return buildSectionTitle(firstNonBlank(region.getText(), region.getTitle()));
			if (UiIr.FORM.equals(type)) return buildForm(region);
			if (UiIr.BUTTONS.equals(type)) {
				if ("center".equalsIgnoreCase(region.getAlign())) return centeredButtonGroup(region.getButtons(), 28);
				return buttonGroup(region.getButtons(), "left".equalsIgnoreCase(region.getAlign()) ? "left" : "right", 28, false);
			}
			if (UiIr.TEXTAREA.equals(type)) return buildTextArea(region);
			if (UiIr.TABS.equals(type)) return buildTabs(region);
			if (UiIr.TREE.equals(type)) { Element tree = control("tree"); return tree; }
			if (UiIr.SEARCH.equals(type)) return buildForm(region);
			ir.getWarnings().add("Unsupported region skipped: " + type);
			return null;
		}

		// ------------------------------------------------------------------ search

		private void buildSearch(Element search, UiIr.Region region) {
			Element layout = layoutOf(search);
			List<UiIr.Field> fields = region.getFields();
			int perRow = perRow(region);
			int rowCount = Math.max(1, (int) Math.ceil(fields.size() / (double) perRow));
			for (int i = 0; i < fields.size(); i++) {
				UiIr.Field field = fields.get(i);
				int row = i / perRow;
				int col = (i % perRow) * 2;
				search.insertBefore(label(field, row, col, false), layout);
				search.insertBefore(withFormData(fieldControl(field), row, col + 1), layout);
			}
			List<String> buttons = region.getButtons().isEmpty() ? java.util.Arrays.asList("초기화", "조회") : region.getButtons();
			Element buttonGroup = buttonGroup(buttons, "right", 24, true);
			buttonGroup.setAttribute("id", uniqueId("grpBtnSearch"));
			buttonGroup.setAttribute("class", "search-button-group");
			search.insertBefore(withFormData(buttonGroup, rowCount - 1, perRow * 2), layout);
			List<String[]> rows = new ArrayList<String[]>();
			for (int r = 0; r < rowCount; r++) rows.add(new String[] { "24", "PIXEL" });
			List<String[]> columns = new ArrayList<String[]>();
			for (int p = 0; p < perRow; p++) { columns.add(new String[] { "80", "PIXEL", "auto" }); columns.add(new String[] { "1", "FRACTION" }); }
			columns.add(new String[] { "97", "PIXEL", "auto" });
			Element newLayout = formLayout(rows, columns, 6, 6);
			if (layout != null) search.replaceChild(newLayout, layout); else search.appendChild(newLayout);
			Element vd = firstChildByLocalName(search, "verticaldata");
			int height = rowCount * 24 + (rowCount - 1) * 6 + 20;
			if (vd != null) vd.setAttribute("height", height + "px");
		}

		private int perRow(UiIr.Region region) {
			int n = region.getColumnsPerRow();
			return n > 0 && n <= 6 ? n : FIELDS_PER_ROW;
		}

		private Element label(UiIr.Field field, int row, int col, boolean ignoreSpacing) {
			Element output = control("output");
			output.setAttribute("class", field.isRequired() ? "label required" : "label");
			output.setAttribute("value", field.getLabel());
			Element fd = formData(row, col);
			if (ignoreSpacing) fd.setAttribute("ignore-layout-spacing", "true");
			output.appendChild(fd);
			return output;
		}

		private Element fieldControl(UiIr.Field field) {
			String component = field.getComponent();
			if ("daterange".equals(component)) {
				Element group = element("group");
				group.setAttribute("id", uniqueId("grp"));
				group.setAttribute("class", "form-control");
				group.appendChild(withFormData(control("dateinput"), 0, 0));
				Element tilde = control("output");
				tilde.setAttribute("value", "~");
				group.appendChild(withFormData(tilde, 0, 1));
				group.appendChild(withFormData(control("dateinput"), 0, 2));
				group.appendChild(formLayout(rowsOf(new String[] { "1", "FRACTION" }), cols(new String[] { "1", "FRACTION" }, new String[] { "10", "PIXEL", "auto" }, new String[] { "1", "FRACTION" }), 6, 6));
				return group;
			}
			Element control = control(ID_PREFIX.containsKey(component) ? component : "inputbox");
			if ("checkbox".equals(component) || "radiobutton".equals(component)) control.setAttribute("text", "");
			if ("output".equals(component)) control.setAttribute("value", field.getValue());
			return control;
		}

		// ------------------------------------------------------------------ grid

		private Element buildGridContent(UiIr.Region region, Element prototype, int index) {
			Element content;
			Element grid;
			if (prototype != null) {
				content = (Element) prototype.cloneNode(true);
				stripLayoutData(content);
				reassign(content);
				grid = descendantsByLocalName(content, "grid").get(0);
			} else {
				content = element("group");
				content.setAttribute("id", uniqueId("grp"));
				content.setAttribute("class", "content");
				Element udc = element("udc");
				udc.setAttribute("id", uniqueId("udccomgridtitle"));
				udc.setAttribute("type", "udc.com.udcComGridTitle");
				content.appendChild(withFormData(udc, 0, 0));
				grid = control("grid");
				content.appendChild(withFormData(grid, 1, 0));
				content.appendChild(formLayout(rowsOf(new String[] { "24", "PIXEL", "auto" }, new String[] { "1", "FRACTION" }), cols(new String[] { "1", "FRACTION" }), 4, 4));
			}
			// Keep only one grid in the cloned content and rebuild its bands.
			List<Element> grids = descendantsByLocalName(content, "grid");
			for (int i = 1; i < grids.size(); i++) grids.get(i).getParentNode().removeChild(grids.get(i));
			for (Element udc : descendantsByLocalName(content, "udc")) {
				if (udc.getAttribute("type").endsWith("udcComGridTitle")) setUdcProperty(udc, "title", firstNonBlank(region.getTitle(), index == 1 ? ir.getScreenName() : "목록 " + index));
			}
			// The template's title-row buttons (행추가/행삭제 ...) are placeholders; the grid's own buttons replace them.
			for (Element titleButtons : descendantsByClass(content, "title-button-group")) {
				removeControls(titleButtons);
				Element flow = layoutOf(titleButtons);
				for (String text : region.getButtons()) titleButtons.insertBefore(button(text, 24, true), flow);
			}
			for (Element child : childElements(grid, false)) { if (!isLayoutData(child)) grid.removeChild(child); }
			grid.setAttribute("id", grid.getAttribute("id").isEmpty() ? uniqueId("grd") : grid.getAttribute("id"));
			fillGrid(grid, region);
			return content;
		}

		private void fillGrid(Element grid, UiIr.Region region) {
			List<UiIr.Column> columns = region.getColumns();
			String datasetId = uniqueId("dsList");
			Element dataset = element("dataset");
			dataset.setAttribute("id", datasetId);
			Element columnList = doc.createElementNS(CL, "cl:datacolumnlist");
			dataset.appendChild(columnList);
			Set<String> usedNames = new HashSet<String>();
			double scale = ir.getSourceWidth() > 0 ? Math.min(2.5, CONTENT_WIDTH / (double) ir.getSourceWidth()) : 1.0;

			for (UiIr.Column column : columns) {
				Element gc = element("gridcolumn");
				gc.setAttribute("width", columnWidth(column, scale) + "px");
				grid.appendChild(gc);
			}
			Element headerBand = element("gridheader");
			Element detailBand = element("griddetail");
			headerBand.appendChild(gridRow());
			detailBand.appendChild(gridRow());
			grid.appendChild(headerBand);
			grid.appendChild(detailBand);

			for (int i = 0; i < columns.size(); i++) {
				UiIr.Column column = columns.get(i);
				String editor = column.getEditor();
				Element headerCell = gridCell("gh-cell", i);
				Element detailCell = gridCell("gd-cell", i);
				headerBand.appendChild(headerCell);
				detailBand.appendChild(detailCell);
				if ("checkbox".equals(editor) && column.getHeader().isEmpty()) headerCell.setAttribute("columntype", "checkbox");
				else headerCell.setAttribute("text", column.getHeader());
				if ("checkbox".equals(editor) && isRowSelector(column, i)) { detailCell.setAttribute("columntype", "checkbox"); continue; }
				if ("rowindex".equals(editor)) { detailCell.setAttribute("columntype", "rowindex"); continue; }
				if ("button".equals(editor)) {
					Element button = control("button");
					button.setAttribute("class", "btn-secondary-03");
					button.setAttribute("value", firstNonBlank(column.getCellText(), column.getHeader(), "버튼"));
					detailCell.appendChild(button);
					continue;
				}
				String name = columnName(column, i, usedNames);
				Element dc = element("datacolumn");
				dc.setAttribute("name", name);
				if ("numbereditor".equals(editor)) dc.setAttribute("datatype", "number");
				columnList.appendChild(dc);
				headerCell.setAttribute("targetcolumnname", name);
				detailCell.setAttribute("columnname", name);
				if ("checkbox".equals(editor)) { Element cbx = control("checkbox"); cbx.setAttribute("text", ""); detailCell.appendChild(cbx); }
				else if (!"output".equals(editor) && ID_PREFIX.containsKey(editor)) detailCell.appendChild(control(editor));
			}
			if (columnList.getChildNodes().getLength() > 0) {
				grid.setAttribute("datasetid", datasetId);
				ensureModel().appendChild(dataset);
			}
		}

		/** A leading checkbox column without data meaning is eXBuilder6's row-check column. */
		private boolean isRowSelector(UiIr.Column column, int index) {
			return index <= 1 && !column.getCellText().matches("[A-Z][A-Z0-9_]*");
		}

		private int columnWidth(UiIr.Column column, double scale) {
			if (column.getWidth() > 0) return Math.max(30, Math.min(800, (int) Math.round(column.getWidth() * scale)));
			String editor = column.getEditor();
			if ("checkbox".equals(editor)) return 40;
			if ("rowindex".equals(editor)) return 50;
			// Unknown width: estimate from the header and the first line of the sample cell (Korean ≈ 13px, Latin ≈ 7px).
			int text = Math.max(textWidth(column.getHeader()) + 24, textWidth(column.getCellText().split("\\r?\\n")[0]) + 20);
			return Math.max(80, Math.min(420, text));
		}

		private int textWidth(String text) {
			int width = 0;
			for (char ch : text.toCharArray()) width += ch >= 0x1100 ? 13 : 7;
			return width;
		}

		private String columnName(UiIr.Column column, int index, Set<String> used) {
			// Design-mode grids show the bound column name (e.g. "FNM", "ACNO_____"); sample data like "onBodyLoad" is not one.
			String candidate = ColumnNames.codeOf(column.getCellText());
			if (!candidate.matches("[A-Z][A-Z0-9_]{1,40}")) {
				String header = column.getHeader().replace(" ", "");
				candidate = ColumnNames.nameFor(header);
				if (candidate.isEmpty() && header.matches("[A-Za-z][A-Za-z0-9_]*")) candidate = header.toUpperCase(Locale.ROOT);
				if (candidate.isEmpty()) candidate = "COL" + (index + 1);
			}
			String name = candidate;
			for (int n = 2; !used.add(name); n++) name = candidate + n;
			return name;
		}

		private Element gridRow() {
			Element row = element("gridrow");
			row.setAttribute("height", "25px");
			return row;
		}

		private Element gridCell(String sidPrefix, int col) {
			Element cell = doc.createElementNS(CL, "cl:gridcell");
			cell.setAttributeNS(STD, "std:sid", uniqueSid(sidPrefix));
			cell.setAttribute("rowindex", "0");
			cell.setAttribute("colindex", String.valueOf(col));
			return cell;
		}

		// ------------------------------------------------------------------ other regions

		private Element buildDescription(UiIr.Region region) {
			Element group = element("group");
			group.setAttribute("id", uniqueId("grp"));
			List<String> lines = lines(firstNonBlank(region.getText(), region.getTitle()));
			List<String[]> rows = new ArrayList<String[]>();
			for (int i = 0; i < lines.size(); i++) {
				Element output = control("output");
				output.setAttribute("value", lines.get(i));
				group.appendChild(withFormData(output, i, 0));
				rows.add(new String[] { "18", "PIXEL" });
			}
			group.appendChild(formLayout(rows, cols(new String[] { "1", "FRACTION" }), 0, 0));
			return group;
		}

		private Element buildSectionTitle(String text) {
			Element box = element("group");
			box.setAttribute("id", uniqueId("grp"));
			box.setAttribute("class", "content-title-box");
			Element output = control("output");
			output.setAttribute("class", "form-tit");
			output.setAttribute("value", text);
			box.appendChild(withFormData(output, 0, 0));
			box.appendChild(formLayout(rowsOf(new String[] { "1", "FRACTION" }), cols(new String[] { "1", "FRACTION", "auto" }), 32, 0));
			return box;
		}

		private Element buildForm(UiIr.Region region) {
			Element content = element("group");
			content.setAttribute("id", uniqueId("grp"));
			content.setAttribute("class", "content");
			int row = 0;
			List<String[]> contentRows = new ArrayList<String[]>();
			if (hasText(region.getTitle())) {
				content.appendChild(withFormData(buildSectionTitle(region.getTitle()), row++, 0));
				contentRows.add(new String[] { "24", "PIXEL", "auto" });
			}
			Element form = element("group");
			form.setAttribute("id", uniqueId("grp"));
			form.setAttribute("class", "form-base");
			int perRow = perRow(region);
			List<UiIr.Field> fields = region.getFields();
			int rowCount = Math.max(1, (int) Math.ceil(fields.size() / (double) perRow));
			for (int i = 0; i < fields.size(); i++) {
				int r = i / perRow;
				int c = (i % perRow) * 2;
				form.appendChild(label(fields.get(i), r, c, true));
				Element control = withFormData(fieldControl(fields.get(i)), r, c + 1);
				if (i == fields.size() - 1 && c + 1 < perRow * 2 - 1) firstChildByLocalName(control, "formdata").setAttribute("colspan", String.valueOf(perRow * 2 - c - 1));
				form.appendChild(control);
			}
			List<String[]> rows = new ArrayList<String[]>();
			for (int r = 0; r < rowCount; r++) rows.add(new String[] { "24", "PIXEL" });
			List<String[]> columns = new ArrayList<String[]>();
			for (int p = 0; p < perRow; p++) { columns.add(new String[] { "80", "PIXEL", "auto" }); columns.add(new String[] { "1", "FRACTION" }); }
			Element layout = formLayout(rows, columns, 9, 5);
			layout.setAttribute("top-margin", "2px"); layout.setAttribute("right-margin", "4px"); layout.setAttribute("bottom-margin", "2px"); layout.setAttribute("left-margin", "4px");
			layout.setAttribute("hseparatorwidth", "1"); layout.setAttribute("hseparatortype", "BY_CLASS"); layout.setAttribute("vseparatorwidth", "1"); layout.setAttribute("vseparatortype", "BY_CLASS");
			form.appendChild(layout);
			content.appendChild(withFormData(form, row, 0));
			contentRows.add(new String[] { "1", "FRACTION" });
			content.appendChild(formLayout(contentRows, cols(new String[] { "1", "FRACTION" }), 4, 4));
			return content;
		}

		private Element buildTextArea(UiIr.Region region) {
			Element content = element("group");
			content.setAttribute("id", uniqueId("grp"));
			content.setAttribute("class", "content");
			boolean hasHeader = hasText(region.getTitle()) || !region.getButtons().isEmpty();
			int row = 0;
			if (hasHeader) {
				if (hasText(region.getTitle())) {
					Element output = control("output");
					output.setAttribute("class", "form-tit");
					output.setAttribute("value", region.getTitle());
					content.appendChild(withFormData(output, 0, 0));
				}
				if (!region.getButtons().isEmpty()) content.appendChild(withFormData(buttonGroup(region.getButtons(), "right", 24, true), 0, 1));
				row = 1;
			}
			Element textarea = control("textarea");
			Element fd = formData(row, 0);
			fd.setAttribute("colspan", "2");
			textarea.appendChild(fd);
			content.appendChild(textarea);
			List<String[]> rows = hasHeader ? rowsOf(new String[] { "24", "PIXEL" }, new String[] { "1", "FRACTION" }) : rowsOf(new String[] { "1", "FRACTION" });
			content.appendChild(formLayout(rows, cols(new String[] { "1", "FRACTION" }, new String[] { "97", "PIXEL", "auto" }), 4, 4));
			return content;
		}

		private Element buildTabs(UiIr.Region region) {
			Element folder = element("tabfolder");
			folder.setAttribute("class", "tab-filled");
			List<String> tabs = region.getTabs().isEmpty() ? java.util.Arrays.asList("탭1") : region.getTabs();
			for (int i = 0; i < tabs.size(); i++) {
				Element item = element("tabitem");
				if (i == 0) item.setAttribute("selected", "true");
				item.setAttribute("text", tabs.get(i));
				Element group = element("group");
				group.appendChild(formLayout(rowsOf(new String[] { "1", "FRACTION" }), cols(new String[] { "1", "FRACTION" }), 12, 12));
				item.appendChild(group);
				folder.appendChild(item);
			}
			return folder;
		}

		private void buildFooter(Element footer, UiIr.Region region) {
			List<Element> buttonGroups = descendantsByClass(footer, "footer-button-group");
			if (buttonGroups.isEmpty()) { footer.getParentNode().removeChild(footer); return; }
			List<Element> sides = childElements(buttonGroups.get(0), true);
			boolean left = "left".equalsIgnoreCase(region.getAlign());
			Element target = sides.isEmpty() ? buttonGroups.get(0) : sides.get(left || sides.size() == 1 ? 0 : sides.size() - 1);
			Element layout = layoutOf(target);
			for (String text : region.getButtons()) target.insertBefore(button(text, 28, false), layout);
		}

		private Element buttonGroup(List<String> buttons, String align, int height, boolean compact) {
			Element group = element("group");
			group.setAttribute("id", uniqueId("grp"));
			for (String text : buttons) group.appendChild(button(text, height, compact));
			Element flow = element("flowlayout");
			flow.setAttribute("hspacing", "6");
			flow.setAttribute("vspacing", "0");
			flow.setAttribute("halign", align);
			flow.setAttribute("linewrap", "false");
			group.appendChild(flow);
			return group;
		}

		/**
		 * Centered buttons, done the way the shuttle templates (P7-3) center their arrow buttons: a formlayout
		 * with 1fr side margins. flowlayout halign="center" appears in no template, so it is not used.
		 */
		private Element centeredButtonGroup(List<String> buttons, int height) {
			Element group = element("group");
			group.setAttribute("id", uniqueId("grp"));
			List<String[]> columns = new ArrayList<String[]>();
			for (int i = 0; i < buttons.size(); i++) {
				String text = buttons.get(i);
				Element button = button(text, height, false);
				stripLayoutData(button);
				group.appendChild(withFormData(button, 0, i));
				columns.add(iconClass(text) != null ? new String[] { "24", "PIXEL" } : new String[] { String.valueOf(buttonWidth(text)), "PIXEL", "auto" });
			}
			if (columns.isEmpty()) columns.add(new String[] { "1", "FRACTION" });
			Element layout = formLayout(rowsOf(new String[] { String.valueOf(height), "PIXEL" }), columns, 6, 0);
			layout.setAttribute("left-margin", "1fr");
			layout.setAttribute("right-margin", "1fr");
			group.appendChild(layout);
			return group;
		}

		/** Arrow-only buttons map to the theme's icon buttons (P7 shuttle templates); the model writes them as ▲ ▼ ◀ ▶. */
		private static String iconClass(String text) {
			String t = text.trim();
			if (t.matches("[▲△↑⬆⏶]")) return "btn-up";
			if (t.matches("[▼▽↓⬇⏷]")) return "btn-down";
			if (t.matches("[◀◁←⬅]")) return "btn-left";
			if (t.matches("[▶▷→➡]")) return "btn-right";
			return null;
		}

		private static int buttonWidth(String text) { return Math.max(40, text.length() * 14 + 16); }

		/** Button style classes follow the template repository conventions. */
		private Element button(String text, int height, boolean compact) {
			Element button = control("button");
			String icon = iconClass(text);
			if (icon != null) {
				button.setAttribute("class", icon);
				Element data = element("flowlayoutdata");
				data.setAttribute("width", "20px");
				data.setAttribute("height", "24px");
				data.setAttribute("autosize", "none");
				button.appendChild(data);
				return button;
			}
			String t = text.replace(" ", "");
			String cls;
			if (compact) cls = t.matches(".*(조회|검색|찾기|Search|search).*") ? "btn-primary-02" : "btn-secondary-03 btn-md";
			else if (t.matches(".*(저장|등록|확인|적용|승인|신청).*")) cls = "btn-primary-01";
			else if (t.matches(".*(삭제|취소|반려).*")) cls = "btn-secondary-02";
			else cls = "btn-secondary-01";
			button.setAttribute("class", cls);
			button.setAttribute("value", text);
			Element data = element("flowlayoutdata");
			data.setAttribute("width", buttonWidth(text) + "px");
			data.setAttribute("height", height + "px");
			data.setAttribute("autosize", "width");
			button.appendChild(data);
			return button;
		}

		// ------------------------------------------------------------------ node factories

		private Element element(String localName) {
			Element e = doc.createElementNS(CL, "cl:" + localName);
			String prefix = SID_PREFIX.get(localName);
			if (prefix != null) e.setAttributeNS(STD, "std:sid", uniqueSid(prefix));
			return e;
		}

		private Element control(String localName) {
			Element e = element(localName);
			String prefix = ID_PREFIX.get(localName);
			if (prefix != null) e.setAttribute("id", uniqueId(prefix));
			return e;
		}

		private Element withFormData(Element control, int row, int col) {
			control.insertBefore(formData(row, col), control.getFirstChild());
			return control;
		}

		private Element formData(int row, int col) {
			Element fd = element("formdata");
			fd.setAttribute("row", String.valueOf(row));
			fd.setAttribute("col", String.valueOf(col));
			return fd;
		}

		private Element verticalData(int width, int height, boolean autoHeight) {
			Element vd = element("verticaldata");
			vd.setAttribute("width", width + "px");
			vd.setAttribute("height", height + "px");
			if (autoHeight) vd.setAttribute("autosize", "height");
			return vd;
		}

		/** Track spec: {length, unit, optional "auto"}. */
		private Element formLayout(List<String[]> rows, List<String[]> columns, int hspace, int vspace) {
			Element layout = element("formlayout");
			layout.setAttribute("scrollable", "false");
			layout.setAttribute("hspace", hspace + "px");
			layout.setAttribute("vspace", vspace + "px");
			layout.setAttribute("top-margin", "0px");
			layout.setAttribute("right-margin", "0px");
			layout.setAttribute("bottom-margin", "0px");
			layout.setAttribute("left-margin", "0px");
			for (String[] r : rows) layout.appendChild(track("rows", r));
			for (String[] c : columns) layout.appendChild(track("columns", c));
			return layout;
		}

		private Element track(String name, String[] spec) {
			Element track = doc.createElementNS(CL, "cl:" + name);
			track.setAttribute("length", spec[0]);
			track.setAttribute("unit", spec[1]);
			if (spec.length > 2 && "auto".equals(spec[2])) { track.setAttribute("autoSizing", "true"); track.setAttribute("syncminlength", "false"); }
			return track;
		}

		private static List<String[]> rowsOf(String[]... specs) { return java.util.Arrays.asList(specs); }
		private static List<String[]> cols(String[]... specs) { return java.util.Arrays.asList(specs); }

		/** eXBuilder6 UDC property assignment inside the cl:udc element. */
		private void setUdcProperty(Element udc, String name, String value) {
			if (!hasText(value)) return;
			for (Element property : childElements(udc, false)) {
				if ("property".equals(property.getLocalName()) && name.equals(property.getAttribute("name"))) { property.setAttribute("value", value); return; }
			}
			Element property = doc.createElementNS(CL, "cl:property");
			property.setAttribute("name", name);
			property.setAttribute("value", value);
			property.setAttribute("type", "string");
			udc.appendChild(property);
		}

		private Element ensureModel() {
			if (model != null) return model;
			Element head = firstByLocalName(doc.getDocumentElement(), "head");
			model = element("model");
			head.insertBefore(model, firstChildByLocalName(head, "appspec"));
			return model;
		}

		// ------------------------------------------------------------------ id / sid

		private void collectExisting(Element root) {
			String sid = root.getAttributeNS(STD, "sid");
			if (!sid.isEmpty()) sids.add(sid);
			if (!root.getAttribute("id").isEmpty()) ids.add(root.getAttribute("id"));
			for (Element child : childElements(root, false)) collectExisting(child);
		}

		private String uniqueSid(String prefix) {
			while (true) {
				String sid = prefix + "-" + String.format("%08x", random.nextInt());
				if (sids.add(sid)) return sid;
			}
		}

		private String uniqueId(String prefix) {
			if (!prefix.matches(".*\\d$") && !prefix.startsWith("grpBtn")) {
				for (int n = 1; ; n++) { if (ids.add(prefix + n)) return prefix + n; }
			}
			if (ids.add(prefix)) return prefix;
			for (int n = 2; ; n++) { if (ids.add(prefix + "_" + n)) return prefix + "_" + n; }
		}

		/** Gives a cloned subtree fresh sids and ids so it can be reused several times. */
		private void reassign(Element element) {
			if (element.hasAttributeNS(STD, "sid")) {
				String old = element.getAttributeNS(STD, "sid");
				int dash = old.lastIndexOf('-');
				element.setAttributeNS(STD, "std:sid", uniqueSid(dash > 0 ? old.substring(0, dash) : element.getLocalName()));
			}
			if (element.hasAttribute("id") && !"property".equals(element.getLocalName())) {
				element.setAttribute("id", uniqueId(element.getAttribute("id").replaceAll("\\d+$", "")));
			}
			for (Element child : childElements(element, false)) reassign(child);
		}

		// ------------------------------------------------------------------ DOM helpers

		private void removeControls(Element container) {
			for (Element child : childElements(container, true)) container.removeChild(child);
		}

		private void stripLayoutData(Element control) {
			for (Element child : childElements(control, false)) { if (isLayoutData(child)) control.removeChild(child); }
		}

		private static boolean isLayoutData(Element e) {
			String n = e.getLocalName();
			return "formdata".equals(n) || "verticaldata".equals(n) || "flowlayoutdata".equals(n) || "xylayoutdata".equals(n);
		}

		private static boolean isLayout(Element e) {
			String n = e.getLocalName();
			return "formlayout".equals(n) || "verticallayout".equals(n) || "flowlayout".equals(n) || "xylayout".equals(n) || "responsivexylayout".equals(n);
		}

		/** Child elements; when controlsOnly, layout, layout-data, listener and metadata nodes are excluded. */
		private static List<Element> childElements(Element parent, boolean controlsOnly) {
			List<Element> result = new ArrayList<Element>();
			NodeList nodes = parent.getChildNodes();
			for (int i = 0; i < nodes.getLength(); i++) {
				if (!(nodes.item(i) instanceof Element)) continue;
				Element e = (Element) nodes.item(i);
				if (controlsOnly && (isLayout(e) || isLayoutData(e) || !CL.equals(e.getNamespaceURI()) || "listener".equals(e.getLocalName()) || "property".equals(e.getLocalName()))) continue;
				result.add(e);
			}
			return result;
		}

		private static Element layoutOf(Element container) {
			for (Element child : childElements(container, false)) { if (isLayout(child)) return child; }
			return null;
		}

		private static Element firstChildByLocalName(Element parent, String localName) {
			for (Element child : childElements(parent, false)) { if (localName.equals(child.getLocalName())) return child; }
			return null;
		}

		private static Element firstByLocalName(Element root, String localName) {
			List<Element> found = descendantsByLocalName(root, localName);
			return found.isEmpty() ? null : found.get(0);
		}

		private static List<Element> descendantsByLocalName(Element root, String localName) {
			List<Element> result = new ArrayList<Element>();
			NodeList nodes = root.getElementsByTagNameNS("*", localName);
			for (int i = 0; i < nodes.getLength(); i++) result.add((Element) nodes.item(i));
			return result;
		}

		private static List<Element> descendantsByClass(Element root, String cls) {
			List<Element> result = new ArrayList<Element>();
			for (Element group : descendantsByLocalName(root, "group")) { if (hasClass(group, cls)) result.add(group); }
			return result;
		}

		private static boolean hasClass(Element e, String cls) {
			for (String c : e.getAttribute("class").trim().split("\\s+")) { if (c.equals(cls)) return true; }
			return false;
		}

		private static Element findGroup(Element body, String id, String cls, String altCls) {
			for (Element group : descendantsByLocalName(body, "group")) { if (id.equals(group.getAttribute("id"))) return group; }
			for (Element group : descendantsByLocalName(body, "group")) { if (hasClass(group, cls) || (altCls != null && hasClass(group, altCls))) return group; }
			return null;
		}

		private static Element findUdc(Element body, String typeSuffix) {
			for (Element udc : descendantsByLocalName(body, "udc")) { if (udc.getAttribute("type").endsWith(typeSuffix)) return udc; }
			return null;
		}

		private static void stripWhitespace(Node node) {
			NodeList children = node.getChildNodes();
			for (int i = children.getLength() - 1; i >= 0; i--) {
				Node child = children.item(i);
				if (child.getNodeType() == Node.TEXT_NODE && child.getTextContent().trim().isEmpty()) node.removeChild(child);
				else if (child.getNodeType() == Node.ELEMENT_NODE) stripWhitespace(child);
			}
		}

		private static int parsePx(String value, int defaultValue) {
			try { return Integer.parseInt(value.replace("px", "").trim()); } catch (Exception e) { return defaultValue; }
		}

		private static List<String> lines(String text) {
			List<String> result = new ArrayList<String>();
			for (String line : (text == null ? "" : text).split("\\r?\\n")) { if (!line.trim().isEmpty()) result.add(line.trim()); }
			if (result.isEmpty()) result.add("");
			return result;
		}

		private static boolean hasText(String value) { return value != null && !value.trim().isEmpty(); }

		private static String firstNonBlank(String... values) {
			for (String value : values) { if (hasText(value)) return value.trim(); }
			return "";
		}
	}
}
