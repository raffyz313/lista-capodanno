import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://zbaiuqxlwfajewvqrgam.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6K31StOil_U02mGhM9bmQQ_3EHEA1Dy";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const listEl = $("list");
const summaryEl = $("summary");

const addForm = $("addForm");
const addCosa = $("addCosa");
const addQuanto = $("addQuanto");
const addChi = $("addChi");
const addQuantoPorta = $("addQuantoPorta");

const toastEl = $("toast");
let toastTimer = null;

const params = new URLSearchParams(location.search);
const presetName = params.get("name") || "";
if (presetName && addChi) addChi.value = presetName;

function escapeHtml(s) {
    return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function showToast(message, type = "success") {
    if (!toastEl) return;

    toastEl.textContent = message;
    toastEl.style.display = "block";

    if (type === "success") {
        toastEl.style.background = "#f3fff3";
        toastEl.style.border = "1px solid #cfe8cf";
        toastEl.style.color = "#1b5e20";
    } else {
        toastEl.style.background = "#fff3f3";
        toastEl.style.border = "1px solid #f2b8b5";
        toastEl.style.color = "#8a1c1c";
    }

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.style.display = "none";
    }, 2400);
}

function renderSummary(rows) {
    const claimed = rows.filter(
        (r) => (r.chi_porta ?? "").trim() !== "" && (r.quanto_porta ?? "").trim() !== ""
    );

    if (!claimed.length) {
        summaryEl.innerHTML = "Nessuno ha ancora dichiarato nulla.";
        return;
    }

    summaryEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Chi</th>
          <th>Cosa</th>
          <th>Quanto porta</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${claimed
        .map(
            (r) => `
          <tr>
            <td>${escapeHtml(r.chi_porta)}</td>
            <td>${escapeHtml(r.cosa)}</td>
            <td>${escapeHtml(r.quanto_porta)}</td>
            <td><button data-unclaim="${r.id}">Annulla</button></td>
          </tr>
        `
        )
        .join("")}
      </tbody>
    </table>
  `;
}

async function loadItems() {
    const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        listEl.innerHTML = `<tr><td colspan="4">Errore: ${escapeHtml(error.message)}</td></tr>`;
        showToast("Errore nel caricamento dati", "error");
        return;
    }

    if (!data?.length) {
        listEl.innerHTML = `<tr><td colspan="4">Lista vuota. Situazione sospetta.</td></tr>`;
        summaryEl.innerHTML = "Nessuno ha ancora dichiarato nulla.";
        return;
    }

    // Tabella sempre pronta con campi vuoti
    listEl.innerHTML = data
        .map(
            (row) => `
    <tr data-row="${row.id}">
      <td>${escapeHtml(row.cosa)}</td>
      <td>${escapeHtml(row.quanto_richiesto)}</td>
      <td>
        <input class="cellEdit" data-field="chi_porta" value="${escapeHtml(presetName)}" placeholder="Nome" />
      </td>
      <td>
        <input class="cellEdit" data-field="quanto_porta" value="" placeholder="Es. 2 bottiglie" />
      </td>
      <td class="actions">
        <button data-save="${row.id}">Salva</button>
      </td>
    </tr>
  `
        )
        .join("");

    renderSummary(data);
}

async function saveRow(id) {
    const tr = document.querySelector(`tr[data-row="${id}"]`);
    if (!tr) return;

    const chiInput = tr.querySelector(`input[data-field="chi_porta"]`);
    const qpInput = tr.querySelector(`input[data-field="quanto_porta"]`);

    const chi = (chiInput?.value ?? "").trim();
    const qp = (qpInput?.value ?? "").trim();

    if (!chi || !qp) {
        showToast("Compila nome e quanto porti", "error");
        return;
    }

    const { error } = await supabase
        .from("items")
        .update({ chi_porta: chi, quanto_porta: qp })
        .eq("id", id);

    if (error) {
        showToast("Errore nel salvataggio", "error");
        return;
    }

    showToast("Salvataggio riuscito", "success");

    // Reset allo stato di default nella tabella
    chiInput.value = presetName;   // se lo vuoi vuoto: cambia in ""
    qpInput.value = "";

    // Aggiorna sommario da DB
    await loadItems();
}

addForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const cosa = addCosa.value.trim();
    const quanto_richiesto = addQuanto.value.trim();
    const chi_porta = addChi.value.trim();
    const quanto_porta = addQuantoPorta.value.trim();

    if (!cosa || !quanto_richiesto) {
        showToast("Inserisci cosa e quanto richiesto", "error");
        return;
    }

    const { error } = await supabase.from("items").insert({
        cosa,
        quanto_richiesto,
        chi_porta: chi_porta || null,
        quanto_porta: quanto_porta || null,
    });

    if (error) {
        showToast("Errore nell’aggiunta riga", "error");
        return;
    }

    showToast("Riga aggiunta", "success");

    addCosa.value = "";
    addQuanto.value = "";
    addQuantoPorta.value = "";
    // lascia addChi com’è, cosi non lo riscrivi ogni volta
    await loadItems();
});

document.addEventListener("click", async (e) => {
    const unclaimBtn = e.target.closest("button[data-unclaim]");
    if (unclaimBtn) {
        const id = unclaimBtn.getAttribute("data-unclaim");

        const ok = confirm("Vuoi annullare? La voce torna libera.");
        if (!ok) return;

        const { error } = await supabase
            .from("items")
            .update({ chi_porta: null, quanto_porta: null })
            .eq("id", id);

        if (error) {
            showToast("Errore durante l’annullamento", "error");
            return;
        }

        showToast("Annullato", "success");
        await loadItems();
        return;
    }

    const saveBtn = e.target.closest("button[data-save]");
    if (saveBtn) {
        const id = saveBtn.getAttribute("data-save");
        await saveRow(id);
    }
});

// Salvataggio con Invio dentro gli input
document.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const inp = e.target.closest('tr[data-row] input[data-field]');
    if (!inp) return;

    e.preventDefault();
    const tr = inp.closest("tr[data-row]");
    await saveRow(tr.getAttribute("data-row"));
});

// Realtime + fallback
supabase
    .channel("items-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => loadItems())
    .subscribe();

setInterval(() => loadItems(), 15000);

loadItems();
