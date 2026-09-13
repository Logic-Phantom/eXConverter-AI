package com.tomatosystem.exconverter.service;

import com.tomatosystem.exconverter.model.UiIr;
import org.json.JSONArray;
import org.json.JSONObject;

/** Parses the agreed UI-IR JSON contract. It intentionally has no CLX knowledge. */
public final class UiIrParser {
	private UiIrParser() { }
	public static UiIr parse(String json) {
		JSONObject root = new JSONObject(json);
		JSONObject screen = root.getJSONObject("screen");
		UiIr result = new UiIr();
		result.setScreenName(required(screen, "name"));
		result.setWidth(screen.getInt("width")); result.setHeight(screen.getInt("height"));
		if (result.getWidth() < 320 || result.getHeight() < 320) throw new IllegalArgumentException("screen width and height must be at least 320");
		JSONArray regions = root.getJSONArray("regions");
		for (int i = 0; i < regions.length(); i++) {
			JSONObject region = regions.getJSONObject(i); String type = required(region, "type");
			if ("search".equalsIgnoreCase(type)) parseFields(region.optJSONArray("fields"), result);
			if ("grid".equalsIgnoreCase(type)) parseColumns(region.optJSONArray("columns"), result);
		}
		if (result.getGridColumns().isEmpty()) throw new IllegalArgumentException("UI-IR requires one grid region with columns");
		return result;
	}
	private static void parseFields(JSONArray fields, UiIr result) {
		if (fields == null) return;
		for (int i = 0; i < fields.length(); i++) { JSONObject f = fields.getJSONObject(i); result.getSearchFields().add(new UiIr.Field(required(f, "label"), required(f, "component"), f.optBoolean("required", false))); }
	}
	private static void parseColumns(JSONArray columns, UiIr result) {
		if (columns == null) return;
		for (int i = 0; i < columns.length(); i++) { String column = columns.getString(i).trim(); if (!column.isEmpty()) result.getGridColumns().add(column); }
	}
	private static String required(JSONObject object, String key) { String value = object.optString(key, "").trim(); if (value.isEmpty()) throw new IllegalArgumentException(key + " is required"); return value; }
}
