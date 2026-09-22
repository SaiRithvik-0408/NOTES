import { Note } from '../types/note';

/**
 * Converts basic HTML to clean Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>(.*?)<\/ul>/gi, '$1\n')
    .replace(/<ol[^>]*>(.*?)<\/ol>/gi, '$1\n')
    .replace(/<hr\s*\/?>/gi, '---\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '') // Strip remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Exports a note as a downloadable Markdown (.md) file
 */
export function exportNoteToMarkdown(note: Note): void {
  const markdownBody = htmlToMarkdown(note.content);
  const fileContent = `# ${note.title}\n\n${markdownBody}\n\n---\n*Exported from Nexus Notes on ${new Date().toLocaleDateString()}*\n`;

  const blob = new Blob([fileContent], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeFilename = (note.title || 'Untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  link.href = url;
  link.setAttribute('download', `${safeFilename || 'note'}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports a note as a beautifully styled printable PDF
 */
export function exportNoteToPdf(note: Note): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups in your browser to export as PDF.');
    return;
  }

  const formattedDate = new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const htmlDocument = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${note.title || 'Nexus Document'}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #1e293b;
            line-height: 1.65;
            max-width: 800px;
            margin: 40px auto;
            padding: 0 24px;
          }
          .header {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .brand {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #6366f1;
            margin-bottom: 8px;
          }
          h1 {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #0f172a;
            margin: 0 0 8px 0;
          }
          .meta {
            font-size: 13px;
            color: #64748b;
          }
          .content {
            font-size: 15px;
            color: #334155;
          }
          .content h2 { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 28px; }
          .content h3 { font-size: 18px; font-weight: 600; color: #1e293b; margin-top: 24px; }
          .content code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
          .content blockquote { border-left: 4px solid #6366f1; margin: 20px 0; padding-left: 16px; color: #475569; font-style: italic; }
          .content img { max-width: 100%; border-radius: 8px; }
          .footer {
            margin-top: 60px;
            border-top: 1px solid #e2e8f0;
            padding-top: 16px;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .header { padding-top: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">Nexus Notes</div>
          <h1>${note.icon ? `${note.icon} ` : ''}${note.title || 'Untitled Document'}</h1>
          <div class="meta">Last Updated: ${formattedDate}</div>
        </div>
        <div class="content">
          ${note.content || '<p><em>Empty note</em></p>'}
        </div>
        <div class="footer">
          Exported from Nexus Notes Workspace
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlDocument);
  printWindow.document.close();

  // Trigger print after styles load
  printWindow.onload = () => {
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

/**
 * Parses an imported Markdown file into title and HTML content for the editor
 */
export async function parseMarkdownFile(file: File): Promise<{ title: string; content: string }> {
  const text = await file.text();
  const lines = text.split('\n');

  let title = file.name.replace(/\.(md|markdown|txt)$/i, '');
  const contentLines: string[] = [];

  let foundTitle = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!foundTitle && trimmed.startsWith('# ')) {
      title = trimmed.replace(/^#\s+/, '').trim();
      foundTitle = true;
      continue;
    }
    contentLines.push(line);
  }

  // Simple conversion to HTML paragraphs & headings
  const htmlContent = contentLines
    .join('\n')
    .split(/\n\n+/)
    .map((block) => {
      const b = block.trim();
      if (!b) return '';
      if (b.startsWith('### ')) return `<h3>${b.replace(/^###\s+/, '')}</h3>`;
      if (b.startsWith('## ')) return `<h2>${b.replace(/^##\s+/, '')}</h2>`;
      if (b.startsWith('# ')) return `<h1>${b.replace(/^#\s+/, '')}</h1>`;
      if (b.startsWith('> ')) return `<blockquote>${b.replace(/^>\s+/, '')}</blockquote>`;
      if (b.startsWith('- ') || b.startsWith('* ')) {
        const items = b
          .split('\n')
          .map((item) => `<li>${item.replace(/^[-*]\s+/, '')}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${b.replace(/\n/g, '<br/>')}</p>`;
    })
    .filter(Boolean)
    .join('');

  return {
    title: title || 'Imported Note',
    content: htmlContent || '<p>Imported document content.</p>',
  };
}
