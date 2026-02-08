# Poetry Digitization Bot 📝

A Telegram bot that digitizes handwritten Spanish poems from notebooks.

## What It Does

1. 📸 You send a photo of a handwritten poem to bot
2. 📚 The bot identifies which notebook it's from (from caption like "libro 1")
3. ☁️ Uploads the photo to Google Drive (organized by notebook)
4. 🤖 Uses **GPT-4 Vision** to convert handwriting to text (Spanish optimized)
5. 💾 Saves the poem as **Markdown with YAML frontmatter** — ready for publishing!

## File Format: Markdown with YAML Frontmatter

Each poem is saved as a `.md` file with structured metadata:

```yaml
---
title: "Título del Poema"
book: "Libro 1"
date: "2026-02-01"
language: "es"
image_file: "Título del Poema.jpg"
---

Tu texto del poema aquí
con líneas correctamente
espaciadas
```

This format is:
- ✅ Human-readable
- ✅ Ready for publishing (PDF, EPUB, DOCX)
- ✅ Version control friendly
- ✅ Compatible with static site generators

## File Organization on Google Drive

```
📁 Poetry Archive/
  📁 Libro 1/
    📄 titulo_del_poema.md
    🖼️ titulo_del_poema.jpg
  📁 Libro 2/
    📄 otro_poema.md
    🖼️ otro_poema.jpg
  ...
```

## How to Use

1. Start bot: `/start`
2. Take a photo of a handwritten poem
3. Send it with the notebook number in the caption:
   - `libro 1` — for notebook 1
   - `libro 3` — for notebook 3
   - `libro 10` — for notebook 10
4. Wait for bot to process it
5. Check your Google Drive folder

## Commands

- `/start` — Get started with the bot
- `/help` — Show help information

## Publishing Your Poems

The Markdown format makes it easy to publish:

### Quick Print (Blurb)
1. Download `.md` files from Google Drive
2. Use [Blurb BookWright](https://www.blurb.com/bookwright)
3. Drag-and-drop poems into a book layout
4. Order small batches (10-50 copies)

### Professional Output (LaTeX)
1. Download `.md` files
2. Use Pandoc to convert to LaTeX/PDF:
   ```bash
   pandoc poemas.md -o book.pdf
   ```

### For More Publishing Options
See the conversation notes on print-on-demand services like Blurb, Lulu, and Mixam.

## Setup

See `SETUP.md` for complete setup instructions.

## Migrating Old Files

If you have old `.txt` files, convert them to `.md`:

```bash
node convert-to-markdown.js
```

This will:
- Add YAML frontmatter with metadata
- Change extension to `.md`
- Delete old `.txt` files

## Tech Stack

- **Telegram Bot API** — Receive photos and send updates
- **Google Drive API** — Store photos and text files
- **GPT-4 Vision** — Handwriting-to-text (Spanish optimized)
- **Sharp** — Image preprocessing for better OCR
- **Node.js** — Bot runtime

---

Built with 🖋️ by Claws and Alejandro
