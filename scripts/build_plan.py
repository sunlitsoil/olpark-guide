"""기획서 원고(텍스트)를 안내문 양식 순서의 docx로 만든다.
사용: python scripts/build_plan.py 원고.txt 출력.docx
원고 규칙: [기획 요약서]/[상세 기획서] 구획, 「N.」·「N-N.」 제목, 「- 」 목록, 「|」 표, 「[그림 N] 설명」 그림 자리.
[참가 신청서 기재 문안] 이후는 넣지 않는다."""
import re, sys
from pathlib import Path
from docx import Document
from docx.shared import Pt, Cm, Mm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = Path(__file__).resolve().parent.parent
FIG = {
    "1": (ROOT / "docs/figs/fig-screen-desktop.png", 11.5),
    "2": (ROOT / "docs/figs/fig-hourly.png", 16.0),
    "3": (ROOT / "docs/figs/fig-month.png", 16.0),
    "4": (ROOT / "docs/figs/fig-screen-mobile.png", 6.0),
}
FONT = "맑은 고딕"
src = Path(sys.argv[1]).read_text(encoding="utf-8")
src = src.split("[참가 신청서 기재 문안]")[0]
out = Path(sys.argv[2])

doc = Document()
st = doc.styles["Normal"]
st.font.name = FONT; st.font.size = Pt(10.5)
st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
st.paragraph_format.space_after = Pt(4); st.paragraph_format.line_spacing = 1.3
sec = doc.sections[0]
sec.page_width, sec.page_height = Mm(210), Mm(297)
sec.left_margin = sec.right_margin = Cm(2.2); sec.top_margin = sec.bottom_margin = Cm(2)

def run(p, text, bold=False, size=None, color=None):
    r = p.add_run(text); r.bold = bold
    r.font.name = FONT; r._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    if size: r.font.size = Pt(size)
    if color: r.font.color.rgb = RGBColor.from_string(color)
    return r

def para(text, bold=False, size=None, indent=0, after=4, before=0, align=None, color=None):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(indent); p.paragraph_format.space_after = Pt(after); p.paragraph_format.space_before = Pt(before)
    if align: p.alignment = align
    run(p, text, bold, size, color)
    return p

def shade(cell, color="EEF3EF"):
    tcPr = cell._tc.get_or_add_tcPr()
    s = OxmlElement("w:shd"); s.set(qn("w:val"), "clear"); s.set(qn("w:color"), "auto"); s.set(qn("w:fill"), color); tcPr.append(s)

def table(rows):
    rows = [r for r in rows if not set(r.replace("|", "").strip()) <= set("-: ")]
    cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
    t = doc.add_table(rows=len(cells), cols=len(cells[0])); t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, row in enumerate(cells):
        for j, v in enumerate(row):
            c = t.cell(i, j); c.text = ""
            p = c.paragraphs[0]; p.paragraph_format.space_after = Pt(0); p.paragraph_format.line_spacing = 1.15
            run(p, v, bold=(i == 0), size=9)
            if i == 0: shade(c)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)

def figure(n, caption):
    path, w = FIG[n]
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(str(path), width=Cm(w))
    para(f"[그림 {n}] {caption}", size=9, align=WD_ALIGN_PARAGRAPH.CENTER, after=8, color="56605A")

# 표지 머리
para("2026년도 공공데이터 활용 경진대회 기획서", bold=True, size=16, after=2)
para("한국체육산업개발(주) 개방 공공데이터 활용 사례 · 개인 참가", size=10, after=10, color="56605A")

lines = src.splitlines()
i, part = 0, None
while i < len(lines):
    ln = lines[i].rstrip()
    s = ln.strip()
    if not s:
        i += 1; continue
    if s == "[기획 요약서]":
        part = "sum"; para("o 기획 요약서", bold=True, size=13, after=6, color="1F7A4D")
    elif s == "[상세 기획서]":
        part = "det"; doc.add_page_break(); para("o 상세 기획서", bold=True, size=13, after=6, color="1F7A4D")
    elif s.startswith("|"):
        block = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            block.append(lines[i]); i += 1
        table(block); continue
    elif m := re.match(r"\[그림 (\d+)\]\s*(.*)", s):
        figure(m.group(1), m.group(2))
    elif re.match(r"^\d+-\d+\.\s", s):
        para(s, bold=True, size=11, before=4, after=3)
    elif re.match(r"^\d+\.\s", s):
        para(s, bold=True, size=12 if part == "det" else 11, before=8 if part == "det" else 4, after=3)
    elif re.match(r"^[①-⑩]\s*\S{1,12}$", s):
        para(s, bold=True, before=3, after=2)
    elif re.match(r"^\s{2,}[·①-⑩]", ln):
        para(s, indent=1.0, after=2)
    elif s.startswith("- "):
        para("• " + s[2:], indent=0.4, after=3)
    else:
        para(s)
    i += 1

doc.save(out)
print(out)
