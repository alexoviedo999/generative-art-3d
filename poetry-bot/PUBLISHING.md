# Publishing Guide 📚

How to convert your Markdown poem files into a printed book.

## Option 1: Blurb BookWright (Easiest)

### Step 1: Download Poems
1. Go to your Google Drive folder
2. Download all `.md` files to your computer

### Step 2: Open BookWright
1. Download from https://www.blurb.com/bookwright
2. Create a new project: "Trade Book" → "6×9" (recommended for poetry)
3. Choose paper type: "Premium Matte" or "ProLine Uncoated"

### Step 3: Import Poems
1. Click "Add Text"
2. Copy the content of each `.md` file (below the `---` line)
3. Paste into BookWright
4. Format: Centered, with generous line spacing

### Step 4: Organize
- One poem per page (or start new page for longer poems)
- Add page numbers
- Create title page with your name
- Add table of contents

### Step 5: Create Cover
Use BookWright's cover tool or Canva:
- 6×9" size
- Front: Title, your name, simple graphic
- Spine: Book title
- Back: Brief description or poem excerpt

### Step 6: Order
1. Order proof copy first ($15-25)
2. Review for errors
3. Order full batch (10-50 copies)

---

## Option 2: Pandoc to PDF (Developer-Friendly)

### Step 1: Install Pandoc
```bash
# Ubuntu/Debian
sudo apt install pandoc texlive-xetex

# macOS
brew install pandoc

# Windows
# Download from https://pandoc.org/installing.html
```

### Step 2: Create Template
Create `book-template.tex`:

```latex
\documentclass[12pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{fontspec}
\setmainfont{Garamond}
\usepackage{fancyhdr}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[C]{\leftmark}
\fancyfoot[C]{\thepage}

\begin{document}

\begin{center}
{\Large\bfseries {{ title }}}
\end{center}

\vspace{1cm}

{{ content }}

\end{document}
```

### Step 3: Convert Single Poem
```bash
pandoc poem.md -o poem.pdf \
  --template book-template.tex \
  -f markdown
```

### Step 4: Combine All Poems
```bash
# Create book.md with all poems
cat lib1/*.md lib2/*.md > book.md

# Convert to PDF
pandoc book.md -o poetry-book.pdf \
  --pdf-engine=xelatex \
  -V geometry:margin=1in \
  -V fontsize=12pt \
  -V papersize:6x9in
```

---

## Option 3: Microsoft Word

### Step 1: Download & Convert
1. Download `.md` files
2. Open each in a text editor
3. Copy content (below the `---` line)
4. Paste into Word

### Step 2: Format in Word
- File → Page Setup → 6×9" custom size
- Margins: 1" all around
- Font: Garamond, 12pt
- Paragraph: Line spacing 1.5, centered
- Page breaks between poems

### Step 3: Add Metadata
From YAML frontmatter:
- **title** → Use as poem title
- **book** → For organization/reference
- **date** → Optional, for your records

### Step 4: Export PDF
File → Save As → PDF (best for print)

---

## Using the Metadata

The YAML frontmatter is useful for organization:

```yaml
---
title: "Título del Poema"  ← Use for poem title
book: "Libro 1"           ← Original notebook
date: "2026-02-01"         ← Digitized date
language: "es"              ← Language
image_file: "...jpg"         ← Original image
---
```

### Script to Extract Metadata

If you want to process all poems programmatically:

```bash
# Extract all titles
for file in *.md; do
  grep '^title:' "$file" | sed 's/title: "//; s/"//g'
done
```

---

## Quick Reference: Markdown Syntax

```markdown
# Heading 1 (not used in poem body)
**Bold text**
*Italic text*
`Code`

Empty line = paragraph break

Two blank lines = stanza break
```

---

## Common Issues & Solutions

### Issue: Lines too long for page width
**Solution:** Adjust margins or reduce font size

### Issue: Poems spanning multiple pages
**Solution:** Use "Keep with next paragraph" or manual page breaks

### Issue: Title page needed
**Solution:** Create separate `title.md` file or add to template

### Issue: Chapter-like organization
**Solution:** Group poems by `book:` metadata into sections

---

## Next Steps

1. ✅ Choose a publishing option (Blurb, Pandoc, or Word)
2. ✅ Download your `.md` files from Google Drive
3. ✅ Format according to chosen method
4. ✅ Order proof copy (for Blurb) or print sample
5. ✅ Adjust based on proof
6. ✅ Order full batch (10-50 copies)

---

Questions? Check the main README or review conversation notes on printing services!
