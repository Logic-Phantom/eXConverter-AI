package com.tomatosystem.exconverter.service;

import java.io.File;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Image-to-UI-IR on gemini-3.5-flash-lite, a separate engine next to {@link GeminiUiIrAnalyzer}
 * (gemini-3.5-flash). Only the model differs: prompt, image scaling, retries, thinkingLevel and token limits
 * all come from the shared exconverter.gemini.* settings, so the call itself is the same code path.
 *
 * Why a second engine instead of changing exconverter.gemini.model: the free tier counts quota per model,
 * and flash-lite has a much larger daily allowance (measured 2026-09-02: flash 5 RPM / 20 RPD, flash-lite
 * 15 RPM / 500 RPD). Keeping both endpoints lets the flash path stay as the verified default while the
 * lite path absorbs volume. See README section 15.8.
 *
 * Composition, not a subclass: a subclass would be a second bean of type GeminiUiIrAnalyzer and break
 * the by-type @Autowired in GeminiConversionController.
 */
@Service
public class GeminiLiteUiIrAnalyzer {
	public static final String ENGINE = "gemini-lite";
	static final String DEFAULT_MODEL = "gemini-3.5-flash-lite";

	@Autowired private GeminiUiIrAnalyzer gemini;

	public static String model() { return ExConverterConfig.get("exconverter.gemini.lite.model", DEFAULT_MODEL); }
	public static boolean isConfigured() { return GeminiUiIrAnalyzer.isConfigured(); }
	public static JSONObject describe() { return GeminiUiIrAnalyzer.describe(ENGINE, model()); }

	public ImageUiIrAnalyzer.Analysis analyze(File image, String originalName) { return gemini.analyze(image, originalName, model()); }

	/** Usage is kept per thread by the shared analyzer, so this is the usage of this thread's last lite call. */
	public JSONObject lastUsage() { return gemini.lastUsage(); }
}
