from pathlib import Path
import shutil

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output' / 'pdf' / 'signal-dossier-reinforcement-sample.pdf'
PUBLIC = ROOT / 'public' / 'samples' / 'signal-dossier-reinforcement-sample.pdf'

INK = HexColor('#08090A')
PANEL = HexColor('#0E1014')
LINE = HexColor('#282B32')
CREAM = HexColor('#E8E4DC')
MUTED = HexColor('#8C8880')
RED = HexColor('#C44040')
SOFT_RED = HexColor('#D06A62')
GREEN = HexColor('#91AA91')

FONT_DIR = Path('/usr/share/fonts/truetype/dejavu')
pdfmetrics.registerFont(TTFont('SignalSans', FONT_DIR / 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('SignalSansBold', FONT_DIR / 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SignalSerifItalic', FONT_DIR / 'DejaVuSerif-Italic.ttf'))
pdfmetrics.registerFont(TTFont('SignalMono', FONT_DIR / 'DejaVuSansMono.ttf'))


def style(name, font, size, color=CREAM, leading=None, **kwargs):
    return ParagraphStyle(
        name,
        fontName=font,
        fontSize=size,
        leading=leading or size * 1.35,
        textColor=color,
        alignment=TA_LEFT,
        spaceAfter=0,
        **kwargs,
    )


EYEBROW = style('Eyebrow', 'SignalMono', 7.5, SOFT_RED, 10, tracking=1.5)
TITLE = style('Title', 'SignalSerifItalic', 29, CREAM, 31)
SUBTITLE = style('Subtitle', 'SignalSans', 9, MUTED, 14)
H1 = style('H1', 'SignalSansBold', 14, CREAM, 18)
H2 = style('H2', 'SignalMono', 7.5, SOFT_RED, 10, tracking=1.3)
BODY = style('Body', 'SignalSans', 9, HexColor('#C3BFB7'), 14)
SMALL = style('Small', 'SignalSans', 7.5, MUTED, 11)
MONO = style('Mono', 'SignalMono', 7.5, HexColor('#B8B3A9'), 11)
LINK = style('Link', 'SignalSans', 7.1, HexColor('#AFAAA1'), 10)


def page_decor(canvas, doc):
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setStrokeColor(RED)
    canvas.setLineWidth(0.7)
    canvas.line(18 * mm, height - 16 * mm, 31 * mm, height - 16 * mm)
    canvas.setFont('SignalSansBold', 8)
    canvas.setFillColor(CREAM)
    canvas.drawString(34 * mm, height - 18.2 * mm, 'SIGNAL / DOSSIER')
    canvas.setFont('SignalMono', 6.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(width - 18 * mm, height - 18.2 * mm, 'SAMPLE / 2026-08-24')
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFont('SignalMono', 6.5)
    canvas.drawString(18 * mm, 9.5 * mm, 'HUMAN-REVIEWED RESEARCH SAMPLE')
    canvas.drawRightString(width - 18 * mm, 9.5 * mm, f'{doc.page}')
    canvas.restoreState()


def label(text, color=RED):
    return Table(
        [[Paragraph(text.upper(), style('Label', 'SignalMono', 6.8, CREAM, 9, tracking=1.0))]],
        style=[
            ('BACKGROUND', (0, 0), (-1, -1), color),
            ('BOX', (0, 0), (-1, -1), 0.6, color),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ],
        hAlign='LEFT',
    )


def fact_row(kind, title, text):
    colors = {'VERIFIED': GREEN, 'INFERENCE': SOFT_RED, 'UNKNOWN': HexColor('#A9905B')}
    tag = Paragraph(kind, style(f'{kind}Tag', 'SignalMono', 6.5, colors[kind], 9, tracking=0.8))
    copy = Paragraph(f'<b>{title}</b><br/>{text}', BODY)
    table = Table([[tag, copy]], colWidths=[24 * mm, 132 * mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PANEL),
        ('BOX', (0, 0), (-1, -1), 0.55, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    return table


def case_box(title, items, accent):
    rows = [[Paragraph(title.upper(), H2)]]
    for item in items:
        rows.append([Paragraph(f'<font color="{accent.hexval()}">■</font>&nbsp;&nbsp;{item}', BODY)])
    table = Table(rows, colWidths=[75 * mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PANEL),
        ('BOX', (0, 0), (-1, -1), 0.6, LINE),
        ('LINEABOVE', (0, 0), (-1, 0), 1.2, accent),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    return table


def build_story():
    story = []
    story += [Spacer(1, 5 * mm), Paragraph('SAMPLE RESEARCH BRIEF', EYEBROW), Spacer(1, 5 * mm)]
    story += [Paragraph('Reinforcement of the Army', TITLE), Spacer(1, 2 * mm)]
    story += [Paragraph('L26D-ENS08 / STARLIGHT RARE / LEGENDARY MODERN DECKS 2026', MONO), Spacer(1, 6 * mm)]
    story += [label('Exact price not established'), Spacer(1, 8 * mm)]
    story += [Paragraph('Executive finding', H1), Spacer(1, 3 * mm)]
    story += [Paragraph(
        'This is a bonus-slot Starlight upgrade tied to one of six possible bonus cards in its Deck, '
        'not an ordinary booster pull. The release mechanism is verified. The upgrade odds and a '
        'trustworthy exact-print market price are not published.', BODY
    ), Spacer(1, 7 * mm)]
    story += [fact_row('VERIFIED', 'Exact identity',
        'The official card database lists Reinforcement of the Army as L26D-ENS08, Starlight Rare, '
        'inside the Legendary Modern Decks 2026 bonus-card group.'), Spacer(1, 3 * mm)]
    story += [fact_row('VERIFIED', 'Release mechanism',
        'Konami says each of the three 55-card Decks includes a bonus 56th card: one of six cards '
        'from that Deck, normally Secret Rare, with a chance to upgrade to Starlight Rare.'), Spacer(1, 3 * mm)]
    story += [fact_row('UNKNOWN', 'Two decision-grade gaps',
        'Konami does not publish the Starlight upgrade odds. The structured set-price source does '
        'not establish an exact market price for this printing.'), Spacer(1, 8 * mm)]
    story += [Paragraph('Research scope', H2), Spacer(1, 2 * mm)]
    story += [Paragraph(
        'This sample verifies the object and its release story. A personal retain, reallocate, or '
        'revisit lean also requires the owner\'s condition, cost basis, time horizon, and named alternative.', SMALL
    ), PageBreak()]

    story += [Paragraph('Research file', EYEBROW), Spacer(1, 4 * mm)]
    story += [Paragraph('What the exact object tells us', H1), Spacer(1, 4 * mm)]
    story += [fact_row('VERIFIED', 'Game role',
        'The official database lists the card as Limited. Its effect searches a Level 4 or lower '
        'Warrior from the Deck, explaining its long-running utility across Warrior strategies.'), Spacer(1, 3 * mm)]
    story += [fact_row('VERIFIED', 'A second premium printing exists',
        'The official database also lists a later RA05-EN113 Starlight Rare printing. The Starlight '
        'label alone does not make the L26D copy unique; release method and artwork still matter.'), Spacer(1, 3 * mm)]
    story += [fact_row('INFERENCE', 'Scarcity quality',
        'The bonus-slot upgrade creates a stronger collector story than a standard rarity label. '
        'Its true scarcity cannot be quantified until upgrade odds, population data, or sustained exact sales appear.'), Spacer(1, 3 * mm)]
    story += [fact_row('INFERENCE', 'Attention path',
        'The most credible breakout path is collector discovery: a recognizable staple, alternate '
        'art, and an unusual premium release. This is one input, not the whole decision.'), Spacer(1, 8 * mm)]
    story += [Paragraph('Research conclusion', H2), Spacer(1, 2 * mm)]
    story += [Paragraph(
        'Treat L26D-ENS08 as its own object. Do not substitute the ordinary card\'s price, another '
        'Starlight printing, or a broad card-name average.', BODY
    ), PageBreak()]

    story += [Paragraph('Decision frame', EYEBROW), Spacer(1, 4 * mm)]
    story += [Paragraph('What supports each side', H1), Spacer(1, 5 * mm)]
    two_cases = Table([[
        case_box('Retain case', [
            'Verified bonus-slot Starlight release.',
            'Exact alternate-art identity is recoverable.',
            'Recognizable staple with durable game history.',
        ], GREEN),
        case_box('Reallocate case', [
            'Exact completed-sale evidence is missing.',
            'Upgrade odds are unpublished.',
            'Another Starlight printing now exists.',
        ], RED),
    ]], colWidths=[79 * mm, 79 * mm], hAlign='LEFT')
    two_cases.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 4)]))
    story += [two_cases, Spacer(1, 7 * mm)]
    story += [label('Research lean: revisit after exact sale or population evidence', HexColor('#49352A')), Spacer(1, 7 * mm)]
    story += [Paragraph('What would change the lean', H2), Spacer(1, 2 * mm)]
    story += [Paragraph(
        'A verified exact sale, a reliable grading-population count tied to L26D-ENS08, or published '
        'upgrade odds would materially improve the decision. Broad Reinforcement prices do not.', BODY
    ), Spacer(1, 8 * mm)]
    story += [Paragraph('Sources and receipts', H1), Spacer(1, 3 * mm)]
    sources = [
        ('1. Konami product record', 'https://www.yugioh-card.com/en/products/l26d/'),
        ('2. Official Yu-Gi-Oh! card database', 'https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=5328&ope=2'),
        ('3. YGOPRODeck API guide', 'https://ygoprodeck.com/api-guide/'),
        ('4. Exact set-code endpoint', 'https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=L26D-ENS08'),
    ]
    for title, url in sources:
        safe_url = url.replace('&', '&amp;')
        story += [Paragraph(f'<b>{title}</b><br/><link href="{safe_url}" color="#AFAAA1">{safe_url}</link>', LINK), Spacer(1, 2.5 * mm)]
    story += [Spacer(1, 3 * mm), Paragraph(
        'Method: official product and card records first, structured databases second, exact market '
        'evidence third. Missing facts remain missing. This sample is research, not an appraisal.', SMALL
    )]
    return story


def generate():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=26 * mm,
        bottomMargin=21 * mm,
        title='Signal Dossier Sample - Reinforcement of the Army',
        author='Signal',
        subject='Human-reviewed trading card research sample',
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='body')
    doc.addPageTemplates(PageTemplate(id='signal', frames=[frame], onPage=page_decor))
    doc.build(build_story())
    shutil.copy2(OUTPUT, PUBLIC)
    print(OUTPUT)
    print(PUBLIC)


if __name__ == '__main__':
    generate()
