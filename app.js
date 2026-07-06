(() => {
  const APP_VERSION = "2.0.0";
  const STORAGE_KEY = "travel-expense-jp-kr-v1";

  const TRIPS = {
    japan: {
      label: "2026 日本",
      shortLabel: "日本",
      pageTitle: "2026 日本支出",
      currency: "JPY",
      currencyLabel: "日幣 JPY",
      filename: "japan-expenses",
    },
    korea: {
      label: "2026 韓國",
      shortLabel: "韓國",
      pageTitle: "2026 韓國支出",
      currency: "KRW",
      currencyLabel: "韓幣 KRW",
      filename: "korea-expenses",
    },
  };

  const CURRENCIES = {
    JPY: { label: "日幣", symbol: "¥" },
    KRW: { label: "韓幣", symbol: "₩" },
  };

  const PERSON_COLORS = [
    "#0f766e",
    "#2563eb",
    "#b45309",
    "#be123c",
    "#6d28d9",
    "#047857",
    "#ca8a04",
    "#0369a1",
  ];

  const currentTripKey = document.body.dataset.trip;
  const currentTrip = TRIPS[currentTripKey];
  const els = {};
  let state = loadState();
  let editingExpenseId = null;
  let deferredInstallPrompt = null;

  document.addEventListener("DOMContentLoaded", () => {
    registerServiceWorker();
    if (!currentTrip) return;
    initApp();
  });

  function initApp() {
    cacheElements();
    bindEvents();
    setDefaultExpenseDate();
    renderAll();
  }

  function cacheElements() {
    [
      "storage-status",
      "install-app",
      "export-json",
      "export-csv",
      "import-file",
      "person-form",
      "person-name",
      "people-list",
      "people-count",
      "rate-current",
      "expense-search",
      "summary-grid",
      "expense-form",
      "expense-form-title",
      "expense-date",
      "expense-title",
      "expense-amount",
      "expense-currency-label",
      "expense-paid-by",
      "expense-note",
      "participants-list",
      "select-all-participants",
      "clear-participants",
      "form-message",
      "expense-submit",
      "cancel-edit",
      "settlement-list",
      "expenses-list",
      "empty-expenses",
    ].forEach((id) => {
      els[toCamelCase(id)] = document.getElementById(id);
    });
  }

  function bindEvents() {
    els.personForm.addEventListener("submit", handleAddPerson);
    els.peopleList.addEventListener("click", handlePeopleAction);
    els.rateCurrent.addEventListener("input", handleRateInput);
    els.expenseSearch.addEventListener("input", handleSearchInput);
    els.expenseForm.addEventListener("submit", handleSaveExpense);
    els.selectAllParticipants.addEventListener("click", () => setAllParticipants(true));
    els.clearParticipants.addEventListener("click", () => setAllParticipants(false));
    els.cancelEdit.addEventListener("click", cancelEditing);
    els.expensesList.addEventListener("click", handleExpenseAction);
    els.exportJson.addEventListener("click", exportJson);
    els.exportCsv.addEventListener("click", exportCsv);
    els.importFile.addEventListener("change", importJson);

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      els.installApp.hidden = false;
    });

    els.installApp.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      els.installApp.hidden = true;
    });
  }

  function loadState() {
    const fallback = {
      people: [],
      expenses: [],
      settings: {
        rates: { JPY: "", KRW: "" },
        searchByTrip: { japan: "", korea: "" },
      },
      updatedAt: null,
      version: APP_VERSION,
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      return normalizeState({ ...fallback, ...JSON.parse(raw) });
    } catch {
      return fallback;
    }
  }

  function normalizeState(nextState) {
    const people = Array.isArray(nextState.people)
      ? nextState.people
          .filter((person) => person?.id && person?.name)
          .map((person, index) => ({
            id: String(person.id),
            name: String(person.name),
            color: person.color || PERSON_COLORS[index % PERSON_COLORS.length],
          }))
      : [];

    const peopleIds = new Set(people.map((person) => person.id));
    const expenses = Array.isArray(nextState.expenses)
      ? nextState.expenses
          .filter((expense) => expense?.id && expense?.title && Number(expense.amount) > 0)
          .map((expense) => {
            const currency = CURRENCIES[expense.currency] ? expense.currency : "JPY";
            const trip = TRIPS[expense.trip] ? expense.trip : currency === "KRW" ? "korea" : "japan";
            return {
              id: String(expense.id),
              title: String(expense.title),
              amount: Number(expense.amount),
              currency,
              trip,
              paidBy: peopleIds.has(expense.paidBy) ? expense.paidBy : "",
              participants: Array.isArray(expense.participants)
                ? expense.participants.map(String).filter((id) => peopleIds.has(id))
                : [],
              note: expense.note ? String(expense.note) : "",
              date: expense.date || todayString(),
              createdAt: expense.createdAt || new Date().toISOString(),
              updatedAt: expense.updatedAt || expense.createdAt || new Date().toISOString(),
            };
          })
      : [];

    const oldSearch = nextState.settings?.search || "";
    return {
      people,
      expenses,
      settings: {
        rates: {
          JPY: nextState.settings?.rates?.JPY || "",
          KRW: nextState.settings?.rates?.KRW || "",
        },
        searchByTrip: {
          japan: nextState.settings?.searchByTrip?.japan || oldSearch || "",
          korea: nextState.settings?.searchByTrip?.korea || oldSearch || "",
        },
      },
      updatedAt: nextState.updatedAt || null,
      version: nextState.version || APP_VERSION,
    };
  }

  function saveState() {
    state.updatedAt = new Date().toISOString();
    state.version = APP_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderStorageStatus();
  }

  function renderAll() {
    renderTripNav();
    renderRateInput();
    renderSearchInput();
    renderPeople();
    renderPaidByOptions();
    renderParticipants();
    renderSummary();
    renderSettlement();
    renderExpenses();
    renderStorageStatus();
    updateExpenseSubmitState();
  }

  function renderTripNav() {
    document.querySelectorAll("[data-trip-link]").forEach((link) => {
      const active = link.dataset.tripLink === currentTripKey;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function renderRateInput() {
    els.rateCurrent.value = state.settings.rates[currentTrip.currency];
  }

  function renderSearchInput() {
    els.expenseSearch.value = getCurrentSearch();
  }

  function renderPeople() {
    els.peopleCount.textContent = String(state.people.length);

    if (!state.people.length) {
      els.peopleList.innerHTML = `<li class="muted-row">尚未新增人員</li>`;
      return;
    }

    els.peopleList.innerHTML = state.people
      .map(
        (person) => `
          <li class="person-item" data-id="${escapeHtml(person.id)}">
            <span class="person-dot" style="background:${escapeHtml(person.color)}"></span>
            <span class="person-name" title="${escapeHtml(person.name)}">${escapeHtml(person.name)}</span>
            <span class="person-actions">
              <button class="mini-button" type="button" data-action="rename-person" title="重新命名">✎</button>
              <button class="mini-button" type="button" data-action="delete-person" title="刪除">×</button>
            </span>
          </li>
        `,
      )
      .join("");
  }

  function renderPaidByOptions(selectedId = els.expensePaidBy.value) {
    const options = [
      `<option value="">選擇付款人</option>`,
      ...state.people.map(
        (person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`,
      ),
    ];
    els.expensePaidBy.innerHTML = options.join("");
    if (state.people.some((person) => person.id === selectedId)) els.expensePaidBy.value = selectedId;
  }

  function renderParticipants(checkedIds = getCheckedParticipantIds()) {
    if (!state.people.length) {
      els.participantsList.innerHTML = `<p class="muted-row">尚未新增人員</p>`;
      return;
    }

    const checkedSet = new Set(checkedIds);
    els.participantsList.innerHTML = state.people
      .map(
        (person) => `
          <label class="participant-option" title="${escapeHtml(person.name)}">
            <input type="checkbox" name="participants" value="${escapeHtml(person.id)}" ${
              checkedSet.has(person.id) ? "checked" : ""
            } />
            <span>${escapeHtml(person.name)}</span>
          </label>
        `,
      )
      .join("");
  }

  function renderSummary() {
    const scopedExpenses = getScopedExpenses();
    const total = scopedExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

    els.summaryGrid.innerHTML = `
      <article class="stat-card">
        <span>目前頁面</span>
        <strong>${escapeHtml(currentTrip.shortLabel)}</strong>
        <small>${escapeHtml(currentTrip.currencyLabel)}</small>
      </article>
      <article class="stat-card">
        <span>支出筆數</span>
        <strong>${scopedExpenses.length}</strong>
        <small>${activeParticipantCount(scopedExpenses)} 人有紀錄</small>
      </article>
      <article class="stat-card">
        <span>總支出</span>
        <strong>${formatAmount(total, currentTrip.currency)}</strong>
        <small>${formatTwdEstimate(total, currentTrip.currency)}</small>
      </article>
      <article class="stat-card">
        <span>人員</span>
        <strong>${state.people.length}</strong>
        <small>兩個頁面共用</small>
      </article>
    `;
  }

  function renderSettlement() {
    const scopedExpenses = getScopedExpenses();
    if (!state.people.length || !scopedExpenses.length) {
      els.settlementList.innerHTML = `<p class="empty-state">目前沒有可結算的${escapeHtml(currentTrip.shortLabel)}支出</p>`;
      return;
    }

    const balances = calculateBalances(scopedExpenses);
    const activeRows = Array.from(balances.entries()).filter(([, value]) => Math.abs(value) > 0.005);
    if (!activeRows.length) {
      els.settlementList.innerHTML = `<p class="empty-state">目前已平衡</p>`;
      return;
    }

    const balanceRows = activeRows
      .sort((a, b) => b[1] - a[1])
      .map(([personId, amount]) => {
        const label = amount > 0 ? "應收" : "應付";
        const className = amount > 0 ? "positive" : "negative";
        return `
          <div class="balance-row">
            <strong>${escapeHtml(getPersonName(personId))}</strong>
            <span class="${className}">${label} ${formatAmount(Math.abs(amount), currentTrip.currency)}</span>
          </div>
        `;
      })
      .join("");

    const transfers = buildTransfers(balances);
    const transferRows = transfers.length
      ? transfers
          .map(
            (transfer) => `
              <div class="transfer-row">
                <strong>${escapeHtml(getPersonName(transfer.from))} 給 ${escapeHtml(getPersonName(transfer.to))}</strong>
                <span>${formatAmount(transfer.amount, currentTrip.currency)}</span>
              </div>
            `,
          )
          .join("")
      : `<p class="empty-state">目前已平衡</p>`;

    els.settlementList.innerHTML = `
      <div class="settlement-section">
        <h3>${escapeHtml(currentTrip.currencyLabel)}</h3>
        <div class="balance-grid">${balanceRows}</div>
        <div class="transfer-grid">${transferRows}</div>
      </div>
    `;
  }

  function renderExpenses() {
    const expenses = getVisibleExpenses();
    els.emptyExpenses.hidden = expenses.length > 0;

    if (!expenses.length) {
      els.expensesList.innerHTML = "";
      return;
    }

    els.expensesList.innerHTML = expenses
      .map((expense) => {
        const participants = expense.participants.map((id) => getPersonName(id));
        const payer = getPersonName(expense.paidBy);
        return `
          <article class="expense-card" data-id="${escapeHtml(expense.id)}">
            <div class="expense-top">
              <div>
                <div class="expense-title-row">
                  <span class="trip-badge ${escapeHtml(expense.trip)}">${escapeHtml(currentTrip.shortLabel)}</span>
                  <h3 title="${escapeHtml(expense.title)}">${escapeHtml(expense.title)}</h3>
                </div>
                <p class="expense-meta">${escapeHtml(expense.date)} · ${escapeHtml(payer)} 支出 · ${
                  expense.participants.length
                } 人平分</p>
              </div>
              <div class="expense-amount">
                <strong>${formatAmount(expense.amount, expense.currency)}</strong>
                <small>${formatTwdEstimate(expense.amount, expense.currency)}</small>
              </div>
            </div>
            <div class="chip-row">
              <span class="currency-badge">${escapeHtml(CURRENCIES[expense.currency].label)}</span>
              ${participants.map((name) => `<span class="name-chip">${escapeHtml(name)}</span>`).join("")}
            </div>
            ${expense.note ? `<p class="expense-note">${escapeHtml(expense.note)}</p>` : ""}
            <div class="expense-actions">
              <button class="icon-button" type="button" data-action="edit-expense" title="編輯">✎</button>
              <button class="icon-button" type="button" data-action="delete-expense" title="刪除">×</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderStorageStatus() {
    if (!els.storageStatus) return;
    if (!state.updatedAt) {
      els.storageStatus.textContent = "尚未儲存";
      return;
    }
    els.storageStatus.textContent = `已儲存 ${formatDateTime(state.updatedAt)}`;
  }

  function handleAddPerson(event) {
    event.preventDefault();
    const name = els.personName.value.trim();
    if (!name) return;

    const alreadyExists = state.people.some((person) => person.name.toLowerCase() === name.toLowerCase());
    if (alreadyExists) {
      els.personName.select();
      return;
    }

    state.people.push({
      id: createId(),
      name,
      color: PERSON_COLORS[state.people.length % PERSON_COLORS.length],
    });
    els.personName.value = "";
    saveState();
    renderPeople();
    renderPaidByOptions();
    renderParticipants();
    renderSummary();
    renderSettlement();
    updateExpenseSubmitState();
  }

  function handlePeopleAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const item = button.closest("[data-id]");
    const personId = item?.dataset.id;
    const person = state.people.find((entry) => entry.id === personId);
    if (!person) return;

    if (button.dataset.action === "rename-person") {
      const nextName = window.prompt("人員名稱", person.name)?.trim();
      if (!nextName) return;
      person.name = nextName.slice(0, 24);
      saveState();
      renderAll();
    }

    if (button.dataset.action === "delete-person") {
      const inUse = state.expenses.some(
        (expense) => expense.paidBy === personId || expense.participants.includes(personId),
      );
      if (inUse) {
        window.alert("這位人員已出現在支出紀錄中，請先調整相關支出。");
        return;
      }
      if (!window.confirm(`刪除 ${person.name}？`)) return;
      state.people = state.people.filter((entry) => entry.id !== personId);
      saveState();
      renderAll();
    }
  }

  function handleRateInput() {
    state.settings.rates[currentTrip.currency] = els.rateCurrent.value;
    saveState();
    renderSummary();
    renderExpenses();
  }

  function handleSearchInput() {
    state.settings.searchByTrip[currentTripKey] = els.expenseSearch.value.trim();
    saveState();
    renderExpenses();
  }

  function handleSaveExpense(event) {
    event.preventDefault();
    clearFormMessage();

    const expense = readExpenseForm();
    if (!expense) return;

    if (editingExpenseId) {
      const current = state.expenses.find((item) => item.id === editingExpenseId);
      if (!current) return;
      Object.assign(current, expense, { updatedAt: new Date().toISOString() });
      editingExpenseId = null;
      resetExpenseForm(true);
    } else {
      state.expenses.push({
        id: createId(),
        ...expense,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      resetExpenseForm(false);
    }

    saveState();
    renderAll();
  }

  function readExpenseForm() {
    const title = els.expenseTitle.value.trim();
    const amount = Number(els.expenseAmount.value);
    const paidBy = els.expensePaidBy.value;
    const participants = getCheckedParticipantIds();

    if (!state.people.length) {
      setFormMessage("請先新增人員。");
      return null;
    }
    if (!title) {
      setFormMessage("請輸入支出名稱。");
      els.expenseTitle.focus();
      return null;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormMessage("請輸入正確金額。");
      els.expenseAmount.focus();
      return null;
    }
    if (!paidBy) {
      setFormMessage("請選擇付款人。");
      els.expensePaidBy.focus();
      return null;
    }
    if (!participants.length) {
      setFormMessage("請至少選擇一位分攤人員。");
      return null;
    }

    return {
      title,
      amount,
      currency: currentTrip.currency,
      trip: currentTripKey,
      paidBy,
      participants,
      note: els.expenseNote.value.trim(),
      date: els.expenseDate.value || todayString(),
    };
  }

  function handleExpenseAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const card = button.closest("[data-id]");
    const expenseId = card?.dataset.id;
    const expense = state.expenses.find((item) => item.id === expenseId);
    if (!expense) return;

    if (button.dataset.action === "edit-expense") startEditing(expense);

    if (button.dataset.action === "delete-expense") {
      if (!window.confirm(`刪除「${expense.title}」？`)) return;
      state.expenses = state.expenses.filter((item) => item.id !== expenseId);
      if (editingExpenseId === expenseId) cancelEditing();
      saveState();
      renderAll();
    }
  }

  function startEditing(expense) {
    editingExpenseId = expense.id;
    els.expenseFormTitle.textContent = `編輯${currentTrip.shortLabel}支出`;
    els.expenseSubmit.textContent = "更新支出";
    els.cancelEdit.hidden = false;

    els.expenseDate.value = expense.date;
    els.expenseTitle.value = expense.title;
    els.expenseAmount.value = String(expense.amount);
    els.expenseCurrencyLabel.value = currentTrip.currencyLabel;
    els.expensePaidBy.value = expense.paidBy;
    els.expenseNote.value = expense.note;
    renderParticipants(expense.participants);
    clearFormMessage();
    els.expenseTitle.focus();
  }

  function cancelEditing() {
    editingExpenseId = null;
    resetExpenseForm(true);
    renderParticipants();
  }

  function resetExpenseForm(clearPeopleChoices) {
    els.expenseFormTitle.textContent = `新增${currentTrip.shortLabel}支出`;
    els.expenseSubmit.textContent = `新增${currentTrip.shortLabel}支出`;
    els.cancelEdit.hidden = true;
    els.expenseTitle.value = "";
    els.expenseAmount.value = "";
    els.expenseCurrencyLabel.value = currentTrip.currencyLabel;
    els.expenseNote.value = "";
    clearFormMessage();

    if (clearPeopleChoices) {
      els.expensePaidBy.value = "";
      setAllParticipants(false);
    }

    setDefaultExpenseDate();
  }

  function setAllParticipants(checked) {
    document.querySelectorAll('input[name="participants"]').forEach((input) => {
      input.checked = checked;
    });
  }

  function updateExpenseSubmitState() {
    els.expenseSubmit.disabled = state.people.length === 0;
  }

  function setFormMessage(message) {
    els.formMessage.textContent = message;
  }

  function clearFormMessage() {
    els.formMessage.textContent = "";
  }

  function getCheckedParticipantIds() {
    return Array.from(document.querySelectorAll('input[name="participants"]:checked')).map((input) => input.value);
  }

  function getScopedExpenses() {
    return state.expenses.filter((expense) => expense.trip === currentTripKey);
  }

  function getVisibleExpenses() {
    const search = getCurrentSearch().toLowerCase();
    return getScopedExpenses()
      .filter((expense) => {
        if (!search) return true;
        const haystack = [
          expense.title,
          expense.note,
          getPersonName(expense.paidBy),
          ...expense.participants.map((id) => getPersonName(id)),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }

  function calculateBalances(expenses) {
    const balances = new Map(state.people.map((person) => [person.id, 0]));

    expenses.forEach((expense) => {
      if (!expense.paidBy || !expense.participants.length) return;
      if (expense.currency !== currentTrip.currency) return;

      const amount = Number(expense.amount) || 0;
      const share = amount / expense.participants.length;

      balances.set(expense.paidBy, (balances.get(expense.paidBy) || 0) + amount);
      expense.participants.forEach((personId) => {
        balances.set(personId, (balances.get(personId) || 0) - share);
      });
    });

    return balances;
  }

  function buildTransfers(balances) {
    const debtors = [];
    const creditors = [];

    balances.forEach((amount, personId) => {
      const rounded = roundAmount(amount);
      if (rounded < -0.005) debtors.push({ personId, amount: Math.abs(rounded) });
      if (rounded > 0.005) creditors.push({ personId, amount: rounded });
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transfers = [];
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amount = roundAmount(Math.min(debtor.amount, creditor.amount));

      if (amount > 0.005) {
        transfers.push({
          from: debtor.personId,
          to: creditor.personId,
          amount,
        });
      }

      debtor.amount = roundAmount(debtor.amount - amount);
      creditor.amount = roundAmount(creditor.amount - amount);

      if (debtor.amount <= 0.005) debtorIndex += 1;
      if (creditor.amount <= 0.005) creditorIndex += 1;
    }

    return transfers;
  }

  function activeParticipantCount(expenses) {
    const ids = new Set();
    expenses.forEach((expense) => {
      if (expense.paidBy) ids.add(expense.paidBy);
      expense.participants.forEach((id) => ids.add(id));
    });
    return ids.size;
  }

  function exportJson() {
    const payload = {
      app: "travel-expense-jp-kr",
      exportedAt: new Date().toISOString(),
      data: state,
    };
    downloadBlob(JSON.stringify(payload, null, 2), "travel-expenses-backup.json", "application/json");
  }

  function exportCsv() {
    const rows = [
      ["date", "trip", "title", "amount", "currency", "paid_by", "participants", "note"],
      ...getScopedExpenses().map((expense) => [
        expense.date,
        TRIPS[expense.trip]?.label || expense.trip,
        expense.title,
        String(expense.amount),
        expense.currency,
        getPersonName(expense.paidBy),
        expense.participants.map((id) => getPersonName(id)).join("; "),
        expense.note,
      ]),
    ];

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    downloadBlob(`\uFEFF${csv}`, `${currentTrip.filename}.csv`, "text/csv;charset=utf-8");
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = normalizeState(parsed.data || parsed);
        if (!window.confirm("匯入後會取代目前資料，確定匯入？")) return;
        state = imported;
        editingExpenseId = null;
        saveState();
        renderAll();
      } catch {
        window.alert("JSON 格式無法匯入。");
      } finally {
        els.importFile.value = "";
      }
    };
    reader.readAsText(file);
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  function getCurrentSearch() {
    return state.settings.searchByTrip[currentTripKey] || "";
  }

  function setDefaultExpenseDate() {
    if (!els.expenseDate.value) els.expenseDate.value = todayString();
  }

  function todayString() {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function formatAmount(value, currency) {
    const amount = Number(value) || 0;
    const decimals = Number.isInteger(amount) ? 0 : 2;
    const formatted = new Intl.NumberFormat("zh-TW", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${CURRENCIES[currency]?.symbol || ""}${formatted} ${currency}`;
  }

  function formatTwdEstimate(value, currency) {
    const rate = Number(state.settings.rates[currency]);
    if (!rate || rate <= 0) return "未設定台幣估算";
    const twd = Number(value) * rate;
    return `約 NT$${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(twd)}`;
  }

  function formatDateTime(isoString) {
    return new Intl.DateTimeFormat("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  }

  function getPersonName(personId) {
    return state.people.find((person) => person.id === personId)?.name || "未指定";
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function roundAmount(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toCamelCase(id) {
    return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }
})();
