const $ = x => document.getElementById(x);

const AI_ENDPOINT =
  "https://supportpilot-ai.leneazalea1.workers.dev/analyze";

const defaults = [
  {
    title: "Documents",
    keywords: "bank statement,payslip,document,pdf",
    guidance:
      "Confirm the exact required document and approved submission route."
  },
  {
    title: "Application assessment",
    keywords: "application,assessment,status,loan",
    guidance:
      "State only confirmed status and approved turnaround times."
  },
  {
    title: "Payments",
    keywords: "payment,paid,balance,debit",
    guidance:
      "If payment method is unknown, establish whether manual, third-party or debit."
  },
  {
    title: "DebiCheck",
    keywords: "debicheck,mandate",
    guidance:
      "Establish bank and exact error when needed."
  },
  {
    title: "eWallet",
    keywords: "ewallet,e-wallet,pin,wallet",
    guidance:
      "Do not assume the issue; clarify the exact access problem."
  },
  {
    title: "Collections",
    keywords: "collections,overdue,arrears,arrangement",
    guidance:
      "Use the approved collections process."
  }
];

let KB =
  JSON.parse(localStorage.sp3kb || "null") || defaults;

let companies =
  JSON.parse(localStorage.sp3co || "null") || [
    {
      name: "LendPlus",
      industry: "Lending",
      docs: "documents@lendplus.co.za",
      feedback: "SMS"
    }
  ];

let rules =
  JSON.parse(localStorage.sp3rules || "null") || {
    opening: "Thank you for providing your information!",
    extra:
      "Review the full conversation and do not ask for information already provided."
  };

const save = () => {
  localStorage.sp3kb = JSON.stringify(KB);
  localStorage.sp3co = JSON.stringify(companies);
  localStorage.sp3rules = JSON.stringify(rules);
};

const esc = s =>
  String(s).replace(
    /[&<>"]/g,
    m =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
      })[m]
  );

/* -----------------------------
   Navigation
----------------------------- */

document.querySelectorAll(".nav").forEach(n => {
  n.onclick = () => {
    document
      .querySelectorAll(".nav")
      .forEach(x => x.classList.remove("active"));

    n.classList.add("active");

    document
      .querySelectorAll(".page")
      .forEach(x => x.classList.add("hidden"));

    $(n.dataset.page).classList.remove("hidden");
  };
});

/* -----------------------------
   Knowledge Base
----------------------------- */

function renderKB() {
  $("kbList").innerHTML = KB.map(
    (k, i) => `
      <div class="kb">
        <h3>${esc(k.title)}</h3>
        <p>${esc(k.guidance)}</p>
        <button class="secondary" onclick="editKB(${i})">
          Edit
        </button>
      </div>
    `
  ).join("");
}

window.editKB = i => {
  const g = prompt(
    "Approved guidance:",
    KB[i].guidance
  );

  if (g !== null) {
    KB[i].guidance = g;
    save();
    renderKB();
  }
};

$("addKB").onclick = () => {
  const t = prompt("Title:");

  const k =
    t && prompt("Keywords, comma separated:");

  const g =
    k !== null && prompt("Approved guidance:");

  if (t && g) {
    KB.push({
      title: t,
      keywords: k || "",
      guidance: g
    });

    save();
    renderKB();
  }
};

/* -----------------------------
   Companies
----------------------------- */

function renderCo() {
  $("companySelect").innerHTML =
    companies.map(
      (c, i) =>
        `<option value="${i}">
          ${esc(c.name)}
        </option>`
    ).join("");

  $("companyList").innerHTML =
    companies.map(
      (c, i) => `
        <div class="kb">
          <h3>${esc(c.name)}</h3>
          <p>
            ${esc(c.industry)} •
            ${esc(c.docs || "No document email")}
          </p>

          <button
            class="secondary"
            onclick="editCo(${i})">
            Edit
          </button>
        </div>
      `
    ).join("");
}

window.editCo = i => {
  const c = companies[i];

  $("cname").value = c.name;
  $("industry").value = c.industry;
  $("docs").value = c.docs || "";
  $("feedback").value = c.feedback || "";

  $("cname").dataset.i = i;
};

$("newCompany").onclick = () => {
  $("cname").value = "";
  $("docs").value = "";
  $("feedback").value = "";

  delete $("cname").dataset.i;
};

$("saveCompany").onclick = () => {
  const c = {
    name: $("cname").value || "New Company",
    industry: $("industry").value,
    docs: $("docs").value,
    feedback: $("feedback").value
  };

  const i = $("cname").dataset.i;

  if (i !== undefined) {
    companies[+i] = c;
  } else {
    companies.push(c);
  }

  delete $("cname").dataset.i;

  save();
  renderCo();
};

/* -----------------------------
   Prepare AI context
----------------------------- */

function buildKnowledgeBase() {
  return KB.map(
    item =>
      `${item.title}: ${item.guidance}`
  ).join("\n");
}

function buildRules() {
  return `
Preferred opening:
${rules.opening}

Additional agent instructions:
${rules.extra}

Do not ask the customer for information that
has already been provided in the conversation.
`;
}

