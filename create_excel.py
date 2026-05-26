"""Create data.xlsx — the AI Board data source.

Sheet layout:
  Business Units  — who owns which platform
  Platforms       — the three platforms with their colors
  Technologies    — the six technologies with category grouping
  Initiatives     — one row per initiative (technologies as comma-list of names)
  Milestones      — child rows of initiatives (date + label anchor points)

Run this script whenever you want to regenerate a clean data.xlsx from scratch.
"""

import openpyxl
from openpyxl.styles import (
    Font, PatternFill, Alignment, Border, Side, GradientFill
)
from openpyxl.utils import get_column_letter
from openpyxl.styles.numbers import FORMAT_TEXT

# ── Palette ──────────────────────────────────────────────────────────────────
HDR_BG   = "1E2A3A"   # dark slate
HDR_FG   = "FFFFFF"
ROW_ALT  = "F8F9FA"   # very light gray alternate rows
ROW_NORM = "FFFFFF"
ACCENT   = "3B82F6"   # blue for section separators
BORDER   = "D1D5DB"

thin  = Side(border_style="thin",   color=BORDER)
med   = Side(border_style="medium", color="9CA3AF")
none_ = Side(border_style=None)

def hdr_fill():
    return PatternFill(fill_type="solid", fgColor=HDR_BG)

def alt_fill(i):
    return PatternFill(fill_type="solid", fgColor=ROW_ALT if i % 2 == 0 else ROW_NORM)

def cell_border(top=thin, bottom=thin, left=thin, right=thin):
    return Border(top=top, bottom=bottom, left=left, right=right)

def setup_sheet(ws, headers, col_widths, tab_color=None):
    """Write the header row and configure column widths."""
    if tab_color:
        ws.sheet_properties.tabColor = tab_color

    for col, (header, width) in enumerate(zip(headers, col_widths), 1):
        c = ws.cell(row=1, column=col, value=header)
        c.font      = Font(bold=True, color=HDR_FG, name="Calibri", size=11)
        c.fill      = hdr_fill()
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=False)
        c.border    = cell_border(top=med, bottom=med,
                                  left=med if col == 1 else thin,
                                  right=med if col == len(headers) else thin)
        ws.column_dimensions[get_column_letter(col)].width = width

    ws.row_dimensions[1].height = 24
    ws.freeze_panes = "A2"   # freeze header row


def write_rows(ws, data_rows, n_cols, text_cols=None):
    """Append data rows with alternating fill + borders."""
    text_cols = set(text_cols or [])
    for ri, row in enumerate(data_rows, 2):
        fill = alt_fill(ri)
        for ci, val in enumerate(row, 1):
            c = ws.cell(row=ri, column=ci, value=val)
            c.fill      = fill
            c.alignment = Alignment(vertical="center", wrap_text=(ci in text_cols))
            c.border    = cell_border(
                left=med if ci == 1 else thin,
                right=med if ci == n_cols else thin,
            )
            if ci in text_cols:
                c.number_format = FORMAT_TEXT
        ws.row_dimensions[ri].height = 18

    # Bottom border on last row
    last = len(data_rows) + 1
    for ci in range(1, n_cols + 1):
        c = ws.cell(row=last, column=ci)
        c.border = cell_border(
            bottom=med,
            left=med if ci == 1 else thin,
            right=med if ci == n_cols else thin,
        )


# ── Workbook ─────────────────────────────────────────────────────────────────
wb = openpyxl.Workbook()
wb.remove(wb.active)   # remove default blank sheet

# ── Sheet 1: Business Units ───────────────────────────────────────────────────
ws_bu = wb.create_sheet("Business Units")
bu_headers = ["ID", "Name", "Short", "Accent Color", "Lead"]
bu_widths  = [12,   24,     8,       30,              20   ]
setup_sheet(ws_bu, bu_headers, bu_widths, tab_color="7C3AED")

bu_rows = [
    ["mkt", "Marketing",           "MK", "oklch(0.45 0.08 290)", "Anne Berg"   ],
    ["cxo", "Customer Operations", "CO", "oklch(0.45 0.08 165)", "Mads Iversen"],
]
write_rows(ws_bu, bu_rows, len(bu_headers), text_cols={4})

# ── Sheet 2: Platforms ────────────────────────────────────────────────────────
ws_pl = wb.create_sheet("Platforms")
pl_headers = ["ID",     "Name",    "Business Unit ID", "Accent Color",          "Tint Color"          ]
pl_widths  = [12,       14,        20,                  30,                      30                    ]
setup_sheet(ws_pl, pl_headers, pl_widths, tab_color="2563EB")

pl_rows = [
    ["adobe",   "Adobe",   "mkt", "oklch(0.62 0.14 25)",  "oklch(0.97 0.02 25)" ],
    ["cognigy", "Cognigy", "cxo", "oklch(0.55 0.13 250)", "oklch(0.97 0.02 250)"],
    ["genesys", "Genesys", "cxo", "oklch(0.62 0.13 60)",  "oklch(0.97 0.02 60)" ],
]
write_rows(ws_pl, pl_rows, len(pl_headers), text_cols={4, 5})

# ── Sheet 3: Technologies ─────────────────────────────────────────────────────
ws_te = wb.create_sheet("Technologies")
te_headers = ["ID",         "Name",              "Category"     ]
te_widths  = [16,           22,                  18             ]
setup_sheet(ws_te, te_headers, te_widths, tab_color="059669")

