package com.tomatosystem.exconverter.web;

import com.tomatosystem.exconverter.service.TemplateWatcher;
import java.io.IOException;
import javax.servlet.http.HttpServletResponse;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

/**
 * Template repository health, see {@link TemplateWatcher}:
 *
 * <pre>
 *   GET      /EXConverter/templates/status.do   last analysis (every template: status, layout, selection, roundtrip)
 *   GET/POST /EXConverter/templates/rescan.do   re-analyse every template now and return the result
 * </pre>
 */
@Controller
@RequestMapping("/EXConverter/templates")
public class TemplateController {
	@Autowired private TemplateWatcher watcher;

	@RequestMapping(value = "/status.do", method = RequestMethod.GET, produces = "application/json;charset=UTF-8")
	public void status(HttpServletResponse response) throws IOException {
		JSONObject report = watcher.report();
		if (!report.has("items")) report = watcher.scan(false);
		write(response, report);
	}

	@RequestMapping(value = "/rescan.do", method = { RequestMethod.GET, RequestMethod.POST }, produces = "application/json;charset=UTF-8")
	public void rescan(HttpServletResponse response) throws IOException {
		write(response, watcher.scan(true));
	}

	private void write(HttpServletResponse response, JSONObject value) throws IOException {
		response.setContentType("application/json;charset=UTF-8");
		response.getWriter().write(value.toString(2));
	}
}
