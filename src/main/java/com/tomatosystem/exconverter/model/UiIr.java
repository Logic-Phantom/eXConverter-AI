package com.tomatosystem.exconverter.model;

import java.util.ArrayList;
import java.util.List;

/** Framework-independent intermediate representation used between AI/OCR and CLX. */
public class UiIr {
	private String screenName;
	private int width;
	private int height;
	private final List<Field> searchFields = new ArrayList<Field>();
	private final List<String> gridColumns = new ArrayList<String>();

	public String getScreenName() { return screenName; }
	public void setScreenName(String screenName) { this.screenName = screenName; }
	public int getWidth() { return width; }
	public void setWidth(int width) { this.width = width; }
	public int getHeight() { return height; }
	public void setHeight(int height) { this.height = height; }
	public List<Field> getSearchFields() { return searchFields; }
	public List<String> getGridColumns() { return gridColumns; }

	public static class Field {
		private final String label;
		private final String component;
		private final boolean required;
		public Field(String label, String component, boolean required) { this.label = label; this.component = component; this.required = required; }
		public String getLabel() { return label; }
		public String getComponent() { return component; }
		public boolean isRequired() { return required; }
	}
}
