# -*- coding: utf-8 -*-
"""
Bộ máy điền tự động trang "Thêm mới hồ sơ đảng viên"
(tcxdd.dcs.vn/dangvien/pages/profile-manage/party-member/create).

Bản thử nghiệm: 5 trường đầu trang.
"""
import unicodedata

URL_TAO_MOI = "https://tcxdd.dcs.vn/dangvien/pages/profile-manage/party-member/create"

# Thứ tự và kiểu các trường (đúng thứ tự trên trang)
TRUONG = [
    # (khóa formcontrolname, nhãn hiển thị, kiểu)
    ("officialStatus",         "Loại đảng viên",                              "radio"),
    ("securityClassification", "Phân loại đối tượng",                         "select"),
    ("activityOfficialOrgId",  "Tổ chức đảng đang sinh hoạt chính thức",      "org"),
    ("profileNumber",          "Số lý lịch",                                  "text"),
    ("cardNumber",             "Số thẻ đảng",                                 "text"),
]

LUA_CHON = {
    "officialStatus": ["Đảng viên chính thức", "Đảng viên dự bị"],
    "securityClassification": [
        "Không thuộc nhóm đối tượng có vấn đề về lịch sử chính trị và diện Bộ Chính trị, Ban Bí thư quản lý",
        "Có vấn đề về chính trị",
    ],
}


def chuan(s):
    """Chuẩn hóa chuỗi tiếng Việt để so sánh (NFC, bỏ khoảng trắng thừa, chữ thường)."""
    s = unicodedata.normalize("NFC", str(s or ""))
    return " ".join(s.split()).lower()


def _so_khop(danh_sach, gia_tri):
    """Trả về chỉ số phần tử khớp: ưu tiên khớp đúng, sau đó khớp một phần."""
    g = chuan(gia_tri)
    for i, t in enumerate(danh_sach):
        if chuan(t) == g:
            return i
    for i, t in enumerate(danh_sach):
        if g and g in chuan(t):
            return i
    return -1


def _dong_popup(page):
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)


def dien_radio(page, key, val):
    labels = page.locator(f'[formcontrolname="{key}"] label')
    texts = labels.all_inner_texts()
    i = _so_khop(texts, val)
    if i < 0:
        raise ValueError(f'không có lựa chọn "{val}"; hiện có: {texts}')
    labels.nth(i).click()


def dien_select(page, key, val):
    host = page.locator(f'vts-select[formcontrolname="{key}"]')
    host.scroll_into_view_if_needed()
    host.locator("vts-select-top-control").click()
    opts = page.locator(".cdk-overlay-container vts-option-item")
    try:
        opts.first.wait_for(state="visible", timeout=5000)
    except Exception:
        pass
    i = _so_khop(opts.all_inner_texts(), val)
    if i < 0:  # danh sách dài: gõ để lọc rồi tìm lại
        host.locator("input").press_sequentially(val, delay=20)
        page.wait_for_timeout(800)
        i = _so_khop(opts.all_inner_texts(), val)
    if i < 0:
        _dong_popup(page)
        raise ValueError(f'không tìm thấy lựa chọn "{val}"')
    opts.nth(i).click()


def dien_to_chuc(page, key, val):
    """Ô tổ chức đảng mở hộp thoại cây tổ chức: gõ tìm theo tên/mã rồi bấm chọn."""
    host = page.locator(f'vts-select[formcontrolname="{key}"]')
    host.scroll_into_view_if_needed()
    host.locator("vts-select-top-control").click()
    dlg = page.locator("app-organization-dialog")
    dlg.wait_for(state="visible", timeout=10000)
    o_tim = dlg.locator('input[placeholder^="Tìm kiếm"]')
    o_tim.click()
    o_tim.press_sequentially(val, delay=30)
    page.wait_for_timeout(1500)
    nodes = dlg.locator("vts-tree-node")
    titles = [nodes.nth(k).get_attribute("title") or "" for k in range(nodes.count())]
    g = chuan(val)
    # ưu tiên nút sâu nhất (cuối danh sách) chứa chuỗi tìm kiếm
    idx = [k for k, t in enumerate(titles) if g in chuan(t)]
    if not idx:
        _dong_popup(page)
        raise ValueError(f'không tìm thấy tổ chức "{val}"')
    exact = [k for k in idx if chuan(titles[k]) == g or chuan(titles[k]).split(" - ", 1)[-1] == g]
    k = exact[0] if exact else idx[-1]
    nodes.nth(k).locator("vts-tree-node-title").click()
    dlg.wait_for(state="hidden", timeout=5000)


def dien_text(page, key, val):
    o = page.locator(f'input[formcontrolname="{key}"], textarea[formcontrolname="{key}"]')
    o.scroll_into_view_if_needed()
    o.fill(str(val))
    o.press("Tab")


HAM = {"radio": dien_radio, "select": dien_select, "org": dien_to_chuc, "text": dien_text}


def doc_lai(page, key, kieu):
    """Đọc lại giá trị đang hiển thị trên trang để đối chiếu."""
    if kieu == "text":
        return page.locator(f'[formcontrolname="{key}"]').input_value()
    if kieu == "radio":
        lb = page.locator(f'[formcontrolname="{key}"] label.vts-radio-wrapper-checked')
        return lb.first.inner_text().strip() if lb.count() else ""
    t = page.locator(f'[formcontrolname="{key}"] vts-select-top-control').inner_text().strip()
    return "" if t.startswith("--") else t


def tim_trang_tao_moi(context):
    for p in context.pages:
        if "/party-member/create" in p.url:
            return p
    return None


def dien_ho_so(page, du_lieu, bao_cao=print):
    """Điền các trường có giá trị trong du_lieu. Trả về (số thành công, danh sách lỗi)."""
    ok, loi = 0, []
    page.bring_to_front()
    for key, nhan, kieu in TRUONG:
        val = du_lieu.get(key)
        if val is None or str(val).strip() == "":
            continue
        val = str(val).strip()
        try:
            HAM[kieu](page, key, val)
            page.wait_for_timeout(300)
            hien = doc_lai(page, key, kieu)
            bao_cao(f"  ✔ {nhan}: {hien}")
            ok += 1
        except Exception as e:
            msg = str(e).splitlines()[0][:200]
            loi.append(f"{nhan}: {msg}")
            bao_cao(f"  ✘ {nhan}: {msg}")
    return ok, loi