te_rows = [
    ["t_stt",     "speechToText",     "Speech"      ],
    ["t_whisper", "Whisper",          "Speech"      ],
    ["t_xcript",  "AutoTranscript",   "Speech"      ],
    ["t_aa",      "Agent Assist",     "Agent tooling"],
    ["t_auto",    "Agent automation", "Agent tooling"],
    ["t_aiadd",   "AIADDAssistant",   "Assistant"   ],
]
write_rows(ws_te, te_rows, len(te_headers))

# ── Sheet 4: Initiatives ──────────────────────────────────────────────────────
ws_in = wb.create_sheet("Initiatives")
in_headers = [
    "ID", "Platform ID", "Name", "Status", "Owner",
    "Start Date", "End Date", "Description", "Tags",
    "Technologies",
]
in_widths = [12, 14, 40, 10, 18, 14, 14, 52, 22, 50]
setup_sheet(ws_in, in_headers, in_widths, tab_color="D97706")

# Technologies column lists technology names (comma-separated) for readability.
# The app resolves them to IDs via the Technologies sheet.
in_rows = [
    ["i_camp",  "adobe",   "Personalised campaign generation",  "poc",   "Marketing",
     "2026-03-01", "2026-09-30",
     "Generate variant copy + creative per segment.",
     "B2C, EU",
     "AIADDAssistant"],

    ["i_tag",   "adobe",   "Asset auto-tagging",               "live",  "DAM team",
     "2025-11-01", "2026-12-31",
     "Classify and tag the stock library.",
     "Content ops",
     "AIADDAssistant, AutoTranscript"],

    ["i_brief", "adobe",   "Creative brief assistant",          "idea",  "Brand studio",
     "2026-09-01", "2027-02-28",
     "Turn brand book + brief into starter creative.",
     "Internal",
     "AIADDAssistant"],

    ["i_it",    "cognigy", "IT helpdesk bot",                   "live",  "IT",
     "2025-09-01", "2026-12-31",
     "Tier-0 IT support across Slack + portal.",
     "Internal",
     "Agent Assist, Agent automation, AIADDAssistant"],

    ["i_voice", "cognigy", "Customer voicebot",                 "pilot", "Customer Care",
     "2026-02-01", "2026-11-30",
     "Voice-first front door for service line.",
     "B2C, 24/7",
     "speechToText, Whisper, Agent automation, Agent Assist"],

    ["i_sales", "cognigy", "Sales co-pilot",                    "idea",  "Sales Ops",
     "2026-08-01", "2027-01-31",
     "Suggest next-best-action mid-call.",
     "Internal",
     "AIADDAssistant, Agent Assist"],

    ["i_route", "genesys", "Predictive routing",                "poc",   "Contact Centre",
     "2026-04-01", "2026-12-31",
     "Match calls to best-fit agents.",
     "Optimisation",
     "Agent automation, Agent Assist"],

    ["i_sum",   "genesys", "Call summarisation",                "live",  "Contact Centre",
     "2025-12-01", "2026-12-31",
     "Auto-summarise calls into CRM.",
     "Productivity",
     "speechToText, AutoTranscript, Whisper"],

    ["i_qa",    "genesys", "Agent-assist QA",                   "pilot", "Quality",
     "2026-03-01", "2026-10-31",
     "Score 100% of interactions vs. rubrics.",
     "Compliance",
     "AutoTranscript, Agent Assist, speechToText"],
]
# Store date columns as text so Excel doesn't reformat them
write_rows(ws_in, in_rows, len(in_headers), text_cols={6, 7, 8, 9, 10})

# Add a note row explaining the Technologies column
note_row = ws_in.max_row + 2
ws_in.cell(note_row, 1, "ℹ️  Technologies").font = Font(italic=True, color="6B7280", size=10)
ws_in.merge_cells(start_row=note_row, start_column=1, end_row=note_row, end_column=10)
ws_in.cell(note_row, 1).value = (
    "ℹ️  Technologies: comma-separated technology names from the Technologies sheet. "
    "Status: idea | poc | pilot | live"
)
ws_in.cell(note_row, 1).font = Font(italic=True, color="6B7280", size=9)

# ── Sheet 5: Milestones ───────────────────────────────────────────────────────
ws_mi = wb.create_sheet("Milestones")
mi_headers = ["Initiative ID", "Date",       "Label"        ]
mi_widths  = [18,              16,            30             ]
setup_sheet(ws_mi, mi_headers, mi_widths, tab_color="DC2626")

mi_rows = [
    ["i_camp",  "2026-06-15", "Pilot kickoff" ],
    ["i_tag",   "2026-04-10", "Go-live"       ],
    ["i_it",    "2026-02-01", "Go-live"       ],
    ["i_it",    "2026-08-15", "EN+DK rollout" ],
    ["i_voice", "2026-07-01", "Pilot live"    ],
    ["i_route", "2026-10-15", "POC review"    ],
    ["i_sum",   "2026-03-20", "Go-live"       ],
    ["i_qa",    "2026-06-01", "Pilot live"    ],
]
write_rows(ws_mi, mi_rows, len(mi_headers), text_cols={2})

# ── Save ──────────────────────────────────────────────────────────────────────
out = "data.xlsx"
wb.save(out)
print(f"Saved {out}")
print(f"  Sheets: {', '.join(wb.sheetnames)}")
