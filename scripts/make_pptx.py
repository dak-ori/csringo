"""
CSQuest 졸업논문 발표 PPTX 생성 스크립트
블랙&화이트 스타일, 13슬라이드
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
from pptx.oxml.ns import qn
from pptx.enum.shapes import MSO_SHAPE_TYPE
import copy
from lxml import etree
import os

# ── 색상 ──────────────────────────────────────────────
BLACK   = RGBColor(0x00, 0x00, 0x00)
WHITE   = RGBColor(0xFF, 0xFF, 0xFF)
GRAY_LT = RGBColor(0xF0, 0xF0, 0xF0)   # 연회색 배경
GRAY_MD = RGBColor(0xCC, 0xCC, 0xCC)   # 중간 회색
GRAY_DK = RGBColor(0x50, 0x50, 0x50)   # 어두운 회색
GRAY_BK = RGBColor(0x22, 0x22, 0x22)   # 거의 검정

# ── 레이아웃 ──────────────────────────────────────────
W  = Inches(13.33)
H  = Inches(7.5)
ML = Inches(0.7)   # margin left
MR = Inches(0.7)   # margin right
MT = Inches(1.2)   # margin top (title 아래)
MB = Inches(0.4)   # margin bottom
CW = W - ML - MR   # content width

TITLE_TOP  = Inches(0.25)
TITLE_H    = Inches(0.75)
CONTENT_TOP = Inches(1.15)
CONTENT_H   = H - CONTENT_TOP - MB - Inches(0.3)


def new_prs() -> Presentation:
    prs = Presentation()
    prs.slide_width  = W
    prs.slide_height = H
    return prs


def blank_slide(prs: Presentation):
    layout = prs.slide_layouts[6]  # 빈 레이아웃
    return prs.slides.add_slide(layout)


def add_textbox(slide, left, top, width, height,
                text="", font_size=18, bold=False, color=BLACK,
                align=PP_ALIGN.LEFT, word_wrap=True, bg=None,
                italic=False) -> object:
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = word_wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    if bg:
        fill = txBox.fill
        fill.solid()
        fill.fore_color.rgb = bg
    return txBox


def add_title(slide, text, subtitle=None):
    """상단 제목 바"""
    # 제목 배경 바
    rect = slide.shapes.add_shape(
        1,  # MSO_SHAPE_TYPE.RECTANGLE
        Inches(0), TITLE_TOP, W, TITLE_H
    )
    rect.fill.solid()
    rect.fill.fore_color.rgb = BLACK
    rect.line.fill.background()

    tf = rect.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    run = p.add_run()
    run.text = "  " + text
    run.font.size = Pt(26)
    run.font.bold = True
    run.font.color.rgb = WHITE

    if subtitle:
        add_textbox(slide, ML, TITLE_TOP + TITLE_H + Inches(0.05),
                    CW, Inches(0.35),
                    text=subtitle, font_size=13, color=GRAY_DK)


def add_footer(slide, page_num: int, total: int = 13):
    """페이지 번호"""
    add_textbox(slide,
                W - Inches(1.0), H - Inches(0.38),
                Inches(0.9), Inches(0.3),
                text=f"{page_num} / {total}",
                font_size=11, color=GRAY_MD,
                align=PP_ALIGN.RIGHT)


def add_bullet(slide, left, top, width, height, items: list[tuple[str,int]],
               font_size=16, line_spacing=1.2):
    """
    items: [(text, level), ...] level=0은 일반, 1은 들여쓰기
    """
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True

    first = True
    for text, level in items:
        if first:
            p = tf.paragraphs[0]
            first = False
        else:
            p = tf.add_paragraph()
        p.level = level
        indent = "    " * level
        bullet_char = "▪ " if level == 0 else "- "
        run = p.add_run()
        run.text = indent + bullet_char + text
        run.font.size = Pt(font_size - level * 1.5)
        run.font.color.rgb = BLACK if level == 0 else GRAY_DK
        run.font.bold = (level == 0)


def add_box(slide, left, top, width, height, title="", body="",
            title_size=15, body_size=13, bg=GRAY_LT, border=True):
    rect = slide.shapes.add_shape(1, left, top, width, height)
    rect.fill.solid()
    rect.fill.fore_color.rgb = bg
    if border:
        rect.line.color.rgb = GRAY_MD
        rect.line.width = Pt(0.75)
    else:
        rect.line.fill.background()

    inner_left = left + Inches(0.15)
    inner_top  = top  + Inches(0.12)
    inner_w    = width - Inches(0.3)
    inner_h    = height - Inches(0.24)

    if title and body:
        # 제목
        tb = slide.shapes.add_textbox(inner_left, inner_top, inner_w, Inches(0.35))
        tb.text_frame.word_wrap = True
        p = tb.text_frame.paragraphs[0]
        r = p.add_run()
        r.text = title
        r.font.size = Pt(title_size)
        r.font.bold = True
        r.font.color.rgb = BLACK
        # 본문
        tb2 = slide.shapes.add_textbox(inner_left, inner_top + Inches(0.35),
                                        inner_w, inner_h - Inches(0.35))
        tb2.text_frame.word_wrap = True
        p2 = tb2.text_frame.paragraphs[0]
        r2 = p2.add_run()
        r2.text = body
        r2.font.size = Pt(body_size)
        r2.font.color.rgb = GRAY_DK
    elif title:
        tb = slide.shapes.add_textbox(inner_left, inner_top, inner_w, inner_h)
        tb.text_frame.word_wrap = True
        p = tb.text_frame.paragraphs[0]
        r = p.add_run()
        r.text = title
        r.font.size = Pt(title_size)
        r.font.bold = True
        r.font.color.rgb = BLACK
    else:
        tb = slide.shapes.add_textbox(inner_left, inner_top, inner_w, inner_h)
        tb.text_frame.word_wrap = True
        p = tb.text_frame.paragraphs[0]
        r = p.add_run()
        r.text = body
        r.font.size = Pt(body_size)
        r.font.color.rgb = GRAY_DK


# ═══════════════════════════════════════════════════════
#  슬라이드 1: 표지
# ═══════════════════════════════════════════════════════
def slide_01_cover(prs):
    s = blank_slide(prs)

    # 상단 검정 띠
    rect = s.shapes.add_shape(1, Inches(0), Inches(0), W, Inches(2.0))
    rect.fill.solid()
    rect.fill.fore_color.rgb = BLACK
    rect.line.fill.background()

    add_textbox(s, ML, Inches(0.25), CW, Inches(0.55),
                "LLM 기반 컴퓨터과학 학습 질문 자동 생성 시스템",
                font_size=24, bold=True, color=WHITE)
    add_textbox(s, ML, Inches(0.85), CW, Inches(0.55),
                "검증 및 재생성 파이프라인 설계",
                font_size=20, bold=False, color=GRAY_MD)

    # 영문 제목
    add_textbox(s, ML, Inches(2.3), CW, Inches(0.6),
                "An LLM-based Automatic Question Generation System for Computer Science Learning",
                font_size=13, italic=True, color=GRAY_DK)

    # 구분선
    line = s.shapes.add_shape(1, ML, Inches(3.1), CW, Pt(1.5))
    line.fill.solid()
    line.fill.fore_color.rgb = GRAY_MD
    line.line.fill.background()

    # 저자 정보
    add_textbox(s, ML, Inches(3.3), CW, Inches(0.4),
                "강지훈", font_size=18, bold=True, color=BLACK)
    add_textbox(s, ML, Inches(3.75), CW, Inches(0.35),
                "지도교수: 박수헌", font_size=14, color=GRAY_DK)
    add_textbox(s, ML, Inches(4.15), CW, Inches(0.35),
                "2026년 6월", font_size=13, color=GRAY_DK)

    # 하단 학교명
    add_textbox(s, ML, H - Inches(0.6), CW, Inches(0.4),
                "졸업논문 발표", font_size=12, color=GRAY_MD)
    add_footer(s, 1)


# ═══════════════════════════════════════════════════════
#  슬라이드 2: 목차
# ═══════════════════════════════════════════════════════
def slide_02_toc(prs):
    s = blank_slide(prs)
    add_title(s, "목차")
    add_footer(s, 2)

    sections = [
        ("I",   "연구 배경 및 동기"),
        ("II",  "시스템 설계 (CSQuest 개요)"),
        ("III", "핵심 기여: 검증·재생성 파이프라인"),
        ("IV",  "실험 및 평가 결과"),
        ("V",   "결론 및 향후 연구"),
    ]

    top = CONTENT_TOP + Inches(0.1)
    item_h = Inches(0.85)
    for i, (num, title) in enumerate(sections):
        left = ML
        t = top + i * item_h

        num_rect = s.shapes.add_shape(1, left, t, Inches(0.5), Inches(0.65))
        num_rect.fill.solid()
        num_rect.fill.fore_color.rgb = BLACK
        num_rect.line.fill.background()
        tb = s.shapes.add_textbox(left, t, Inches(0.5), Inches(0.65))
        tb.text_frame.word_wrap = False
        p = tb.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = num
        r.font.size = Pt(14)
        r.font.bold = True
        r.font.color.rgb = WHITE

        add_textbox(s, left + Inches(0.65), t + Inches(0.12), CW - Inches(0.65), Inches(0.5),
                    title, font_size=18, bold=False, color=BLACK)


# ═══════════════════════════════════════════════════════
#  슬라이드 3: 연구 배경
# ═══════════════════════════════════════════════════════
def slide_03_background(prs):
    s = blank_slide(prs)
    add_title(s, "연구 배경 및 동기", "I. 연구 배경")
    add_footer(s, 3)

    # 왼쪽 문제점
    add_textbox(s, ML, CONTENT_TOP, Inches(5.5), Inches(0.35),
                "기존 CS 학습의 한계", font_size=16, bold=True)
    problems = [
        ("기존 교재·플랫폼의 문제는 정적이며 맞춤형 제공 어려움", 0),
        ("단순 프롬프팅으로 생성된 문제: 정답 오류·보기 중복·난이도 불일치", 0),
        ("한국어 CS 학습 환경에서 양질의 자료 부족", 0),
    ]
    add_bullet(s, ML, CONTENT_TOP + Inches(0.4), Inches(5.5), Inches(1.8),
               problems, font_size=15)

    # 오른쪽 동기
    rx = ML + Inches(6.0)
    add_textbox(s, rx, CONTENT_TOP, Inches(5.5), Inches(0.35),
                "LLM 활용 필요성", font_size=16, bold=True)
    motivations = [
        ("GPT·Claude 등 LLM: 개념과 난이도에 맞는 문제 즉시 생성 가능", 0),
        ("그러나 생성 품질 자동 검증 파이프라인이 부재", 0),
        ("개인 맞춤형 교육 → 집단 강의 대비 학습 성취도 2σ 향상 (Bloom, 1984)", 0),
    ]
    add_bullet(s, rx, CONTENT_TOP + Inches(0.4), Inches(5.5), Inches(1.8),
               motivations, font_size=15)

    # 구분선
    line = s.shapes.add_shape(1, ML + Inches(5.7), CONTENT_TOP, Pt(1.5), Inches(2.2))
    line.fill.solid()
    line.fill.fore_color.rgb = GRAY_MD
    line.line.fill.background()

    # 핵심 박스
    add_box(s, ML, CONTENT_TOP + Inches(2.4), CW, Inches(1.3),
            title="",
            body='본 연구: LLM 기반 한국어 CS 학습 앱 CSQuest 설계·구현\n'
                 '① 검증·재생성 파이프라인 (LLM-as-a-Judge + Self-Refine)\n'
                 '② AI 기반 개인화 복습 큐 + 게이미피케이션',
            body_size=15, bg=GRAY_LT)


# ═══════════════════════════════════════════════════════
#  슬라이드 4: 기존 연구와의 차별점
# ═══════════════════════════════════════════════════════
def slide_04_diff(prs):
    s = blank_slide(prs)
    add_title(s, "기존 연구와의 차별점", "I. 연구 배경")
    add_footer(s, 4)

    headers = ["구분", "기존 연구", "본 연구 (CSQuest)"]
    rows = [
        ["적용 맥락",    "오프라인 배치 평가 또는\n제약 없는 실험 환경", "실시간 웹 서비스 (Next.js)"],
        ["언어·도메인", "영어 중심 일반 도메인",    "한국어 CS 교육 특화"],
        ["재생성 제한",  "제한 없음 (비용/지연 문제)", "최대 3회 (UX 응답 지연 최소화)"],
        ["검증 모델",    "GPT-4 등 고비용 모델",    "Gemini Flash (속도·비용 최적화)"],
        ["개인화",       "없음",                    "오답 기반 복습 큐 + XP 게이미피케이션"],
    ]

    col_w = [Inches(2.1), Inches(4.5), Inches(5.0)]
    row_h = Inches(0.7)
    t_top = CONTENT_TOP + Inches(0.1)

    for ci, (header, cw) in enumerate(zip(headers, col_w)):
        left = ML + sum(col_w[:ci])
        rect = s.shapes.add_shape(1, left, t_top, cw, row_h)
        rect.fill.solid()
        rect.fill.fore_color.rgb = BLACK
        rect.line.color.rgb = WHITE
        rect.line.width = Pt(0.5)
        tb = s.shapes.add_textbox(left + Inches(0.1), t_top + Inches(0.15),
                                   cw - Inches(0.2), row_h - Inches(0.3))
        tb.text_frame.word_wrap = True
        p = tb.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = header
        r.font.size = Pt(14)
        r.font.bold = True
        r.font.color.rgb = WHITE

    for ri, row in enumerate(rows):
        row_top = t_top + row_h * (ri + 1)
        bg = GRAY_LT if ri % 2 == 0 else WHITE
        for ci, (cell, cw) in enumerate(zip(row, col_w)):
            left = ML + sum(col_w[:ci])
            rect = s.shapes.add_shape(1, left, row_top, cw, row_h)
            rect.fill.solid()
            rect.fill.fore_color.rgb = bg
            rect.line.color.rgb = GRAY_MD
            rect.line.width = Pt(0.5)
            fs = 13 if ci > 0 else 13
            bold = (ci == 0)
            tb = s.shapes.add_textbox(left + Inches(0.1), row_top + Inches(0.1),
                                       cw - Inches(0.2), row_h - Inches(0.2))
            tb.text_frame.word_wrap = True
            p = tb.text_frame.paragraphs[0]
            r = p.add_run()
            r.text = cell
            r.font.size = Pt(fs)
            r.font.bold = bold
            r.font.color.rgb = BLACK if ci != 2 else GRAY_BK


# ═══════════════════════════════════════════════════════
#  슬라이드 5: 시스템 개요
# ═══════════════════════════════════════════════════════
def slide_05_overview(prs):
    s = blank_slide(prs)
    add_title(s, "시스템 개요 — CSQuest", "II. 시스템 설계")
    add_footer(s, 5)

    layers = [
        ("프론트엔드",  "Next.js 14 (App Router)  ·  React  ·  Tailwind CSS  ·  shadcn/ui"),
        ("백엔드",      "Supabase (PostgreSQL · Row Level Security · OAuth 인증)"),
        ("AI 계층",     "Google Gemini API (gemini-flash-3.5)  —  문제 생성·검증·복습 큐 우선순위"),
    ]

    layer_h = Inches(1.05)
    for i, (name, desc) in enumerate(layers):
        top = CONTENT_TOP + Inches(0.1) + i * (layer_h + Inches(0.15))
        rect = s.shapes.add_shape(1, ML, top, CW, layer_h)
        rect.fill.solid()
        rect.fill.fore_color.rgb = GRAY_LT
        rect.line.color.rgb = GRAY_MD
        rect.line.width = Pt(1)

        add_textbox(s, ML + Inches(0.2), top + Inches(0.1),
                    Inches(1.6), Inches(0.4),
                    name, font_size=15, bold=True)
        add_textbox(s, ML + Inches(0.2), top + Inches(0.52),
                    CW - Inches(0.4), Inches(0.45),
                    desc, font_size=13, color=GRAY_DK)

    # 화살표 설명
    add_textbox(s, ML, CONTENT_TOP + Inches(3.6), CW, Inches(0.35),
                "모든 데이터: Supabase PostgreSQL  ·  인증: Supabase OAuth  ·  AI 응답 max_tokens=512",
                font_size=12, color=GRAY_DK)


# ═══════════════════════════════════════════════════════
#  슬라이드 6: 콘텐츠 구조
# ═══════════════════════════════════════════════════════
def slide_06_content(prs):
    s = blank_slide(prs)
    add_title(s, "콘텐츠 구조 및 문제 유형", "II. 시스템 설계")
    add_footer(s, 6)

    # 왼쪽 — 표
    add_textbox(s, ML, CONTENT_TOP, Inches(5.5), Inches(0.35),
                "구현된 콘텐츠 규모", font_size=15, bold=True)
    headers = ["과목", "챕터 수", "레슨 수", "문제 수"]
    rows2 = [
        ["자료구조", "3", "5", "13"],
        ["알고리즘", "2", "3", "6"],
        ["운영체제", "2", "2", "4"],
        ["네트워크", "2", "2", "4"],
        ["합계",     "9", "12", "27"],
    ]
    col_w2 = [Inches(2.0), Inches(1.0), Inches(1.0), Inches(1.0)]
    row_h2 = Inches(0.48)
    t_top2 = CONTENT_TOP + Inches(0.4)

    for ci, (h, cw) in enumerate(zip(headers, col_w2)):
        left = ML + sum(col_w2[:ci])
        rect = s.shapes.add_shape(1, left, t_top2, cw, row_h2)
        rect.fill.solid(); rect.fill.fore_color.rgb = BLACK
        rect.line.color.rgb = WHITE; rect.line.width = Pt(0.5)
        tb = s.shapes.add_textbox(left, t_top2 + Inches(0.08),
                                   cw, row_h2 - Inches(0.16))
        p = tb.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = h
        r.font.size = Pt(13); r.font.bold = True; r.font.color.rgb = WHITE

    for ri, row in enumerate(rows2):
        bg = GRAY_LT if ri % 2 == 0 else WHITE
        if ri == 4: bg = GRAY_MD
        row_top = t_top2 + row_h2 * (ri + 1)
        for ci, (cell, cw) in enumerate(zip(row, col_w2)):
            left = ML + sum(col_w2[:ci])
            rect = s.shapes.add_shape(1, left, row_top, cw, row_h2)
            rect.fill.solid(); rect.fill.fore_color.rgb = bg
            rect.line.color.rgb = GRAY_MD; rect.line.width = Pt(0.5)
            tb = s.shapes.add_textbox(left, row_top + Inches(0.08),
                                       cw, row_h2 - Inches(0.16))
            p = tb.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER if ci > 0 else PP_ALIGN.LEFT
            r = p.add_run(); r.text = ("  " if ci == 0 else "") + cell
            r.font.size = Pt(13)
            r.font.bold = (ri == 4)
            r.font.color.rgb = BLACK

    # 오른쪽 — 문제 유형
    rx = ML + Inches(5.8)
    add_textbox(s, rx, CONTENT_TOP, Inches(5.9), Inches(0.35),
                "문제 유형 3가지", font_size=15, bold=True)

    types = [
        ("빈칸 채우기 (fill_blank)", "개념어를 직접 입력\n예: '스택은 ___ 구조이다'", "41% (11문항)"),
        ("순서 배열 (drag_order)",  "항목을 올바른 순서로 정렬\n예: 프로세스 생성 단계 나열", "33% (9문항)"),
        ("논리 흐름 (logic_flow)",  "주어진 흐름에서 빈 단계의 보기 선택\n예: TCP 3-way handshake", "26% (7문항)"),
    ]
    for i, (name, desc, pct) in enumerate(types):
        top = CONTENT_TOP + Inches(0.4) + i * Inches(1.2)
        rect = s.shapes.add_shape(1, rx, top, Inches(5.9), Inches(1.1))
        rect.fill.solid(); rect.fill.fore_color.rgb = GRAY_LT
        rect.line.color.rgb = GRAY_MD; rect.line.width = Pt(0.75)
        add_textbox(s, rx + Inches(0.15), top + Inches(0.08),
                    Inches(4.2), Inches(0.35),
                    name, font_size=14, bold=True)
        add_textbox(s, rx + Inches(0.15), top + Inches(0.45),
                    Inches(4.0), Inches(0.55),
                    desc, font_size=12, color=GRAY_DK)
        add_textbox(s, rx + Inches(4.35), top + Inches(0.3),
                    Inches(1.4), Inches(0.4),
                    pct, font_size=13, bold=True,
                    color=BLACK, align=PP_ALIGN.RIGHT)


# ═══════════════════════════════════════════════════════
#  슬라이드 7: 검증·재생성 파이프라인
# ═══════════════════════════════════════════════════════
def slide_07_pipeline(prs):
    s = blank_slide(prs)
    add_title(s, "핵심 기여 ①  검증·재생성 파이프라인", "III. 핵심 기여")
    add_footer(s, 7)

    # 파이프라인 다이어그램 — 도형으로 직접 그림
    steps = [
        ("사용자\n입력",   Inches(0.7)),
        ("① 생성\n(Gemini)", Inches(2.3)),
        ("② 검증\n(LLM-Judge)", Inches(4.3)),
        ("③ 재생성\n(Self-Refine)", Inches(6.3)),
        ("④ 저장\n(DB)", Inches(9.2)),
    ]

    box_w = Inches(1.5)
    box_h = Inches(1.0)
    box_top = CONTENT_TOP + Inches(0.3)

    for label, left in steps:
        rect = s.shapes.add_shape(1, left, box_top, box_w, box_h)
        is_key = "검증" in label or "재생성" in label
        rect.fill.solid()
        rect.fill.fore_color.rgb = BLACK if is_key else GRAY_LT
        rect.line.color.rgb = GRAY_MD if not is_key else BLACK
        rect.line.width = Pt(1)
        tb = s.shapes.add_textbox(left, box_top, box_w, box_h)
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = label
        r.font.size = Pt(13)
        r.font.bold = is_key
        r.font.color.rgb = WHITE if is_key else BLACK

    # 화살표 (→)
    arrow_positions = [
        Inches(0.7) + box_w, Inches(2.3) + box_w,
        Inches(4.3) + box_w + Inches(0.05),
    ]
    for ax in arrow_positions:
        ar = s.shapes.add_textbox(ax, box_top + Inches(0.35), Inches(0.2), Inches(0.3))
        p = ar.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = "→"
        r.font.size = Pt(18); r.font.color.rgb = BLACK

    # 통과/실패 분기
    # 검증 박스 중앙
    judge_cx = Inches(4.3) + box_w / 2

    # 통과 → 저장
    add_textbox(s, Inches(6.0), box_top - Inches(0.05), Inches(1.0), Inches(0.3),
                "통과✓", font_size=11, color=GRAY_DK)

    # 실패 → 재생성 (아래 화살표)
    add_textbox(s, Inches(5.1), box_top + box_h + Inches(0.05),
                Inches(0.5), Inches(0.25), "실패↓", font_size=11, color=GRAY_DK)

    # 재생성 → 검증 루프
    add_textbox(s, Inches(5.6), box_top + box_h + Inches(0.05),
                Inches(2.0), Inches(0.25),
                "최대 3회 재시도", font_size=11, color=GRAY_DK)

    # 저장 화살표
    ar2 = s.shapes.add_textbox(Inches(9.2) - Inches(0.5), box_top + Inches(0.35),
                                 Inches(0.5), Inches(0.3))
    p = ar2.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = "→"
    r.font.size = Pt(18); r.font.color.rgb = BLACK

    # 핵심 포인트
    points = [
        ("단순 프롬프팅 대비 생성 품질 향상을 위해 Self-Refine 원칙 적용", 0),
        ("LLM-as-a-Judge: 동일 모델(Gemini)이 4가지 기준으로 자동 평가", 0),
        ("실패 사유(reasons)를 프롬프트에 반영 → 후속 생성 품질 개선", 0),
        ("3회 모두 실패 시 HTTP 422 반환 (클라이언트에 실패 사유 표시)", 0),
    ]
    add_bullet(s, ML, box_top + Inches(1.4), CW, Inches(1.8),
               points, font_size=14)


# ═══════════════════════════════════════════════════════
#  슬라이드 8: LLM-as-a-Judge 검증 모듈
# ═══════════════════════════════════════════════════════
def slide_08_judge(prs):
    s = blank_slide(prs)
    add_title(s, "LLM-as-a-Judge 검증 모듈", "III. 핵심 기여")
    add_footer(s, 8)

    add_textbox(s, ML, CONTENT_TOP, CW, Inches(0.35),
                "생성된 문제를 동일 모델(Gemini)에게 전달하여 4가지 기준을 자동 평가합니다",
                font_size=14, color=GRAY_DK)

    criteria = [
        ("① 정답 정확성",   "correct_answer가 문제에 대해 올바른가?",
         "오답 생성이 가장 빈번한 실패 원인 (약 18%)"),
        ("② 명확성",        "문제 지문이 모호하지 않은가?",
         "표현 모호성으로 인한 실패 약 12%"),
        ("③ 난이도 적합성", "사용자가 선택한 난이도 수준에 맞는가?",
         "초급/중급/고급 수준 일치 검증"),
        ("④ 보기 중복",     "options/items에 중복된 항목이 없는가?",
         "drag_order·logic_flow 유형에서 중요"),
    ]

    crit_h = Inches(1.05)
    for i, (name, check, note) in enumerate(criteria):
        left = ML + (i % 2) * (CW / 2 + Inches(0.1))
        top  = CONTENT_TOP + Inches(0.45) + (i // 2) * (crit_h + Inches(0.12))
        w    = CW / 2 - Inches(0.1)

        rect = s.shapes.add_shape(1, left, top, w, crit_h)
        rect.fill.solid(); rect.fill.fore_color.rgb = GRAY_LT
        rect.line.color.rgb = GRAY_MD; rect.line.width = Pt(1)
        add_textbox(s, left + Inches(0.15), top + Inches(0.08),
                    w - Inches(0.3), Inches(0.35),
                    name, font_size=14, bold=True)
        add_textbox(s, left + Inches(0.15), top + Inches(0.45),
                    w - Inches(0.3), Inches(0.55),
                    f"✓ {check}\n→ {note}", font_size=12, color=GRAY_DK)

    # 반환 형식
    add_box(s, ML, CONTENT_TOP + Inches(2.5), CW, Inches(0.6),
            body='검증 모듈 반환 형식:  {"passed": true/false,  "reasons": ["이유1", "이유2", ...]}',
            body_size=13, bg=GRAY_LT)


# ═══════════════════════════════════════════════════════
#  슬라이드 9: Self-Refine 재생성 모듈
# ═══════════════════════════════════════════════════════
def slide_09_refine(prs):
    s = blank_slide(prs)
    add_title(s, "Self-Refine 재생성 모듈", "III. 핵심 기여")
    add_footer(s, 9)

    add_textbox(s, ML, CONTENT_TOP, CW, Inches(0.35),
                "검증 실패 시 실패 사유를 프롬프트에 명시하여 재생성 (최대 3회)",
                font_size=14, color=GRAY_DK)

    # 왼쪽 — 프롬프트 전략 3가지
    add_textbox(s, ML, CONTENT_TOP + Inches(0.45), Inches(5.5), Inches(0.35),
                "프롬프트 엔지니어링 전략", font_size=15, bold=True)
    strategies = [
        ("역할 부여 (Persona)",
         '"한국어 컴퓨터과학 교육 문제 출제자" 페르소나 명시\n→ Hallucination 억제 + CS 도메인 특화'),
        ("구조화 출력",
         "문항 유형별 JSON 스키마 명시\n→ 파싱 가능한 일관된 출력 보장"),
        ("Self-Refine",
         "재생성 시 이전 검증 실패 사유 포함\n→ 후속 생성 품질 향상"),
    ]
    for i, (name, desc) in enumerate(strategies):
        top = CONTENT_TOP + Inches(0.85) + i * Inches(1.1)
        rect = s.shapes.add_shape(1, ML, top, Inches(5.5), Inches(1.0))
        rect.fill.solid(); rect.fill.fore_color.rgb = GRAY_LT
        rect.line.color.rgb = GRAY_MD; rect.line.width = Pt(0.75)
        add_textbox(s, ML + Inches(0.15), top + Inches(0.08),
                    Inches(5.2), Inches(0.35), name, font_size=13, bold=True)
        add_textbox(s, ML + Inches(0.15), top + Inches(0.45),
                    Inches(5.2), Inches(0.5), desc, font_size=12, color=GRAY_DK)

    # 오른쪽 — 재생성 루프 설명
    rx = ML + Inches(6.0)
    add_textbox(s, rx, CONTENT_TOP + Inches(0.45), Inches(5.5), Inches(0.35),
                "재생성 루프 동작", font_size=15, bold=True)

    loop_steps = [
        "1차 생성 → 검증 실패",
        "실패 사유 reasons 추출",
        "reasons를 프롬프트에 포함 → 2차 생성",
        "검증 통과 시 저장 / 실패 시 반복",
        "3회 모두 실패 → HTTP 422 반환",
    ]
    for i, step in enumerate(loop_steps):
        top = CONTENT_TOP + Inches(0.85) + i * Inches(0.58)
        num_rect = s.shapes.add_shape(1, rx, top, Inches(0.35), Inches(0.45))
        num_rect.fill.solid()
        num_rect.fill.fore_color.rgb = BLACK if i < 4 else GRAY_MD
        num_rect.line.fill.background()
        tb = s.shapes.add_textbox(rx, top, Inches(0.35), Inches(0.45))
        p = tb.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = str(i + 1)
        r.font.size = Pt(12); r.font.bold = True
        r.font.color.rgb = WHITE

        add_textbox(s, rx + Inches(0.45), top + Inches(0.05),
                    Inches(5.1), Inches(0.4),
                    step, font_size=13,
                    color=BLACK if i < 4 else GRAY_DK)

    add_textbox(s, rx, CONTENT_TOP + Inches(3.8), Inches(5.5), Inches(0.35),
                "※ CoT(Chain-of-Thought) 미사용 — 응답 속도 최적화 (max_tokens=512)",
                font_size=11, color=GRAY_DK, italic=True)


# ═══════════════════════════════════════════════════════
#  슬라이드 10: 평가 결과
# ═══════════════════════════════════════════════════════
def slide_10_results(prs):
    s = blank_slide(prs)
    add_title(s, "실험 및 평가 결과", "IV. 평가 결과")
    add_footer(s, 10)

    # 왼쪽 — 검증 파이프라인 표
    add_textbox(s, ML, CONTENT_TOP, Inches(5.5), Inches(0.35),
                "검증·재생성 파이프라인 시도 횟수별 통과율", font_size=15, bold=True)

    headers = ["시도 횟수", "검증 통과율", "응답 시간"]
    rows3 = [
        ["1회 시도", "약 65%",  "약 3~4초"],
        ["2회 시도", "약 88%",  "약 6~8초"],
        ["3회 시도", "약 95%",  "약 9~12초"],
    ]
    col_w3 = [Inches(1.8), Inches(1.8), Inches(1.8)]
    row_h3 = Inches(0.65)
    t_top3 = CONTENT_TOP + Inches(0.45)

    for ci, (h, cw) in enumerate(zip(headers, col_w3)):
        left = ML + sum(col_w3[:ci])
        rect = s.shapes.add_shape(1, left, t_top3, cw, row_h3)
        rect.fill.solid(); rect.fill.fore_color.rgb = BLACK
        rect.line.color.rgb = WHITE; rect.line.width = Pt(0.5)
        tb = s.shapes.add_textbox(left, t_top3 + Inches(0.12), cw, row_h3 - Inches(0.24))
        p = tb.text_frame.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = h
        r.font.size = Pt(13); r.font.bold = True; r.font.color.rgb = WHITE

    for ri, row in enumerate(rows3):
        bg = GRAY_LT if ri % 2 == 0 else WHITE
        row_top = t_top3 + row_h3 * (ri + 1)
        for ci, (cell, cw) in enumerate(zip(row, col_w3)):
            left = ML + sum(col_w3[:ci])
            rect = s.shapes.add_shape(1, left, row_top, cw, row_h3)
            rect.fill.solid(); rect.fill.fore_color.rgb = bg
            rect.line.color.rgb = GRAY_MD; rect.line.width = Pt(0.5)
            tb = s.shapes.add_textbox(left, row_top + Inches(0.12),
                                       cw, row_h3 - Inches(0.24))
            p = tb.text_frame.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
            r = p.add_run(); r.text = cell
            r.font.size = Pt(14 if ci == 1 else 13)
            r.font.bold = (ci == 1)
            r.font.color.rgb = BLACK

    # 실험 조건
    add_textbox(s, ML, t_top3 + row_h3 * 4 + Inches(0.1), Inches(5.5), Inches(0.35),
                "내부 테스트 240회 (각 주제·난이도 조합별 20회)",
                font_size=12, color=GRAY_DK, italic=True)

    # 실패 주요 원인
    add_textbox(s, ML, CONTENT_TOP + Inches(3.2), Inches(5.5), Inches(0.35),
                "검증 실패 주요 원인", font_size=14, bold=True)
    add_bullet(s, ML, CONTENT_TOP + Inches(3.6), Inches(5.5), Inches(0.8),
               [("난이도 적합성 불일치: 약 18%", 0),
                ("정답 표현 모호성: 약 12%", 0)], font_size=13)

    # 오른쪽 — AI 복습 큐
    rx = ML + Inches(6.2)
    add_textbox(s, rx, CONTENT_TOP, Inches(5.5), Inches(0.35),
                "AI 복습 큐 생성 성능", font_size=15, bold=True)

    perf_items = [
        ("분석 응답 시간",      "오답 20개 입력 기준\n평균 1.2~1.8초 (max_tokens=256)"),
        ("API 오류 대응",       "폴백 로직: 오답 횟수 내림차순\n상위 5개 자동 선정"),
        ("1회 시도 파이프라인", "생성+검증 평균 3~4초\n(max_tokens=512 조건)"),
    ]
    for i, (name, val) in enumerate(perf_items):
        top = CONTENT_TOP + Inches(0.45) + i * Inches(1.15)
        rect = s.shapes.add_shape(1, rx, top, Inches(5.5), Inches(1.05))
        rect.fill.solid(); rect.fill.fore_color.rgb = GRAY_LT
        rect.line.color.rgb = GRAY_MD; rect.line.width = Pt(0.75)
        add_textbox(s, rx + Inches(0.15), top + Inches(0.08),
                    Inches(5.2), Inches(0.35), name, font_size=13, bold=True)
        add_textbox(s, rx + Inches(0.15), top + Inches(0.45),
                    Inches(5.2), Inches(0.55), val, font_size=12, color=GRAY_DK)

    add_textbox(s, rx, CONTENT_TOP + Inches(3.9), Inches(5.5), Inches(0.35),
                "※ 외부 사용자 대상 공식 실험은 향후 과제",
                font_size=11, color=GRAY_DK, italic=True)


# ═══════════════════════════════════════════════════════
#  슬라이드 11: AI 복습 큐 + 게이미피케이션
# ═══════════════════════════════════════════════════════
def slide_11_gamification(prs):
    s = blank_slide(prs)
    add_title(s, "핵심 기여 ②  AI 복습 큐 + 게이미피케이션", "II. 시스템 설계")
    add_footer(s, 11)

    # 왼쪽 — 복습 큐 파이프라인
    add_textbox(s, ML, CONTENT_TOP, Inches(5.5), Inches(0.35),
                "AI 기반 개인화 복습 큐 생성 (4단계)", font_size=15, bold=True)
    queue_steps = [
        ("수집", "wrong_count ≥ 2인 문제 최대 20개 조회"),
        ("분석", "오답 목록 → Gemini에 전달 → 복습 우선순위(1~5) JSON 반환"),
        ("폴백", "API 오류 시 오답 횟수 내림차순 상위 5개 자동 선정"),
        ("저장", "review_queue에 upsert (중복 방지 — 기존 항목은 priority만 갱신)"),
    ]
    for i, (step, desc) in enumerate(queue_steps):
        top = CONTENT_TOP + Inches(0.45) + i * Inches(0.88)
        num_rect = s.shapes.add_shape(1, ML, top, Inches(0.45), Inches(0.7))
        num_rect.fill.solid(); num_rect.fill.fore_color.rgb = BLACK
        num_rect.line.fill.background()
        tb = s.shapes.add_textbox(ML, top, Inches(0.45), Inches(0.7))
        p = tb.text_frame.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = step
        r.font.size = Pt(11); r.font.bold = True; r.font.color.rgb = WHITE

        add_textbox(s, ML + Inches(0.55), top + Inches(0.12),
                    Inches(5.0), Inches(0.55), desc, font_size=13, color=BLACK)

    # 오른쪽 — 게이미피케이션
    rx = ML + Inches(6.2)
    add_textbox(s, rx, CONTENT_TOP, Inches(5.5), Inches(0.35),
                "게이미피케이션 요소", font_size=15, bold=True)

    gamify = [
        ("XP (경험치)",  "정답·레슨 완료 시 지급\n레벨업 임계치: 0→100→300→600→1000 XP"),
        ("하트 시스템",  "오답 시 하트 1개 소모\n5개 / 시간 경과 시 자동 회복"),
        ("스트릭",       "연속 학습일 카운트\n동기 유지 보조 메커니즘"),
        ("리그",         "실버·골드 등 리그 분류\n리더보드로 경쟁 요소 도입"),
    ]
    for i, (name, desc) in enumerate(gamify):
        top = CONTENT_TOP + Inches(0.45) + i * Inches(0.92)
        rect = s.shapes.add_shape(1, rx, top, Inches(5.5), Inches(0.82))
        rect.fill.solid(); rect.fill.fore_color.rgb = GRAY_LT
        rect.line.color.rgb = GRAY_MD; rect.line.width = Pt(0.75)
        add_textbox(s, rx + Inches(0.15), top + Inches(0.06),
                    Inches(5.2), Inches(0.3), name, font_size=13, bold=True)
        add_textbox(s, rx + Inches(0.15), top + Inches(0.38),
                    Inches(5.2), Inches(0.4), desc, font_size=12, color=GRAY_DK)


# ═══════════════════════════════════════════════════════
#  슬라이드 12: 시스템 데모
# ═══════════════════════════════════════════════════════
def slide_12_demo(prs):
    s = blank_slide(prs)
    add_title(s, "시스템 데모 — CSQuest 구현 화면", "IV. 평가 결과")
    add_footer(s, 12)

    screenshots = [
        ("/tmp/screenshot_dashboard.png", "대시보드\n(XP·하트·스트릭·오늘의 레슨)"),
        ("/tmp/ss_generate.png",          "AI 문제 생성\n(주제·난이도·문항 유형 선택)"),
        ("/tmp/screenshot_profile.png",   "프로필·리더보드\n(레벨·XP·리그 순위)"),
    ]

    img_w = Inches(3.8)
    img_h = Inches(3.6)
    gap   = Inches(0.25)
    total_w = img_w * 3 + gap * 2
    start_x = (W - total_w) / 2

    for i, (path, caption) in enumerate(screenshots):
        left = start_x + i * (img_w + gap)
        top  = CONTENT_TOP + Inches(0.05)
        if os.path.exists(path):
            s.shapes.add_picture(path, left, top, img_w, img_h)
        else:
            rect = s.shapes.add_shape(1, left, top, img_w, img_h)
            rect.fill.solid(); rect.fill.fore_color.rgb = GRAY_LT
            rect.line.color.rgb = GRAY_MD
            add_textbox(s, left, top + img_h / 2 - Inches(0.2), img_w, Inches(0.4),
                        "[스크린샷 없음]", font_size=12, color=GRAY_MD,
                        align=PP_ALIGN.CENTER)
        add_textbox(s, left, top + img_h + Inches(0.05),
                    img_w, Inches(0.5),
                    caption, font_size=12, color=GRAY_DK,
                    align=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════════
#  슬라이드 13: 결론 및 향후 연구
# ═══════════════════════════════════════════════════════
def slide_13_conclusion(prs):
    s = blank_slide(prs)
    add_title(s, "결론 및 향후 연구", "V. 결론")
    add_footer(s, 13)

    # 왼쪽 — 연구 기여
    add_textbox(s, ML, CONTENT_TOP, Inches(5.5), Inches(0.35),
                "연구 기여 요약", font_size=15, bold=True)
    contrib = [
        ("검증·재생성 파이프라인", 0),
        ("LLM-as-a-Judge + Self-Refine 결합", 1),
        ("단순 프롬프팅 대비 통과율 65% → 95% 향상", 1),
        ("최대 3회 제한으로 실시간 UX 보장", 1),
        ("AI 기반 개인화 복습 큐", 0),
        ("오답 기반 자동 복습 우선순위 생성", 1),
        ("XP·레벨·하트·스트릭·리그 게이미피케이션", 1),
    ]
    add_bullet(s, ML, CONTENT_TOP + Inches(0.45), Inches(5.5), Inches(2.8),
               contrib, font_size=14)

    # 오른쪽 — 향후 연구
    rx = ML + Inches(6.2)
    add_textbox(s, rx, CONTENT_TOP, Inches(5.5), Inches(0.35),
                "향후 연구 과제", font_size=15, bold=True)
    future = [
        ("A/B 비교 실험 (검증 루프 적용 전후 정답 확도)", 0),
        ("사용자 만족도 정량 평가", 0),
        ("RAG 기반 사실성 강화", 0),
        ("코드 작성형 문항 추가", 0),
        ("문제 콘텐츠 확대 (데이터베이스·자료구조 심화 등)", 0),
    ]
    add_bullet(s, rx, CONTENT_TOP + Inches(0.45), Inches(5.5), Inches(2.8),
               future, font_size=14)

    # 한계
    add_box(s, ML, CONTENT_TOP + Inches(3.3), CW, Inches(0.75),
            body="한계: ① 콘텐츠 27문항으로 CS 커리큘럼 전체 커버 미흡  "
                 "② 검증 평가는 내부 테스트(240회)에 의존  "
                 "③ 최대 9~12초 응답 지연 → 향후 Pre-generation 아키텍처 도입 필요",
            body_size=13, bg=GRAY_LT)


# ═══════════════════════════════════════════════════════
#  메인
# ═══════════════════════════════════════════════════════
def main():
    prs = new_prs()

    slide_01_cover(prs)
    slide_02_toc(prs)
    slide_03_background(prs)
    slide_04_diff(prs)
    slide_05_overview(prs)
    slide_06_content(prs)
    slide_07_pipeline(prs)
    slide_08_judge(prs)
    slide_09_refine(prs)
    slide_10_results(prs)
    slide_11_gamification(prs)
    slide_12_demo(prs)
    slide_13_conclusion(prs)

    out = "/home/dakori/github/csringo/docs/csquest_presentation.pptx"
    prs.save(out)
    print(f"✓ 저장 완료: {out}")
    print(f"  슬라이드 수: {len(prs.slides)}")


if __name__ == "__main__":
    main()
