(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  if (!SDK || !SDK.React) {
    console.error("Hermes Command Center: missing plugin SDK");
    return;
  }

  const React = SDK.React;
  const h = React.createElement;
  const { useCallback, useEffect, useMemo, useState } = React;
  const UI = SDK.components || SDK.ui || {};
  const api = SDK.api || {};

  function join() {
    return Array.prototype.slice.call(arguments).filter(Boolean).join(" ");
  }

  function fallback(tag, base) {
    return function FallbackComponent(props) {
      const { children, className } = props || {};
      const next = Object.assign({}, props);
      delete next.children;
      delete next.className;
      return h(tag, Object.assign(next, { className: join(base, className) }), children);
    };
  }

  const Card = UI.Card || fallback("section", "rounded-lg border bg-card text-card-foreground");
  const CardHeader = UI.CardHeader || fallback("div", "p-4 pb-2");
  const CardTitle = UI.CardTitle || fallback("h3", "font-semibold leading-none");
  const CardContent = UI.CardContent || fallback("div", "p-4 pt-2");
  const Button = UI.Button || fallback("button", "rounded border px-3 py-2 text-sm");
  const Badge = UI.Badge || fallback("span", "inline-flex rounded border px-2 py-1 text-xs");
  const Separator = UI.Separator || fallback("div", "h-px w-full bg-border");

  function numberish(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function compact(n) {
    const value = numberish(n);
    if (value >= 1000000000) return (value / 1000000000).toFixed(1) + "B";
    if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
    if (value >= 1000) return (value / 1000).toFixed(1) + "K";
    return String(Math.round(value));
  }

  function money(n) {
    const value = numberish(n);
    if (value === 0) return "$0";
    if (value < 0.01) return "$" + value.toFixed(4);
    return "$" + value.toFixed(2);
  }

  function dateLabel(ts) {
    if (!ts) return "unknown";
    const n = Number(ts);
    const d = Number.isFinite(n) ? new Date(n < 1000000000000 ? n * 1000 : n) : new Date(String(ts));
    if (Number.isNaN(d.getTime())) return "unknown";
    return d.toLocaleString();
  }

  function trimText(text, limit) {
    const s = String(text || "").replace(/\s+/g, " ").trim();
    return s.length > limit ? s.slice(0, limit - 1) + "…" : s;
  }

  function arr(value, prop) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (prop && Array.isArray(value[prop])) return value[prop];
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.jobs)) return value.jobs;
    if (Array.isArray(value.sessions)) return value.sessions;
    if (Array.isArray(value.skills)) return value.skills;
    if (Array.isArray(value.toolsets)) return value.toolsets;
    if (Array.isArray(value.results)) return value.results;
    return [];
  }

  function ok(packet, key) {
    return packet && packet[key] && packet[key].ok ? packet[key].data : null;
  }

  function fault(packet, key) {
    return packet && packet[key] && !packet[key].ok ? packet[key].error : null;
  }

  function safe(name, fn) {
    if (typeof fn !== "function") {
      return Promise.resolve({ name, ok: false, error: "SDK method unavailable" });
    }
    return fn()
      .then(function (data) { return { name, ok: true, data }; })
      .catch(function (err) { return { name, ok: false, error: err && err.message ? err.message : String(err) }; });
  }

  function dot(state) {
    const cls = state ? "bg-emerald-400" : "bg-red-400";
    return h("span", { className: join("inline-block h-2 w-2 rounded-full", cls) });
  }

  function statusPill(label, state) {
    return h("span", { className: state ? "hcc-pill hot" : "hcc-pill danger" }, dot(state), label);
  }

  function Panel(props) {
    return h(Card, { className: join("h-full overflow-hidden", props.className) },
      h(CardHeader, { className: "space-y-1" },
        h("div", { className: "flex items-start justify-between gap-3" },
          h("div", null,
            h(CardTitle, { className: "hcc-value text-base" }, props.title),
            props.subtitle ? h("p", { className: "hcc-label mt-1" }, props.subtitle) : null
          ),
          props.badge ? h("div", null, props.badge) : null
        )
      ),
      h(CardContent, null, props.children)
    );
  }

  function KPI(props) {
    return h("div", { className: "hcc-kpi p-4" },
      h("div", { className: "relative flex items-center justify-between gap-3" },
        h("div", null,
          h("div", { className: "hcc-label" }, props.label),
          h("div", { className: "hcc-value mt-2 text-2xl font-bold" }, props.value),
          props.note ? h("div", { className: "mt-2 text-xs text-muted-foreground" }, props.note) : null
        ),
        props.right ? h("div", { className: "shrink-0" }, props.right) : null
      )
    );
  }

  function Hero(props) {
    const status = props.status || {};
    const gateway = !!status.gateway_running;
    return h("section", { className: "hcc-hero p-5 md:p-6" },
      h("div", { className: "relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between" },
        h("div", null,
          h("div", { className: "mb-3 flex flex-wrap items-center gap-2" },
            statusPill(gateway ? "Gateway online" : "Gateway offline", gateway),
            h("span", { className: "hcc-pill" }, "Hermes " + (status.version || "unknown")),
            status.gateway_state ? h("span", { className: "hcc-pill" }, "State " + status.gateway_state) : null,
            status.gateway_pid ? h("span", { className: "hcc-pill" }, "PID " + status.gateway_pid) : null
          ),
          h("h1", { className: "hcc-value text-3xl font-black tracking-[0.12em] md:text-5xl" }, "Command Center"),
          h("p", { className: "mt-3 max-w-3xl text-sm text-muted-foreground md:text-base" }, "Live mission telemetry for sessions, models, token burn, skills, toolsets, cron jobs, gateway state, and recent errors. Adapts to your active Hermes theme — full cockpit flair on Chronos Forge.")
        ),
        h("div", { className: "flex flex-wrap gap-2" },
          h(Button, { onClick: props.onRefresh, disabled: props.loading, variant: "outline", className: "hcc-value" }, props.loading ? "Refreshing" : "Refresh"),
          h(Button, { onClick: props.onRescan, variant: "outline", className: "hcc-value" }, "Rescan plugins"),
          h(Button, { onClick: props.onToggleAuto, variant: props.auto ? "default" : "outline", className: "hcc-value" }, props.auto ? "Auto on" : "Auto off")
        )
      )
    );
  }

  function SessionsTable(props) {
    const sessions = props.sessions || [];
    if (!sessions.length) return h("p", { className: "text-sm text-muted-foreground" }, "No sessions returned yet.");
    return h("div", { className: "overflow-x-auto" },
      h("table", { className: "w-full min-w-[720px] text-sm" },
        h("thead", { className: "hcc-label text-left" },
          h("tr", null,
            h("th", { className: "pb-2 pr-3" }, "Session"),
            h("th", { className: "pb-2 pr-3" }, "Model"),
            h("th", { className: "pb-2 pr-3" }, "Messages"),
            h("th", { className: "pb-2 pr-3" }, "Tools"),
            h("th", { className: "pb-2 pr-3" }, "Tokens"),
            h("th", { className: "pb-2" }, "Last active")
          )
        ),
        h("tbody", null,
          sessions.slice(0, 10).map(function (s) {
            const tokens = numberish(s.input_tokens) + numberish(s.output_tokens);
            return h("tr", { key: s.id, className: "hcc-table-row" },
              h("td", { className: "py-3 pr-3 align-top" },
                h("div", { className: "font-medium" }, trimText(s.title || s.preview || s.id, 70)),
                h("div", { className: "mt-1 flex items-center gap-2 text-xs text-muted-foreground" },
                  dot(!!s.is_active),
                  h("span", null, s.is_active ? "active" : "closed"),
                  s.source ? h("span", null, "source: " + s.source) : null
                )
              ),
              h("td", { className: "py-3 pr-3 align-top text-muted-foreground" }, trimText(s.model || "unknown", 38)),
              h("td", { className: "py-3 pr-3 align-top" }, compact(s.message_count)),
              h("td", { className: "py-3 pr-3 align-top" }, compact(s.tool_call_count)),
              h("td", { className: "py-3 pr-3 align-top" }, compact(tokens)),
              h("td", { className: "py-3 align-top text-muted-foreground" }, dateLabel(s.last_active))
            );
          })
        )
      )
    );
  }

  function Bars(props) {
    const rows = props.rows || [];
    if (!rows.length) return h("p", { className: "text-sm text-muted-foreground" }, props.empty || "No analytics data yet.");
    const max = rows.reduce(function (m, row) { return Math.max(m, numberish(row.value)); }, 1);
    return h("div", { className: "space-y-3" }, rows.slice(0, props.limit || 7).map(function (row) {
      const width = Math.max(4, Math.round((numberish(row.value) / max) * 100));
      return h("div", { key: row.label },
        h("div", { className: "mb-1 flex items-center justify-between gap-3 text-xs" },
          h("span", { className: "truncate font-medium" }, row.label),
          h("span", { className: "text-muted-foreground" }, row.display || compact(row.value))
        ),
        h("div", { className: "hcc-bar" }, h("span", { style: { width: width + "%" } }))
      );
    }));
  }

  function ErrorFeed(props) {
    const lines = props.lines || [];
    if (!lines.length) return h("p", { className: "text-sm text-muted-foreground" }, "No recent error lines returned.");
    return h("div", { className: "hcc-feed space-y-2 pr-1" },
      lines.slice(-14).reverse().map(function (line, idx) {
        return h("div", { key: idx, className: "hcc-feed-line" }, trimText(line, 220));
      })
    );
  }

  function CronList(props) {
    const jobs = props.jobs || [];
    const busy = props.busy || "";
    if (!jobs.length) return h("p", { className: "text-sm text-muted-foreground" }, "No cron jobs configured.");
    return h("div", { className: "space-y-3" }, jobs.slice(0, 8).map(function (job) {
      const enabled = job.enabled !== false;
      const id = String(job.id || job.name || "");
      const isBusy = busy === id;
      return h("div", { key: id || job.name, className: "rounded border border-border/60 p-3" },
        h("div", { className: "flex items-start justify-between gap-3" },
          h("div", null,
            h("div", { className: "font-medium" }, job.name || trimText(job.prompt, 48) || "Cron job"),
            h("div", { className: "mt-1 text-xs text-muted-foreground" }, job.schedule_display || (job.schedule && job.schedule.display) || "schedule unknown")
          ),
          h("span", { className: enabled ? "hcc-pill hot" : "hcc-pill" }, enabled ? "enabled" : "paused")
        ),
        job.last_error ? h("div", { className: "mt-2 text-xs text-red-300" }, trimText(job.last_error, 140)) : null,
        job.next_run_at ? h("div", { className: "mt-2 text-xs text-muted-foreground" }, "Next: " + job.next_run_at) : null,
        h("div", { className: "mt-3 flex flex-wrap gap-2" },
          h(Button, { className: "hcc-mini-btn", disabled: isBusy || !id, onClick: function () { props.onAction(job, "trigger"); } }, isBusy ? "Working" : "Trigger"),
          enabled
            ? h(Button, { className: "hcc-mini-btn", disabled: isBusy || !id, onClick: function () { props.onAction(job, "pause"); } }, "Pause")
            : h(Button, { className: "hcc-mini-btn", disabled: isBusy || !id, onClick: function () { props.onAction(job, "resume"); } }, "Resume")
        )
      );
    }));
  }

  function PlatformGrid(props) {
    const platforms = props.platforms || {};
    const entries = Object.entries(platforms);
    if (!entries.length) return h("p", { className: "text-sm text-muted-foreground" }, "No gateway platform state returned.");
    return h("div", { className: "grid gap-2 sm:grid-cols-2" }, entries.map(function (entry) {
      const name = entry[0];
      const info = entry[1] || {};
      const up = String(info.state || "").toLowerCase().indexOf("error") === -1;
      return h("div", { key: name, className: "hcc-platform" },
        h("div", { className: "flex items-center justify-between gap-2" },
          h("span", { className: "font-medium" }, name),
          h("span", { className: up ? "hcc-pill hot" : "hcc-pill danger" }, info.state || "unknown")
        ),
        info.error_message ? h("div", { className: "mt-2 text-xs text-red-300" }, trimText(info.error_message, 120)) : null,
        info.updated_at ? h("div", { className: "mt-2 text-xs text-muted-foreground" }, "Updated " + info.updated_at) : null
      );
    }));
  }

  function CapabilityMatrix(props) {
    const skills = props.skills || [];
    const toolsets = props.toolsets || [];
    const enabledSkills = skills.filter(function (s) { return s.enabled !== false; });
    const configuredToolsets = toolsets.filter(function (t) { return t.configured !== false; });
    return h("div", { className: "space-y-4" },
      h("div", { className: "grid grid-cols-2 gap-3" },
        h("div", { className: "hcc-gridbox" }, h("div", { className: "hcc-label" }, "Enabled skills"), h("div", { className: "hcc-value text-2xl font-bold" }, compact(enabledSkills.length))),
        h("div", { className: "hcc-gridbox" }, h("div", { className: "hcc-label" }, "Configured toolsets"), h("div", { className: "hcc-value text-2xl font-bold" }, compact(configuredToolsets.length)))
      ),
      h("div", null,
        h("div", { className: "hcc-label mb-2" }, "Skill roster"),
        h("div", { className: "flex flex-wrap gap-2" }, enabledSkills.slice(0, 10).map(function (skill) {
          return h("span", { key: skill.name, className: "hcc-pill" }, trimText(skill.name, 22));
        }))
      ),
      h("div", null,
        h("div", { className: "hcc-label mb-2" }, "Toolsets"),
        h("div", { className: "space-y-2" }, configuredToolsets.slice(0, 6).map(function (toolset) {
          return h("div", { key: toolset.name, className: "flex items-center justify-between gap-2 text-sm" },
            h("span", { className: "truncate" }, toolset.label || toolset.name),
            h("span", { className: toolset.enabled ? "hcc-pill hot" : "hcc-pill" }, toolset.enabled ? "active" : "ready")
          );
        }))
      )
    );
  }

  function ApiStatus(props) {
    const errors = props.errors || [];
    if (!errors.length) return null;
    return h("div", { className: "rounded border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100" },
      h("div", { className: "font-semibold" }, "Some telemetry endpoints did not respond"),
      h("ul", { className: "mt-2 list-disc space-y-1 pl-5" }, errors.map(function (e) {
        return h("li", { key: e.key }, e.key + ": " + trimText(e.error, 120));
      }))
    );
  }

  function CommandCenterPage() {
    const [packet, setPacket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [auto, setAuto] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [actionBusy, setActionBusy] = useState("");
    const [actionError, setActionError] = useState("");

    const load = useCallback(function () {
      setLoading(true);
      const calls = [
        safe("status", api.getStatus),
        safe("sessions", function () { return api.getSessions(24, 0); }),
        safe("analytics", function () { return api.getAnalytics(7); }),
        safe("logs", function () { return api.getLogs({ file: "errors", lines: 80, level: "ALL", component: "all" }); }),
        safe("cron", api.getCronJobs),
        safe("model", api.getModelInfo),
        safe("skills", api.getSkills),
        safe("toolsets", api.getToolsets),
        safe("snapshot", function () { return SDK.fetchJSON ? SDK.fetchJSON("/api/plugins/hermes-command-center/snapshot") : Promise.resolve(null); })
      ];
      return Promise.all(calls).then(function (results) {
        const next = {};
        results.forEach(function (result) { next[result.name] = result; });
        setPacket(next);
        setLastRefresh(new Date());
      }).finally(function () { setLoading(false); });
    }, []);

    useEffect(function () {
      load();
    }, [load]);

    useEffect(function () {
      if (!auto) return undefined;
      const id = window.setInterval(load, 12000);
      return function () { window.clearInterval(id); };
    }, [auto, load]);

    const status = ok(packet, "status") || {};
    const sessionsResponse = ok(packet, "sessions") || {};
    const sessions = arr(sessionsResponse, "sessions");
    const analytics = ok(packet, "analytics") || {};
    const totals = analytics.totals || {};
    const cron = ok(packet, "cron") || {};
    const jobs = arr(cron, "jobs");
    const logs = ok(packet, "logs") || {};
    const lines = arr(logs, "lines");
    const model = ok(packet, "model") || {};
    const skillsResponse = ok(packet, "skills") || {};
    const toolsetsResponse = ok(packet, "toolsets") || {};
    const skills = arr(skillsResponse, "skills");
    const toolsets = arr(toolsetsResponse, "toolsets");
    const snapshot = ok(packet, "snapshot") || {};
    const activeSessions = numberish(status.active_sessions || sessions.filter(function (s) { return s.is_active; }).length);
    const totalSessions = numberish(sessionsResponse.total || totals.total_sessions || sessions.length);
    const totalTokens = numberish(totals.total_input) + numberish(totals.total_output) + numberish(totals.total_reasoning);
    const actualCost = numberish(totals.total_actual_cost || totals.total_estimated_cost);
    const errorCount = numberish(snapshot.error_lines || lines.length);
    const enabledJobs = jobs.filter(function (job) { return job.enabled !== false; }).length;
    const apiErrors = ["status", "sessions", "analytics", "logs", "cron", "model", "skills", "toolsets", "snapshot"]
      .map(function (key) { return { key, error: fault(packet, key) }; })
      .filter(function (item) { return item.error && item.error !== "SDK method unavailable"; });

    const modelRows = arr(analytics.by_model).map(function (row) {
      const tokens = numberish(row.input_tokens) + numberish(row.output_tokens);
      return { label: row.model || "unknown", value: tokens, display: compact(tokens) + " tokens" };
    });

    const skillRows = arr(analytics.skills && analytics.skills.top_skills).map(function (row) {
      return { label: row.skill || "unknown", value: row.total_count || row.view_count || 0, display: compact(row.total_count || row.view_count || 0) + " loads" };
    });

    const sourceRows = (snapshot.top_sources || []).map(function (row) {
      return { label: row[0] || "unknown", value: row[1] || 0, display: compact(row[1] || 0) + " sessions" };
    });

    const rescan = function () {
      if (!api.rescanPlugins) return load();
      setLoading(true);
      api.rescanPlugins().then(load).finally(function () { setLoading(false); });
    };

    const cronAction = function (job, action) {
      const id = String(job.id || job.name || "");
      if (!id) return;
      const map = { trigger: api.triggerCronJob, pause: api.pauseCronJob, resume: api.resumeCronJob };
      const fn = map[action];
      if (typeof fn !== "function") return;
      setActionBusy(id);
      setActionError("");
      fn(id)
        .then(function () { return load(); })
        .catch(function (err) { setActionError(err && err.message ? err.message : String(err)); })
        .finally(function () { setActionBusy(""); });
    };

    return h("main", { className: "hcc-root space-y-5 p-4 md:p-6" },
      h(Hero, {
        status,
        loading,
        auto,
        onRefresh: load,
        onRescan: rescan,
        onToggleAuto: function () { setAuto(function (value) { return !value; }); }
      }),
      actionError ? h("div", { className: "rounded border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-100" }, "Cron action failed: " + trimText(actionError, 180)) : null,
      h(ApiStatus, { errors: apiErrors }),
      h("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-6" },
        h(KPI, { label: "Gateway", value: status.gateway_running ? "Online" : "Offline", note: status.gateway_health_url || status.gateway_exit_reason || "local control plane", right: dot(!!status.gateway_running) }),
        h(KPI, { label: "Active sessions", value: compact(activeSessions), note: compact(totalSessions) + " total sessions" }),
        h(KPI, { label: "Token burn", value: compact(totalTokens), note: "last 7 days" }),
        h(KPI, { label: "Spend", value: money(actualCost), note: compact(totals.total_api_calls) + " API calls" }),
        h(KPI, { label: "Cron jobs", value: compact(enabledJobs) + "/" + compact(jobs.length), note: "enabled of total" }),
        h(KPI, { label: "Error feed", value: compact(errorCount), note: lines.length ? "latest " + compact(lines.length) + " lines" : "clean or unavailable" })
      ),
      h("div", { className: "grid gap-4 xl:grid-cols-3" },
        h(Panel, { title: "Recent sorties", subtitle: "Sessions and tool execution", className: "xl:col-span-2" }, h(SessionsTable, { sessions })),
        h(Panel, { title: "Control plane", subtitle: "Runtime and local state" },
          h("div", { className: "space-y-3 text-sm" },
            h("div", { className: "flex justify-between gap-3" }, h("span", { className: "text-muted-foreground" }, "Hermes home"), h("span", { className: "truncate text-right" }, status.hermes_home || "unknown")),
            h("div", { className: "flex justify-between gap-3" }, h("span", { className: "text-muted-foreground" }, "Config version"), h("span", null, String(status.config_version || "unknown"))),
            h("div", { className: "flex justify-between gap-3" }, h("span", { className: "text-muted-foreground" }, "Model"), h("span", { className: "truncate text-right" }, model.model || "unknown")),
            h("div", { className: "flex justify-between gap-3" }, h("span", { className: "text-muted-foreground" }, "Provider"), h("span", null, model.provider || "unknown")),
            h("div", { className: "flex justify-between gap-3" }, h("span", { className: "text-muted-foreground" }, "Context"), h("span", null, model.effective_context_length ? compact(model.effective_context_length) : "unknown")),
            h(Separator, null),
            h("div", { className: "text-xs text-muted-foreground" }, "Last refresh: " + (lastRefresh ? lastRefresh.toLocaleTimeString() : "not yet"))
          )
        )
      ),
      h("div", { className: "grid gap-4 xl:grid-cols-3" },
        h(Panel, { title: "Model burn", subtitle: "Token usage by model" }, h(Bars, { rows: modelRows, empty: "No model usage yet." })),
        h(Panel, { title: "Skill heat", subtitle: "Top skill activity" }, h(Bars, { rows: skillRows, empty: "No skill activity yet." })),
        h(Panel, { title: "Source mix", subtitle: "Where conversations originate" }, h(Bars, { rows: sourceRows, empty: "No source mix yet." }))
      ),
      h("div", { className: "grid gap-4 xl:grid-cols-3" },
        h(Panel, { title: "Cron watch", subtitle: "Scheduled agent activity and controls", className: "xl:col-span-2" }, h(CronList, { jobs, busy: actionBusy, onAction: cronAction })),
        h(Panel, { title: "Capabilities", subtitle: "Skills and toolsets" }, h(CapabilityMatrix, { skills, toolsets }))
      ),
      h("div", { className: "grid gap-4 xl:grid-cols-3" },
        h(Panel, { title: "Gateway platforms", subtitle: "Connected platform states" }, h(PlatformGrid, { platforms: status.gateway_platforms })),
        h(Panel, { title: "Error flight recorder", subtitle: "Recent error log lines", className: "xl:col-span-2" }, h(ErrorFeed, { lines }))
      )
    );
  }

  function HeaderBadge() {
    const [status, setStatus] = useState(null);
    useEffect(function () {
      let active = true;
      function tick() {
        safe("status", api.getStatus).then(function (result) {
          if (active && result.ok) setStatus(result.data || {});
        });
      }
      tick();
      const id = window.setInterval(tick, 15000);
      return function () {
        active = false;
        window.clearInterval(id);
      };
    }, []);
    const online = !!(status && status.gateway_running);
    const active = status ? compact(status.active_sessions) : "?";
    return h("span", { className: online ? "hcc-pill hot" : "hcc-pill danger" }, dot(online), "CC " + active);
  }

  function Overlay() {
    return h("div", { className: "hcc-overlay" });
  }

  function SidebarHud() {
    const [data, setData] = useState(null);

    useEffect(function () {
      let active = true;
      function loadHud() {
        Promise.all([
          safe("status", api.getStatus),
          safe("analytics", function () { return api.getAnalytics(7); }),
          safe("cron", api.getCronJobs)
        ]).then(function (results) {
          if (!active) return;
          const packet = {};
          results.forEach(function (result) { packet[result.name] = result; });
          setData(packet);
        });
      }
      loadHud();
      const id = window.setInterval(loadHud, 15000);
      return function () {
        active = false;
        window.clearInterval(id);
      };
    }, []);

    const status = ok(data, "status") || {};
    const analytics = ok(data, "analytics") || {};
    const cron = ok(data, "cron") || {};
    const totals = analytics.totals || {};
    const jobs = arr(cron, "jobs");
    const activeSessions = numberish(status.active_sessions);
    const tokens = numberish(totals.total_input) + numberish(totals.total_output) + numberish(totals.total_reasoning);
    const enabledJobs = jobs.filter(function (job) { return job.enabled !== false; }).length;

    return h("div", { className: "hcc-slot space-y-3" },
      h("div", { className: "flex items-center justify-between gap-2" },
        h("span", { className: "hcc-label" }, "Mission HUD"),
        h("span", { className: status.gateway_running ? "hcc-pill hot" : "hcc-pill danger" }, status.gateway_running ? "online" : "offline")
      ),
      h("div", { className: "grid grid-cols-2 gap-2 text-sm" },
        h("div", null, h("div", { className: "hcc-label" }, "Active"), h("div", { className: "hcc-value text-xl font-bold" }, compact(activeSessions))),
        h("div", null, h("div", { className: "hcc-label" }, "Tokens"), h("div", { className: "hcc-value text-xl font-bold" }, compact(tokens))),
        h("div", null, h("div", { className: "hcc-label" }, "Cron"), h("div", { className: "hcc-value text-xl font-bold" }, compact(enabledJobs) + "/" + compact(jobs.length))),
        h("div", null, h("div", { className: "hcc-label" }, "Cost"), h("div", { className: "hcc-value text-xl font-bold" }, money(totals.total_actual_cost || totals.total_estimated_cost)))
      ),
      h("div", { className: "text-xs text-muted-foreground" }, "Live local telemetry from Hermes dashboard APIs")
    );
  }

  window.__HERMES_PLUGINS__.register("hermes-command-center", CommandCenterPage);

  if (window.__HERMES_PLUGINS__.registerSlot) {
    window.__HERMES_PLUGINS__.registerSlot("hermes-command-center", "header-right", HeaderBadge);
    window.__HERMES_PLUGINS__.registerSlot("hermes-command-center", "sidebar", SidebarHud);
    window.__HERMES_PLUGINS__.registerSlot("hermes-command-center", "overlay", Overlay);
  }
})();