/* -----------------------------
   REAL V4 AI ANALYSIS
----------------------------- */

$("analyse").onclick = async () => {
  const conversation =
    $("conversation").value.trim();

  if (!conversation) return;

  const company =
    companies[
      +$("companySelect").value
    ] || companies[0];

  const button = $("analyse");

  const originalText =
    button.textContent;

  button.disabled = true;
  button.textContent = "Analysing...";

  $("warning").textContent =
    "SupportPilot AI is reviewing the conversation...";

  try {
    const response = await fetch(
      AI_ENDPOINT,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          conversation,
          company: company.name,
          knowledgeBase:
            buildKnowledgeBase(),
          rules:
            buildRules()
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.details ||
        data.error ||
        "AI request failed."
      );
    }

    if (
      !data.success ||
      !data.analysis
    ) {
      throw new Error(
        "No AI analysis was returned."
      );
    }

    const a = data.analysis;

    $("query").textContent =
      a.query || "General enquiry";

    $("sentiment").textContent =
      a.sentiment || "Neutral";

    $("status").textContent =
      a.status || "Not established";

    $("missing").textContent =
      "Missing: " +
      (a.missing || "None");

    $("action").textContent =
      "Next: " +
      (a.next || "Review response");

    let confidence =
      Number(a.confidence);

    if (
      !Number.isFinite(confidence)
    ) {
      confidence = 0;
    }

    confidence =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(confidence)
        )
      );

    $("conf").textContent =
      confidence + "%";

    $("bar").style.width =
      confidence + "%";

    $("reply").value =
      a.reply || "";

    if (
      !a.missing ||
      String(a.missing)
        .toLowerCase() === "none"
    ) {
      $("warning").textContent =
        "AI draft generated. Verify account-specific facts before sending.";
    } else {
      $("warning").textContent =
        "Missing information identified: " +
        a.missing +
        ". Review before sending.";
    }

  } catch (error) {
    console.error(
      "SupportPilot AI:",
      error
    );

    $("warning").textContent =
      "SupportPilot AI could not complete the analysis. " +
      error.message;

  } finally {
    button.disabled = false;
    button.textContent =
      originalText;
  }
};

/* -----------------------------
   Reply controls
----------------------------- */

$("clear").onclick = () => {
  $("conversation").value = "";
  $("reply").value = "";
};

$("copy").onclick = async () => {
  await navigator.clipboard.writeText(
    $("reply").value
  );

  $("copy").textContent =
    "Copied";

  setTimeout(
    () =>
      $("copy").textContent =
        "Copy Reply",
    800
  );
};

$("shorten").onclick = () => {
  const p =
    $("reply")
      .value
      .split(/(?<=[.!?])\s+/);

  if (p.length > 2) {
    $("reply").value =
      p.slice(0, 2).join(" ");
  }
};

$("friendly").onclick = () => {
  if (
    !/appreciate|understand/i.test(
      $("reply").value
    )
  ) {
    $("reply").value =
      $("reply").value.replace(
        rules.opening,
        rules.opening +
        " I appreciate your patience."
      );
  }
};

/* -----------------------------
   AI Rules
----------------------------- */

$("opening").value =
  rules.opening;

$("extra").value =
  rules.extra;

$("saveRules").onclick = () => {
  rules = {
    opening:
      $("opening").value,

    extra:
      $("extra").value
  };

  save();

  $("saveRules").textContent =
    "Saved";

  setTimeout(() => {
    $("saveRules").textContent =
      "Save Rules";
  }, 1000);
};

/* -----------------------------
   Export
----------------------------- */

$("export").onclick = () => {
  const b = new Blob(
    [
      JSON.stringify(
        {
          KB,
          companies,
          rules
        },
        null,
        2
      )
    ],
    {
      type: "application/json"
    }
  );

  const a =
    document.createElement("a");

  a.href =
    URL.createObjectURL(b);

  a.download =
    "supportpilot-v4-config.json";

  a.click();

  URL.revokeObjectURL(a.href);
};

/* -----------------------------
   PWA Installation
----------------------------- */

let dp = null;

window.addEventListener(
  "beforeinstallprompt",
  e => {
    e.preventDefault();
    dp = e;
  }
);

async function install() {
  if (!dp) {
    alert(
      "SupportPilot is already installed or installation is not currently available."
    );
    return;
  }

  dp.prompt();

  await dp.userChoice;

  dp = null;
}

$("install").onclick =
  install;

$("install2").onclick =
  install;

/* -----------------------------
   Network status
----------------------------- */

function net() {
  $("net").textContent =
    navigator.onLine
      ? "Online"
      : "Offline";
}

addEventListener(
  "online",
  net
);

addEventListener(
  "offline",
  net
);

net();

/* -----------------------------
   Service Worker
----------------------------- */

if (
  "serviceWorker" in navigator
) {
  addEventListener(
    "load",
    () =>
      navigator.serviceWorker.register(
        "./service-worker.js"
      )
  );
}

/* -----------------------------
   Initial render
----------------------------- */

renderKB();
renderCo();
