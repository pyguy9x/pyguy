// Bộ máy điền – được tiêm vào trang Thêm mới hồ sơ đảng viên khi bấm "Điền vào trang".
(() => {
  if (window.__dienHoSo) return;

  const TRUONG = [
    ["officialStatus", "Loại đảng viên", "radio"],
    ["securityClassification", "Phân loại đối tượng", "select"],
    ["activityOfficialOrgId", "Tổ chức đảng đang sinh hoạt", "org"],
    ["profileNumber", "Số lý lịch", "text"],
    ["cardNumber", "Số thẻ đảng", "text"],
  ];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const chuan = (s) => (s || "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const click = (el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

  async function cho(fn, ms = 6000, buoc = 150) {
    for (let t = 0; t < ms; t += buoc) {
      const v = fn();
      if (v) return v;
      await sleep(buoc);
    }
    return null;
  }

  function soKhop(ds, gt) {
    const g = chuan(gt);
    let i = ds.findIndex((t) => chuan(t) === g);
    if (i < 0) i = ds.findIndex((t) => g && chuan(t).includes(g));
    return i;
  }

  function datGiaTri(el, v) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  async function dongPopup() {
    const bd = q(".cdk-overlay-backdrop");
    if (bd) click(bd);
    const close = q("vts-modal-container .vtsicon-Close\\:vts");
    if (close) click(close.closest("button") || close);
    await sleep(300);
  }

  // ---- từng kiểu trường ----
  async function dienRadio(key, val) {
    const labels = qa(`[formcontrolname="${key}"] label`);
    const i = soKhop(labels.map((l) => l.innerText), val);
    if (i < 0) throw new Error(`không có lựa chọn "${val}"`);
    labels[i].click();
  }

  async function dienSelect(key, val) {
    const host = q(`vts-select[formcontrolname="${key}"]`);
    host.scrollIntoView({ block: "center" });
    click(q("vts-select-top-control", host));
    const opts = await cho(() => {
      const o = qa(".cdk-overlay-container vts-option-item");
      return o.length ? o : null;
    });
    if (!opts) { await dongPopup(); throw new Error("danh sách không mở được"); }
    const i = soKhop(opts.map((o) => o.innerText), val);
    if (i < 0) { await dongPopup(); throw new Error(`không tìm thấy lựa chọn "${val}"`); }
    opts[i].click();
    await sleep(300);
  }

  async function dienToChuc(key, val) {
    const host = q(`vts-select[formcontrolname="${key}"]`);
    host.scrollIntoView({ block: "center" });
    click(q("vts-select-top-control", host));
    const dlg = await cho(() => q("app-organization-dialog vts-tree-node") && q("app-organization-dialog"), 10000);
    if (!dlg) throw new Error("hộp thoại chọn tổ chức không mở được");
    const g = chuan(val);
    const tim = () => {
      const nodes = qa("vts-tree-node", dlg);
      const hit = nodes.filter((n) => chuan(n.getAttribute("title")).includes(g));
      const exact = hit.filter((n) => {
        const t = chuan(n.getAttribute("title"));
        return t === g || t.split(" - ").slice(1).join(" - ") === g || t.split(" - ")[0] === g;
      });
      return exact[0] || hit[hit.length - 1] || null;
    };
    // Mở dần các nhánh cây cho đến khi thấy tổ chức cần chọn (tối đa 4 cấp)
    let node = tim();
    for (let cap = 0; !node && cap < 4; cap++) {
      const dong = qa("vts-tree-node-switcher.vts-tree-switcher_close", dlg);
      if (!dong.length) break;
      dong.forEach((s) => click(s));
      await sleep(1500);
      node = tim();
    }
    if (!node) { await dongPopup(); throw new Error(`không tìm thấy tổ chức "${val}"`); }
    node.scrollIntoView({ block: "center" });
    click(q("vts-tree-node-title", node));
    await cho(() => !q("app-organization-dialog"), 5000);
  }

  async function dienText(key, val) {
    const el = q(`input[formcontrolname="${key}"], textarea[formcontrolname="${key}"]`);
    el.scrollIntoView({ block: "center" });
    el.focus();
    datGiaTri(el, val);
  }

  function docLai(key, kieu) {
    if (kieu === "text") return q(`[formcontrolname="${key}"]`).value;
    if (kieu === "radio") {
      const l = q(`[formcontrolname="${key}"] label.vts-radio-wrapper-checked`);
      return l ? l.innerText.trim() : "";
    }
    const t = q(`[formcontrolname="${key}"] vts-select-top-control`).innerText.trim();
    return t.startsWith("--") ? "" : t;
  }

  const HAM = { radio: dienRadio, select: dienSelect, org: dienToChuc, text: dienText };

  window.__dienHoSo = async (duLieu) => {
    if (!q('[formcontrolname="currentFullName"]'))
      return { loiChung: "Trang hiện tại không phải trang Thêm mới hồ sơ đảng viên." };
    const kq = [];
    for (const [key, nhan, kieu] of TRUONG) {
      const val = (duLieu[key] ?? "").toString().trim();
      if (!val) continue;
      if (!q(`[formcontrolname="${key}"]`)) {
        kq.push({ nhan, ok: false, loi: key === "cardNumber"
          ? "Trường không hiển thị (đảng viên dự bị không có số thẻ đảng)."
          : "Trường không hiển thị trên trang." });
        continue;
      }
      try {
        await HAM[kieu](key, val);
        await sleep(250);
        kq.push({ nhan, ok: true, hien: docLai(key, kieu) });
      } catch (e) {
        kq.push({ nhan, ok: false, loi: e.message });
      }
    }
    return { kq };
  };
})();
