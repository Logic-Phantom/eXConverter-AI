package com.tomatosystem.exconverter.service;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

public final class ClxValidator {
	private static final String CL_NAMESPACE = "http://tomatosystem.co.kr/cleopatra";
	private ClxValidator() { }
	public static List<String> validate(byte[] contents) {
		List<String> errors = new ArrayList<String>();
		try {
			DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance(); factory.setNamespaceAware(true);
			Document document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(contents));
			NodeList screens = document.getElementsByTagName("screen");
			if (screens.getLength() == 0) errors.add("screen definition is missing");
			Set<String> ids = new HashSet<String>(); NodeList controls = document.getElementsByTagNameNS(CL_NAMESPACE, "*");
			for (int i = 0; i < controls.getLength(); i++) { String id = ((Element) controls.item(i)).getAttribute("id"); if (!id.isEmpty() && !ids.add(id)) errors.add("duplicate id: " + id); }
			if (document.getElementsByTagNameNS(CL_NAMESPACE, "grid").getLength() == 0) errors.add("grid is missing");
		} catch (Exception e) { errors.add("XML is not well formed: " + e.getMessage()); }
		return errors;
	}
}
