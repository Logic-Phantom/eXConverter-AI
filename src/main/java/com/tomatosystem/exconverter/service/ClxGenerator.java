package com.tomatosystem.exconverter.service;

import com.tomatosystem.exconverter.model.UiIr;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.file.Files;
import java.util.List;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/** P1-1 deterministic compiler. It starts from an approved template and never creates arbitrary XML. */
public class ClxGenerator {
	private static final String CL_NAMESPACE = "http://tomatosystem.co.kr/cleopatra";
	public byte[] generate(File template, UiIr ir) {
		try {
			DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance(); factory.setNamespaceAware(true); factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
			Document doc = factory.newDocumentBuilder().parse(new ByteArrayInputStream(Files.readAllBytes(template.toPath())));
			applyScreen(doc, ir); applySearchFields(doc, ir.getSearchFields()); applyGridHeaders(doc, ir.getGridColumns());
			ByteArrayOutputStream output = new ByteArrayOutputStream(); Transformer transformer = TransformerFactory.newInstance().newTransformer();
			transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8"); transformer.setOutputProperty(OutputKeys.INDENT, "yes"); transformer.transform(new DOMSource(doc), new StreamResult(output));
			return output.toByteArray();
		} catch (Exception e) { throw new IllegalStateException("CLX generation failed", e); }
	}
	private void applyScreen(Document doc, UiIr ir) {
		NodeList screens = doc.getElementsByTagName("screen");
		for (int i = 0; i < screens.getLength(); i++) { Element screen = (Element) screens.item(i); if ("EXB-FULL".equals(screen.getAttribute("id"))) { screen.setAttribute("name", ir.getScreenName()); screen.setAttribute("width", ir.getWidth() + "px"); screen.setAttribute("height", ir.getHeight() + "px"); } }
	}
	private void applySearchFields(Document doc, List<UiIr.Field> fields) {
		NodeList outputs = doc.getElementsByTagNameNS(CL_NAMESPACE, "output"); int index = 0;
		for (int i = 0; i < outputs.getLength() && index < fields.size(); i++) { Element output = (Element) outputs.item(i); if (output.getAttribute("id").matches("opt[1-8]")) { UiIr.Field field = fields.get(index++); output.setAttribute("value", field.getLabel()); if (field.isRequired()) output.setAttribute("class", "label required"); } }
	}
	private void applyGridHeaders(Document doc, List<String> columns) {
		NodeList headers = doc.getElementsByTagNameNS(CL_NAMESPACE, "gridheader"); if (headers.getLength() == 0) return;
		NodeList cells = ((Element) headers.item(0)).getElementsByTagNameNS(CL_NAMESPACE, "gridcell");
		for (int i = 0; i < cells.getLength() && i < columns.size(); i++) ((Element) cells.item(i)).setAttribute("text", columns.get(i));
	}
}
