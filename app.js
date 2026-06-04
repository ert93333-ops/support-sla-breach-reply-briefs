(function () {
  const ANALYTICS_KEY = "slabreachqa_analytics_events";
  const INTENT_KEY = "slabreachqa_purchase_intents";
  const ISSUE_BASE = "https://github.com/ert93333-ops/support-sla-breach-reply-briefs/issues/new";

  const SAMPLE_TICKET_NOTES = [
    "Customer says the support update was missed.",
    "Current draft: Sorry for the inconvenience.",
    "Vendor broke the queue. We guarantee this never happens again."
  ].join("\n");

  const SAMPLE_IMPACT_NOTES = "Customer affected.";
  const SAMPLE_TIMELINE_NOTES = "Update was late and the ticket sat too long.";
  const SAMPLE_CAUSE_NOTES = "Shard failover p95 queue saturation and vendor issue.";
  const SAMPLE_REMEDIATION_NOTES = "Looking into it.";
  const SAMPLE_ESCALATION_NOTES = "Maybe escalate if they complain again.";
  const SAMPLE_TIER_NOTES = "Possible service credit.";
  const SAMPLE_NEXT_UPDATE_NOTES = "We will update later.";
  const SAMPLE_OWNER_NOTES = "TBD later.";

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function track(event, detail) {
    const payload = {
      event,
      detail: detail || {},
      path: window.location.pathname,
      query: window.location.search,
      timestamp: nowIso()
    };
    const events = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]");
    events.push(payload);
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-80)));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setText(selector, value) {
    const element = qs(selector);
    if (element) element.textContent = value;
  }

  function unique(items) {
    return Array.from(new Set(items.filter(Boolean)));
  }

  function has(pattern, value) {
    return pattern.test(String(value || ""));
  }

  function wordCount(value) {
    return String(value || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function hasSpecificTime(value) {
    return /\b(\d+\s*(minute|minutes|min|hour|hours|hr|hrs|day|days)|\d{1,2}:\d{2}|am|pm|utc|pst|est|tomorrow|today|by end of day|eod|within)\b/i.test(value || "");
  }

  function hasOwner(value) {
    return /\b(owner|owned by|support ops|support lead|cs lead|customer success|engineering|eng|incident commander|tam|account manager|manager|lead|team|person|assigned|named)\b/i.test(value || "");
  }

  function hasDecision(value) {
    return /\b(decision|decide|approved|approve|blocked|ship|send|hold|follow-up|follow up|postmortem|review|retest|date|deadline|next step|next-step|owner)\b/i.test(value || "");
  }

  function analyze(input) {
    const raw = [
      input.ticketNotes,
      input.impactNotes,
      input.timelineNotes,
      input.causeNotes,
      input.remediationNotes,
      input.escalationNotes,
      input.tierNotes,
      input.nextUpdateNotes,
      input.ownerNotes,
      input.workflowType
    ].join("\n");

    const parseSummary = [
      "Ticket/SLA note characters: " + String(input.ticketNotes || "").length,
      "Support workflow type: " + (input.workflowType || "not provided"),
      "Public-safe reminder: remove customer names, private account identifiers, health/legal/billing details, and contract text before using pasted samples."
    ];

    const impactWarnings = [];
    const slaWarnings = [];
    const timelineWarnings = [];
    const causeWarnings = [];
    const toneWarnings = [];
    const nextUpdateWarnings = [];
    const ownerWarnings = [];
    const escalationWarnings = [];
    const reviewWarnings = [];
    const riskyLanguageWarnings = [];
    const followUpWarnings = [];

    if (!has(/\b(customer|user|account|team|workspace|admin|dashboard|api|login|billing|report|unable|blocked|delayed|down|impact|affected)\b/i, input.impactNotes) || wordCount(input.impactNotes) < 6) {
      impactWarnings.push("missing customer impact summary: impact notes do not clearly state who was affected, what workflow was blocked, and how the customer experienced the miss.");
    }

    if (!has(/\b(sla|service level|response time|priority|p0|p1|p2|enterprise|pro|paid|contract|promise|committed|target)\b/i, input.tierNotes + "\n" + input.ticketNotes)) {
      slaWarnings.push("missing SLA tier or promise: notes do not name the plan, priority, SLA target, response-time promise, or customer expectation that was missed.");
    } else if (!has(/\b(\d+\s*(minute|minutes|min|hour|hours|hr|hrs)|same day|business day|priority|p0|p1|p2|enterprise|pro|paid)\b/i, input.tierNotes + "\n" + input.ticketNotes)) {
      slaWarnings.push("missing SLA tier or promise: notes mention an SLA or promise but do not give enough tier, priority, or response-window context for the reply owner.");
    }

    if (!hasSpecificTime(input.timelineNotes) && !hasSpecificTime(input.ticketNotes)) {
      timelineWarnings.push("missing timeline or breach duration: notes do not include when the request arrived, when the update was due, how long the miss lasted, or what timestamp should be referenced.");
    }

    if (!input.causeNotes || wordCount(input.causeNotes) < 5) {
      causeWarnings.push("missing plain-language cause: cause notes are blank or too thin to explain the issue in customer-safe language.");
    }
    if (has(/\b(p95|p99|shard|replica|queue saturation|race condition|deadlock|segfault|kubernetes|pod|ingress|lambda|vendor issue|upstream)\b/i, input.causeNotes) && !has(/\b(plain|customer|simple|because|in plain language|meant that|caused a delay)\b/i, input.causeNotes)) {
      causeWarnings.push("missing plain-language cause: cause notes are too internal or jargon-heavy and need a customer-readable explanation.");
    }

    if (!has(/\b(sorry|apologize|apology|we missed|we own|we take responsibility|our team missed|thank you for your patience)\b/i, raw)) {
      toneWarnings.push("missing apology or ownership tone: notes do not include a clear apology or ownership statement for the missed update.");
    } else if (!has(/\b(we missed|we own|responsibility|our team missed|we should have|we did not)\b/i, raw)) {
      toneWarnings.push("missing apology or ownership tone: the draft apologizes but does not clearly own the missed update or response promise.");
    }

    if (!hasSpecificTime(input.nextUpdateNotes)) {
      nextUpdateWarnings.push("missing next update time: notes do not name a specific next-update time, cadence, or deadline for the customer.");
    }

    if (!hasOwner(input.remediationNotes + "\n" + input.ownerNotes)) {
      ownerWarnings.push("missing remediation owner: remediation notes do not name the support, CS, engineering, TAM, incident, or account owner responsible for the next step.");
    }
    if (has(/\b(looking into|investigating|working on it|someone|team)\b/i, input.remediationNotes) && !has(/\b(owner|assigned|lead|by|deadline|eta)\b/i, input.remediationNotes + "\n" + input.ownerNotes)) {
      ownerWarnings.push("missing remediation owner: remediation language is vague and needs a named owner plus next step.");
    }

    if (!has(/\b(escalate|escalation|manager|tam|account manager|support lead|cs lead|incident commander|priority|pager|internal channel|war room)\b/i, input.escalationNotes)) {
      escalationWarnings.push("unresolved escalation path: notes do not say who handles escalation if the customer pushes back or the issue remains open.");
    } else if (has(/\b(maybe|if they complain|not sure|unclear|later|if needed)\b/i, input.escalationNotes)) {
      escalationWarnings.push("unresolved escalation path: escalation notes are conditional or vague instead of naming the escalation owner and trigger.");
    }

    if (has(/\b(credit|refund|service credit|compensation|contract|sla applies|penalty|billing|renewal)\b/i, raw) && !has(/\b(internal review|policy review|account owner|billing owner|not promised|do not promise|separate review|decision pending|approved by)\b/i, input.tierNotes + "\n" + input.ownerNotes + "\n" + input.remediationNotes)) {
      reviewWarnings.push("credit/refund/internal review ambiguity: notes mention credit, refund, billing, contract, or SLA implications without a clear internal review owner and without avoiding promises.");
    }

    if (has(/\b(vendor broke|not our fault|they caused|obviously|just|simply|guarantee|never happen again|permanent fix|no impact|minor issue|user error|customer error)\b/i, raw)) {
      riskyLanguageWarnings.push("risky blame, jargon, or overpromise language: notes include blame, minimizing language, or guarantees that should be reviewed before sending.");
    }
    if (has(/\b(p95|p99|shard|queue saturation|deadlock|segfault|kubernetes|pod|ingress|lambda)\b/i, raw)) {
      riskyLanguageWarnings.push("risky blame, jargon, or overpromise language: notes include internal technical jargon that should be translated for the customer.");
    }

    if (!hasDecision(input.ownerNotes)) {
      followUpWarnings.push("missing internal follow-up decision: owner notes do not record the follow-up owner, review decision, retest date, postmortem step, or send/hold decision.");
    }
    if (has(/\b(no owner|not assigned|tbd|unknown|later)\b/i, input.ownerNotes)) {
      followUpWarnings.push("missing internal follow-up decision: owner notes explicitly leave ownership or follow-up unresolved.");
    }

    const customerReply = [
      "Subject: Update on your support request",
      "",
      "Thank you for your patience. We missed the expected update window for this request, and we should have communicated sooner.",
      "Customer impact to confirm: " + (input.impactNotes || "add the affected workflow, users, and customer-visible impact."),
      "Current status: " + (input.remediationNotes || "add the current remediation status and owner."),
      "Next update: " + (input.nextUpdateNotes || "add a specific next-update time before sending."),
      "",
      "We are reviewing the follow-up path internally and will avoid making credit, refund, or contract commitments in this message unless the proper owner has approved them."
    ];

    const internalHandoff = [
      "Workflow: " + (input.workflowType || "not provided"),
      "SLA/tier context: " + (input.tierNotes || "missing"),
      "Timeline: " + (input.timelineNotes || "missing"),
      "Escalation path: " + (input.escalationNotes || "missing"),
      "Owner/follow-up: " + (input.ownerNotes || "missing")
    ];

    const issueCount =
      impactWarnings.length +
      slaWarnings.length +
      timelineWarnings.length +
      causeWarnings.length +
      toneWarnings.length +
      nextUpdateWarnings.length +
      ownerWarnings.length +
      escalationWarnings.length +
      reviewWarnings.length +
      riskyLanguageWarnings.length +
      followUpWarnings.length;

    const status = issueCount === 0
      ? "Ready for support reply review"
      : issueCount >= 5
        ? "Fix before sending"
        : "Manual review";

    return {
      status,
      issueCount,
      parseSummary: unique(parseSummary),
      impactWarnings: unique(impactWarnings),
      slaWarnings: unique(slaWarnings),
      timelineWarnings: unique(timelineWarnings),
      causeWarnings: unique(causeWarnings),
      toneWarnings: unique(toneWarnings),
      nextUpdateWarnings: unique(nextUpdateWarnings),
      ownerWarnings: unique(ownerWarnings),
      escalationWarnings: unique(escalationWarnings),
      reviewWarnings: unique(reviewWarnings),
      riskyLanguageWarnings: unique(riskyLanguageWarnings),
      followUpWarnings: unique(followUpWarnings),
      customerReply,
      internalHandoff,
      handoffReminders: [
        "Remove customer names, private account IDs, contract text, health/legal/billing details, and employee data before using pasted samples.",
        "Get internal approval before mentioning credits, refunds, compensation, contract terms, or policy exceptions.",
        "Treat this output as support communication QA and escalation guidance, not legal advice, contract advice, refund advice, deliverability advice, or a substitute for company policy."
      ]
    };
  }

  function listHtml(items, emptyText) {
    const list = items && items.length ? items : [emptyText];
    return "<ul>" + list.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>";
  }

  function briefToText(brief) {
    return [
      "Support SLA breach reply brief",
      "Status: " + brief.status,
      "Checks needing attention: " + brief.issueCount,
      "",
      "Parse summary:",
      brief.parseSummary.join("\n"),
      "",
      "Customer impact warnings:",
      brief.impactWarnings.length ? brief.impactWarnings.join("\n") : "None found.",
      "",
      "SLA/promise warnings:",
      brief.slaWarnings.length ? brief.slaWarnings.join("\n") : "None found.",
      "",
      "Timeline warnings:",
      brief.timelineWarnings.length ? brief.timelineWarnings.join("\n") : "None found.",
      "",
      "Plain-language cause warnings:",
      brief.causeWarnings.length ? brief.causeWarnings.join("\n") : "None found.",
      "",
      "Apology/ownership tone warnings:",
      brief.toneWarnings.length ? brief.toneWarnings.join("\n") : "None found.",
      "",
      "Next update warnings:",
      brief.nextUpdateWarnings.length ? brief.nextUpdateWarnings.join("\n") : "None found.",
      "",
      "Remediation owner warnings:",
      brief.ownerWarnings.length ? brief.ownerWarnings.join("\n") : "None found.",
      "",
      "Escalation path warnings:",
      brief.escalationWarnings.length ? brief.escalationWarnings.join("\n") : "None found.",
      "",
      "Credit/review warnings:",
      brief.reviewWarnings.length ? brief.reviewWarnings.join("\n") : "None found.",
      "",
      "Risky language warnings:",
      brief.riskyLanguageWarnings.length ? brief.riskyLanguageWarnings.join("\n") : "None found.",
      "",
      "Internal follow-up warnings:",
      brief.followUpWarnings.length ? brief.followUpWarnings.join("\n") : "None found.",
      "",
      "Customer reply draft:",
      brief.customerReply.join("\n"),
      "",
      "Internal handoff:",
      brief.internalHandoff.join("\n"),
      "",
      "Handoff reminders:",
      brief.handoffReminders.join("\n")
    ].join("\n");
  }

  function renderBrief(brief) {
    const output = qs("#brief-output");
    if (!output) return;
    output.innerHTML = [
      '<div class="brief-summary">',
      '<strong>' + escapeHtml(brief.status) + '</strong>',
      '<span>' + brief.issueCount + ' checks need attention</span>',
      "</div>",
      '<section class="brief-section"><h4>Parse summary</h4>' + listHtml(brief.parseSummary, "No parse notes found.") + "</section>",
      '<section class="brief-section"><h4>Customer impact warnings</h4>' + listHtml(brief.impactWarnings, "No customer impact warnings found.") + "</section>",
      '<section class="brief-section"><h4>SLA/promise warnings</h4>' + listHtml(brief.slaWarnings, "No SLA or promise warnings found.") + "</section>",
      '<section class="brief-section"><h4>Timeline warnings</h4>' + listHtml(brief.timelineWarnings, "No timeline or breach duration warnings found.") + "</section>",
      '<section class="brief-section"><h4>Plain-language cause warnings</h4>' + listHtml(brief.causeWarnings, "No plain-language cause warnings found.") + "</section>",
      '<section class="brief-section"><h4>Apology/ownership tone warnings</h4>' + listHtml(brief.toneWarnings, "No apology or ownership tone warnings found.") + "</section>",
      '<section class="brief-section"><h4>Next update warnings</h4>' + listHtml(brief.nextUpdateWarnings, "No next update warnings found.") + "</section>",
      '<section class="brief-section"><h4>Remediation owner warnings</h4>' + listHtml(brief.ownerWarnings, "No remediation owner warnings found.") + "</section>",
      '<section class="brief-section"><h4>Escalation path warnings</h4>' + listHtml(brief.escalationWarnings, "No escalation path warnings found.") + "</section>",
      '<section class="brief-section"><h4>Credit/review warnings</h4>' + listHtml(brief.reviewWarnings, "No credit, refund, or internal review warnings found.") + "</section>",
      '<section class="brief-section"><h4>Risky language warnings</h4>' + listHtml(brief.riskyLanguageWarnings, "No risky blame, jargon, or overpromise warnings found.") + "</section>",
      '<section class="brief-section"><h4>Internal follow-up warnings</h4>' + listHtml(brief.followUpWarnings, "No internal follow-up warnings found.") + "</section>",
      '<section class="brief-section"><h4>Customer reply draft</h4><pre>' + escapeHtml(brief.customerReply.join("\n")) + "</pre></section>",
      '<section class="brief-section"><h4>Internal handoff</h4>' + listHtml(brief.internalHandoff, "No internal handoff notes found.") + "</section>",
      '<section class="brief-section"><h4>Handoff reminders</h4>' + listHtml(brief.handoffReminders, "No handoff reminders found.") + "</section>"
    ].join("");
    setText("#output-title", "Support SLA breach reply brief ready");
    setText("#status-pill", brief.status);
    const outputPanel = qs("#output-panel");
    if (outputPanel) {
      outputPanel.classList.add("has-brief");
      outputPanel.classList.toggle("status-good", brief.status === "Ready for support reply review");
      outputPanel.classList.toggle("status-warning", brief.status === "Manual review");
      outputPanel.classList.toggle("status-danger", brief.status === "Fix before sending");
    }
    const copyButton = qs("#copy-brief");
    if (copyButton) copyButton.disabled = false;
    window.__latestBriefText = briefToText(brief);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  function issueUrl(intent) {
    const body = [
      "Support SLA Breach Reply Briefs early-access request",
      "",
      "Role: " + intent.role,
      "Support workflow type: " + intent.siteType,
      "Breach/update cadence: " + intent.cadence,
      "Plan interest: " + intent.plan,
      "Willingness to pay: " + intent.budget,
      "Purchase intent: " + (intent.purchaseIntent ? "yes" : "no"),
      "",
      "Current escalation process or pain:",
      intent.pain,
      "",
      "Note: Email is intentionally omitted from this public issue body."
    ].join("\n");
    const params = new URLSearchParams({
      title: "Support SLA Breach Reply Briefs early-access request",
      body,
      labels: "early-access,purchase-intent,demo-request",
      template: "demo_request.md"
    });
    return ISSUE_BASE + "?" + params.toString();
  }

  function requestDetails(intent) {
    return [
      "Support SLA Breach Reply Briefs early-access request",
      "Email: " + intent.email,
      "Role: " + intent.role,
      "Support workflow type: " + intent.siteType,
      "Breach/update cadence: " + intent.cadence,
      "Plan interest: " + intent.plan,
      "Willingness to pay: " + intent.budget,
      "Purchase intent: " + (intent.purchaseIntent ? "yes" : "no"),
      "",
      "Pain:",
      intent.pain
    ].join("\n");
  }

  function init() {
    const ticketNotes = qs("#ticket-notes");
    const impactNotes = qs("#impact-notes");
    const timelineNotes = qs("#timeline-notes");
    const causeNotes = qs("#cause-notes");
    const remediationNotes = qs("#remediation-notes");
    const escalationNotes = qs("#escalation-notes");
    const tierNotes = qs("#tier-notes");
    const nextUpdateNotes = qs("#next-update-notes");
    const ownerNotes = qs("#owner-notes");
    const workflowType = qs("#workflow-type");
    const error = qs("#workflow-error");
    const form = qs("#qa-form");
    const loadSample = qs("#load-sample");
    const copyBrief = qs("#copy-brief");
    const waitlistForm = qs("#waitlist-form");
    const handoffPanel = qs("#handoff-panel");
    const remoteLink = qs("#remote-intent-link");
    const copyRequest = qs("#copy-request");

    track("landing_viewed", { product: "Support SLA Breach Reply Briefs" });

    qsa("[data-track-cta]").forEach((element) => {
      element.addEventListener("click", () => {
        track("cta_clicked", { cta: element.getAttribute("data-track-cta") || element.textContent.trim() });
      });
    });

    if (loadSample) {
      loadSample.addEventListener("click", () => {
        if (ticketNotes) ticketNotes.value = SAMPLE_TICKET_NOTES;
        if (impactNotes) impactNotes.value = SAMPLE_IMPACT_NOTES;
        if (timelineNotes) timelineNotes.value = SAMPLE_TIMELINE_NOTES;
        if (causeNotes) causeNotes.value = SAMPLE_CAUSE_NOTES;
        if (remediationNotes) remediationNotes.value = SAMPLE_REMEDIATION_NOTES;
        if (escalationNotes) escalationNotes.value = SAMPLE_ESCALATION_NOTES;
        if (tierNotes) tierNotes.value = SAMPLE_TIER_NOTES;
        if (nextUpdateNotes) nextUpdateNotes.value = SAMPLE_NEXT_UPDATE_NOTES;
        if (ownerNotes) ownerNotes.value = SAMPLE_OWNER_NOTES;
        if (workflowType) workflowType.value = "Enterprise SLA breach update";
        if (error) error.textContent = "";
        track("sample_sla_breach_notes_loaded");
      });
    }

    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        track("core_action_started", { workflow: "support_sla_breach_reply" });
        if (error) error.textContent = "";
        const input = {
          ticketNotes: ticketNotes ? ticketNotes.value.trim() : "",
          impactNotes: impactNotes ? impactNotes.value.trim() : "",
          timelineNotes: timelineNotes ? timelineNotes.value.trim() : "",
          causeNotes: causeNotes ? causeNotes.value.trim() : "",
          remediationNotes: remediationNotes ? remediationNotes.value.trim() : "",
          escalationNotes: escalationNotes ? escalationNotes.value.trim() : "",
          tierNotes: tierNotes ? tierNotes.value.trim() : "",
          nextUpdateNotes: nextUpdateNotes ? nextUpdateNotes.value.trim() : "",
          ownerNotes: ownerNotes ? ownerNotes.value.trim() : "",
          workflowType: workflowType ? workflowType.value.trim() : ""
        };
        if (!input.ticketNotes && !input.impactNotes && !input.timelineNotes && !input.causeNotes && !input.remediationNotes) {
          if (error) error.textContent = "Paste SLA breach notes and customer impact notes before generating a brief.";
          track("core_action_failed", { reason: "empty_input" });
          return;
        }
        const brief = analyze(input);
        renderBrief(brief);
        track("core_action_completed", { status: brief.status, issueCount: brief.issueCount });
      });
    }

    if (copyBrief) {
      copyBrief.addEventListener("click", async () => {
        await copyText(window.__latestBriefText || "");
        setText("#copy-status", "Copied brief");
        track("brief_copied");
      });
    }

    qsa(".price-card").forEach((card) => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            track("pricing_viewed", { plan: card.querySelector("h3")?.textContent || "" });
            observer.disconnect();
          }
        });
      }, { threshold: 0.35 });
      observer.observe(card);
    });

    qsa(".plan-button").forEach((button) => {
      button.addEventListener("click", () => {
        const plan = button.getAttribute("data-plan") || "";
        const planSelect = qs("#plan");
        if (planSelect) planSelect.value = plan;
        track("checkout_started", { plan });
        qs("#waitlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    if (waitlistForm) {
      waitlistForm.addEventListener("submit", (event) => {
        event.preventDefault();
        track("signup_started", { form: "early_access" });
        const intent = {
          email: qs("#email")?.value.trim() || "",
          role: qs("#role")?.value || "",
          siteType: qs("#site-type-intent")?.value || "",
          cadence: qs("#breach-cadence")?.value || "",
          plan: qs("#plan")?.value || "",
          budget: qs("#budget")?.value || "",
          pain: qs("#pain")?.value.trim() || "",
          purchaseIntent: Boolean(qs("#purchase-intent")?.checked),
          timestamp: nowIso()
        };
        const intents = JSON.parse(localStorage.getItem(INTENT_KEY) || "[]");
        intents.push(intent);
        localStorage.setItem(INTENT_KEY, JSON.stringify(intents.slice(-20)));
        setText("#waitlist-status", "You are on the early access list. A public-safe GitHub demo request is ready.");
        if (remoteLink) remoteLink.href = issueUrl(intent);
        if (handoffPanel) handoffPanel.hidden = false;
        window.__latestRequestDetails = requestDetails(intent);
        track("waitlist_submitted", { role: intent.role, plan: intent.plan, purchaseIntent: intent.purchaseIntent });
        track("feedback_submitted", { field: "support_sla_breach_escalation_process" });
        track("remote_intent_ready", { repo: "support-sla-breach-reply-briefs" });
        if (intent.purchaseIntent) track("checkout_intent", { plan: intent.plan, budget: intent.budget });
      });
    }

    if (copyRequest) {
      copyRequest.addEventListener("click", async () => {
        await copyText(window.__latestRequestDetails || "");
        setText("#handoff-status", "Copied request details");
        track("remote_intent_copied");
      });
    }

    const revealItems = qsa(".reveal");
    if ("IntersectionObserver" in window) {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      }, { threshold: 0.12 });
      revealItems.forEach((item) => revealObserver.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add("is-visible"));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
