const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const PAGE = { left: 48, right: 547, top: 48, bottom: 780, width: 499 };

function clean(value, fallback = 'N/A') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function truncate(value, max = 70, fallback = 'N/A') {
  const text = clean(value, fallback);
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function ensureSpace(doc, height) {
  if (doc.y + height <= PAGE.bottom) return;
  doc.addPage();
  doc.y = PAGE.top;
}

function section(doc, title) {
  ensureSpace(doc, 32);
  doc.moveDown(0.45);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(title, PAGE.left, doc.y);
  doc.moveDown(0.25);
  doc.strokeColor('#cbd5e1').lineWidth(0.7).moveTo(PAGE.left, doc.y).lineTo(PAGE.right, doc.y).stroke();
  doc.moveDown(0.45);
}

function table(doc, headers, widths, rows) {
  const headerHeight = 22;
  const minRowHeight = 24;
  const verticalPadding = 14;
  ensureSpace(doc, headerHeight + minRowHeight);
  let y = doc.y;

  const drawHeader = () => {
    doc.rect(PAGE.left, y, PAGE.width, headerHeight).fill('#f1f5f9');
    doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(PAGE.left, y, PAGE.width, headerHeight).stroke();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827');
    let x = PAGE.left;
    headers.forEach((header, index) => {
      doc.text(header, x + 6, y + 7, { width: widths[index] - 12, align: index === 1 && headers.length === 2 ? 'right' : 'left' });
      x += widths[index];
    });
    y += headerHeight;
  };

  const getRowHeight = row => {
    doc.font('Helvetica').fontSize(8.2);
    const maxCellHeight = row.reduce((max, cell, index) => {
      const height = doc.heightOfString(clean(cell), {
        width: widths[index] - 12,
        lineGap: 1,
      });
      return Math.max(max, height);
    }, 0);
    return Math.max(minRowHeight, maxCellHeight + verticalPadding);
  };

  drawHeader();
  rows.forEach(row => {
    const rowHeight = getRowHeight(row);
    if (y + rowHeight > PAGE.bottom) {
      doc.addPage();
      y = PAGE.top;
      drawHeader();
    }

    doc.rect(PAGE.left, y, PAGE.width, rowHeight).fill('#ffffff');
    doc.strokeColor('#e2e8f0').lineWidth(0.45).rect(PAGE.left, y, PAGE.width, rowHeight).stroke();
    doc.font('Helvetica').fontSize(8.2).fillColor('#111827');
    let x = PAGE.left;
    row.forEach((cell, index) => {
      doc.text(clean(cell), x + 6, y + 7, {
        width: widths[index] - 12,
        align: index === 1 && headers.length === 2 ? 'right' : 'left',
        lineGap: 1,
      });
      x += widths[index];
    });
    y += rowHeight;
  });
  doc.y = y + 8;
}

function footer(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
      .text(`Page ${i + 1} of ${range.count}`, PAGE.left, 806, { width: PAGE.width, align: 'right' });
  }
}

async function generateSampleReport(outputPath) {
  const generatedOn = new Date().toLocaleString('en-IN', { hour12: true });
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE.top, bottom: 52, left: PAGE.left, right: 48 },
    bufferPages: true,
  });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111827')
    .text('Antibiotic Sales & Anomaly Detection Report', PAGE.left, doc.y, { width: PAGE.width });
  doc.moveDown(0.35);
  doc.font('Helvetica').fontSize(9).fillColor('#475569')
    .text(`Generated: ${generatedOn} | Role: Admin | Scope: Pharmacy-Specific (Pharma1)`, PAGE.left, doc.y, { width: PAGE.width });
  doc.moveDown(0.7);

  section(doc, '1. Pharmacy Details');
  table(doc, ['Pharmacy Name', 'Location'], [300, 199], [['Pharma1', 'Ernakulam']]);

  section(doc, '2. Antibiotic Sales Summary');
  table(doc, ['Antibiotic Name', 'Total Quantity Sold'], [340, 159], [
    ['Amoxicillin 500mg', '1,200'],
    ['Azithromycin 250mg', '900'],
    ['Cefuroxime 250mg', '600'],
    ['Cefixime 200mg', '420'],
    ['Doxycycline 100mg', '315'],
    ['Ciprofloxacin 500mg', '275'],
    ['Metronidazole 400mg', '240'],
    ['Levofloxacin 500mg', '190'],
    ['Clarithromycin 500mg', '150'],
    ['Co-amoxiclav 625mg', '135'],
    ['Nitrofurantoin 100mg', '95'],
  ]);

  section(doc, '3. Detected Anomalies');
  table(doc, ['Detected Drug Name', 'Risk', 'Anomaly Score', 'Explanation'], [150, 65, 82, 202], [
    ['Azithromycin 250mg', 'HIGH', '88.20', truncate('Sudden sales increase compared with usual pharmacy pattern.', 95)],
    ['Cefixime 200mg', 'MEDIUM', '63.40', truncate('Quantity sold is higher than expected for the selected period.', 95)],
  ]);

  section(doc, '4. Key Insights');
  [
    'Azithromycin 250mg requires review due to high anomaly score.',
    'Top 10 sales are concentrated in three antibiotics for the period.',
  ].forEach((insight, index) => {
    ensureSpace(doc, 18);
    doc.font('Helvetica').fontSize(9).fillColor('#111827')
      .text(`${index + 1}. ${insight}`, PAGE.left, doc.y, { width: PAGE.width, lineGap: 1 });
    doc.moveDown(0.25);
  });

  footer(doc);
  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

(async () => {
  try {
    const out = path.resolve(__dirname, '..', 'report_sample.pdf');
    await generateSampleReport(out);
    console.log('Sample report generated at', out);
  } catch (err) {
    console.error('Failed to generate sample report:', err);
    process.exit(1);
  }
})();
