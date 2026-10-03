const KHOA = ["officialStatus", "securityClassification", "activityOfficialOrgId", "profileNumber", "cardNumber"];
const $ = (id) => document.getElementById(id);
const kq = $("kq");

// Chỉ nhớ tên tổ chức đảng (thường dùng lại), không lưu số lý lịch, số thẻ.
chrome.storage.local.get("org", (d) => { if (d.org) $("activityOfficialOrgId").value = d.org; });

function hien(dong) {
  kq.innerHTML = "";
  for (const d of dong) {
    const div = document.createElement("div");
    div.className = d.ok ? "ok" : "err";
    const b = document.createElement("b");
    b.textContent = (d.ok ? "✔ " : "✘ ") + d.nhan;
    const s = document.createElement("small");
    s.textContent = d.ok ? d.hien : d.loi;
    div.append(b, s);
    kq.append(div);
  }
}

$("xoa").onclick = () => { KHOA.forEach((k) => ($(k).value = "")); kq.innerHTML = ""; };

$("dien").onclick = async () => {
  const duLieu = Object.fromEntries(KHOA.map((k) => [k, $(k).value.trim()]));
  if (!Object.values(duLieu).some(Boolean)) return hien([{ ok: false, nhan: "Chưa nhập dữ liệu", loi: "Nhập ít nhất một trường." }]);
  chrome.storage.local.set({ org: duLieu.activityOfficialOrgId });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/tcxdd\.dcs\.vn\//.test(tab.url || ""))
    return hien([{ ok: false, nhan: "Sai trang", loi: "Hãy mở trang Thêm mới hồ sơ đảng viên trên tcxdd.dcs.vn rồi bấm lại." }]);

  $("dien").disabled = true;
  kq.textContent = "Đang điền…";
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["fill.js"] });
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (d) => window.__dienHoSo(d),
      args: [duLieu],
    });
    const v = r.result || {};
    if (v.loiChung) hien([{ ok: false, nhan: "Không điền được", loi: v.loiChung }]);
    else hien(v.kq || []);
  } catch (e) {
    hien([{ ok: false, nhan: "Lỗi", loi: e.message }]);
  } finally {
    $("dien").disabled = false;
  }
};
