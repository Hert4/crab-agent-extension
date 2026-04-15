/**
 * Minimal DOCX builder for Chrome Extension (no npm dependencies).
 * Creates valid .docx files (which are ZIP archives of XML) using JSZip.
 * Referenced from skills/docx SKILL.md for correct XML structure.
 *
 * Supports embedded chart images: SVG -> PNG via Canvas -> DrawingML in DOCX.
 * This runs in the sidepanel context where JSZip + DOM/Canvas are available.
 */

/* global JSZip */

const DXA_PER_INCH = 1440;
const EMU_PER_INCH = 914400;

const PAGE_SIZES = {
  a4: { width: 11906, height: 16838 },
  letter: { width: 12240, height: 15840 }
};

const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
  '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#10b981'
];

/**
 * Build a DOCX file from structured document data.
 * @param {Object} data - { title, subtitle, author, content[], pageSize, orientation }
 * @returns {Promise<Blob>} The DOCX file as a Blob
 */
export async function buildDocxBlob(data) {
  const { title, subtitle, author, content, pageSize = 'a4', orientation = 'portrait' } = data;

  const size = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
  const w = orientation === 'landscape' ? size.height : size.width;
  const h = orientation === 'landscape' ? size.width : size.height;
  const margin = 1440; // 1 inch margins
  const contentWidth = w - margin * 2;

  // Collect chart images: { rId, filename, pngBase64 }
  const chartImages = [];

  // Build document.xml body (async for chart image generation)
  const bodyXml = await _buildBodyXml({ title, subtitle, author, content, contentWidth, chartImages });

  const orientAttr = orientation === 'landscape' ? ` w:orient="landscape"` : '';
  const sectionProps = `<w:sectPr>
    <w:pgSz w:w="${w}" w:h="${h}"${orientAttr}/>
    <w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720" w:gutter="0"/>
  </w:sectPr>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mo="http://schemas.microsoft.com/office/mac/office/2008/main"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mv="urn:schemas-microsoft-com:mac:vml"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:sl="http://schemas.openxmlformats.org/schemaLibrary/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
  xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:lc="http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas"
  xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
  <w:body>
${bodyXml}
    ${sectionProps}
  </w:body>
</w:document>`;

  const stylesXml = _buildStylesXml();
  const contentTypesXml = _buildContentTypes(chartImages);
  const relsXml = _buildRels();
  const documentRelsXml = _buildDocumentRels(chartImages);
  const coreXml = _buildCoreProperties(title, author);

  // Assemble ZIP
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/_rels/document.xml.rels', documentRelsXml);
  zip.file('docProps/core.xml', coreXml);

  // Add chart images to word/media/
  for (const img of chartImages) {
    const binaryStr = atob(img.pngBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    zip.file(`word/media/${img.filename}`, bytes);
  }

  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ========== Body XML Builder ==========

async function _buildBodyXml({ title, subtitle, author, content, contentWidth, chartImages }) {
  const parts = [];

  // Title
  if (title) {
    parts.push(`    <w:p>
      <w:pPr><w:pStyle w:val="Title"/><w:spacing w:after="120"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr><w:t xml:space="preserve">${_escXml(title)}</w:t></w:r>
    </w:p>`);
  }

  // Subtitle
  if (subtitle) {
    parts.push(`    <w:p>
      <w:pPr><w:pStyle w:val="Subtitle"/><w:spacing w:after="100"/></w:pPr>
      <w:r><w:rPr><w:color w:val="666666"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">${_escXml(subtitle)}</w:t></w:r>
    </w:p>`);
  }

  // Author + date line
  parts.push(`    <w:p>
    <w:pPr><w:spacing w:after="200"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="8" w:color="E2E8F0"/></w:pBdr></w:pPr>
    <w:r><w:rPr><w:color w:val="999999"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${_escXml(author || 'Crab-Agent')} &#x2022; ${_escXml(new Date().toLocaleDateString('vi-VN'))}</w:t></w:r>
  </w:p>`);

  // Content blocks
  for (const block of content) {
    const xml = await _renderBlockXml(block, contentWidth, chartImages);
    if (xml) parts.push(xml);
  }

  return parts.join('\n');
}

async function _renderBlockXml(block, contentWidth, chartImages) {
  if (!block || !block.type) return '';

  switch (block.type) {
    case 'heading': {
      const level = Math.min(3, Math.max(1, block.level || 1));
      const styleId = `Heading${level}`;
      const sizes = { 1: 36, 2: 28, 3: 24 };
      const sz = sizes[level] || 24;
      return `    <w:p>
      <w:pPr><w:pStyle w:val="${styleId}"/><w:spacing w:before="240" w:after="120"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${_escXml(block.text || '')}</w:t></w:r>
    </w:p>`;
    }

    case 'paragraph': {
      const rPrParts = [];
      if (block.bold) rPrParts.push('<w:b/>');
      if (block.italic) rPrParts.push('<w:i/>');
      const rPr = rPrParts.length ? `<w:rPr>${rPrParts.join('')}</w:rPr>` : '';

      const pPrParts = ['<w:spacing w:after="80"/>'];
      if (block.align === 'center') pPrParts.push('<w:jc w:val="center"/>');
      else if (block.align === 'right') pPrParts.push('<w:jc w:val="right"/>');
      const pPr = `<w:pPr>${pPrParts.join('')}</w:pPr>`;

      // Handle newlines by creating separate runs with break elements
      const text = block.text || '';
      const lines = text.split('\n');
      const runs = lines.map((line, i) => {
        const breakEl = i > 0 ? '<w:br/>' : '';
        return `<w:r>${rPr}${breakEl ? `<w:br/>` : ''}<w:t xml:space="preserve">${_escXml(line)}</w:t></w:r>`;
      }).join('\n      ');

      return `    <w:p>
      ${pPr}
      ${runs}
    </w:p>`;
    }

    case 'list': {
      const items = Array.isArray(block.items) ? block.items : [];
      const isBullet = block.style !== 'number';
      // Use simple text-based bullets/numbers since abstractNum config is complex
      return items.map((item, i) => {
        const prefix = isBullet ? '\u2022 ' : `${i + 1}. `;
        return `    <w:p>
      <w:pPr><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="40"/></w:pPr>
      <w:r><w:t xml:space="preserve">${_escXml(prefix + String(item))}</w:t></w:r>
    </w:p>`;
      }).join('\n');
    }

    case 'table': {
      const headers = Array.isArray(block.headers) ? block.headers : [];
      const rows = Array.isArray(block.rows) ? block.rows : [];
      const colCount = Math.max(headers.length, rows.length > 0 ? (rows[0]?.length || 0) : 0) || 1;
      const colWidth = Math.floor(contentWidth / colCount);

      const border = `<w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
                <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
                <w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
                <w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>`;
      const borders = `<w:tcBorders>${border}</w:tcBorders>`;

      const headerRow = headers.length > 0 ? `      <w:tr>
${headers.map(h => `        <w:tc>
          <w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/>${borders}<w:shd w:val="clear" w:fill="F1F5F9"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${_escXml(String(h))}</w:t></w:r></w:p>
        </w:tc>`).join('\n')}
      </w:tr>` : '';

      const dataRows = rows.map(row => {
        const cells = Array.isArray(row) ? row : [];
        return `      <w:tr>
${cells.map(c => `        <w:tc>
          <w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/>${borders}</w:tcPr>
          <w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${_escXml(String(c))}</w:t></w:r></w:p>
        </w:tc>`).join('\n')}
      </w:tr>`;
      }).join('\n');

      return `    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="${contentWidth}" w:type="dxa"/>
        <w:tblBorders>
          ${border}
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        </w:tblBorders>
      </w:tblPr>
${headerRow}
${dataRows}
    </w:tbl>
    <w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`;
    }

    case 'code': {
      const text = block.text || '';
      const langLabel = block.language ? `[${block.language.toUpperCase()}]\n` : '';
      return `    <w:p>
      <w:pPr>
        <w:shd w:val="clear" w:fill="F1F5F9"/>
        <w:spacing w:before="120" w:after="120"/>
        <w:ind w:left="240" w:right="240"/>
      </w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="1E293B"/></w:rPr><w:t xml:space="preserve">${_escXml(langLabel + text)}</w:t></w:r>
    </w:p>`;
    }

    case 'pagebreak':
      return `    <w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

    case 'divider':
      return `    <w:p>
      <w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="E2E8F0"/></w:pBdr><w:spacing w:before="200" w:after="200"/></w:pPr>
    </w:p>`;

    case 'chart':
    case 'chart_placeholder':
      return await _renderChartBlock(block, contentWidth, chartImages);

    default:
      return `    <w:p><w:r><w:t xml:space="preserve">${_escXml(block.text || JSON.stringify(block))}</w:t></w:r></w:p>`;
  }
}

// ========== Chart → DOCX Image Embedding ==========

/**
 * Render a chart block as an embedded PNG image in DOCX.
 * Falls back to data table if Canvas API is unavailable.
 */
async function _renderChartBlock(block, contentWidth, chartImages) {
  const chartTitle = block.title || '';
  const data = block.data || {};
  const labels = Array.isArray(data.labels) ? data.labels : [];
  const datasets = _normalizeDatasets(data, labels);

  if (labels.length === 0 && datasets.length === 0) {
    return `    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">[Chart: no data provided]</w:t></w:r></w:p>`;
  }

  // Try to render chart as PNG image via Canvas
  try {
    if (typeof document !== 'undefined') {
      const chartType = (block.chartType || 'bar').toLowerCase();
      const svgString = _buildChartSvg(chartType, labels, datasets, chartTitle);
      const pngBase64 = await _svgToPngBase64(svgString);

      if (pngBase64) {
        const imgIndex = chartImages.length + 1;
        const rId = `rIdChart${imgIndex}`;
        const filename = `chart${imgIndex}.png`;

        chartImages.push({ rId, filename, pngBase64 });

        // Determine image dimensions in EMU (English Metric Units)
        // Chart SVG is typically 560x300 or 360x300 pixels
        const isPie = chartType === 'pie' || chartType === 'donut';
        const svgW = isPie ? 360 : 560;
        const svgH = isPie ? 320 : 300;
        // Scale to fit content width (contentWidth is in DXA, 1440 DXA = 1 inch)
        const maxWidthInches = contentWidth / DXA_PER_INCH;
        const imgAspect = svgW / svgH;
        const imgWidthInches = Math.min(maxWidthInches, 5.5);
        const imgHeightInches = imgWidthInches / imgAspect;
        const emuW = Math.round(imgWidthInches * EMU_PER_INCH);
        const emuH = Math.round(imgHeightInches * EMU_PER_INCH);

        const xmlParts = [];

        // Chart title
        if (chartTitle) {
          xmlParts.push(`    <w:p>
      <w:pPr><w:spacing w:before="200" w:after="80"/><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${_escXml(chartTitle)}</w:t></w:r>
    </w:p>`);
        }

        // Embedded image via DrawingML
        xmlParts.push(`    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${emuW}" cy="${emuH}"/>
            <wp:docPr id="${imgIndex}" name="Chart ${imgIndex}"/>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="${imgIndex}" name="${filename}"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${rId}"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="${emuW}" cy="${emuH}"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>`);

        // Legend text below chart
        if (datasets.length > 1 || (datasets.length === 1 && datasets[0].label)) {
          const legendText = datasets.map(ds => ds.label).filter(Boolean).join('  |  ');
          if (legendText) {
            xmlParts.push(`    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve">${_escXml(legendText)}</w:t></w:r>
    </w:p>`);
          }
        }

        return xmlParts.join('\n');
      }
    }
  } catch (e) {
    console.warn('[DocxBuilder] Chart image generation failed, falling back to table:', e.message);
  }

  // Fallback: render chart as data table
  return _renderChartAsTable(block, contentWidth);
}

/**
 * Fallback: render chart data as a DOCX table (when Canvas is unavailable).
 */
function _renderChartAsTable(block, contentWidth) {
  const chartTitle = block.title || 'Chart';
  const data = block.data || {};
  const labels = Array.isArray(data.labels) ? data.labels : [];
  const datasets = Array.isArray(data.datasets) ? data.datasets : (Array.isArray(data.values) ? [{ label: '', values: data.values }] : []);

  const parts = [];
  parts.push(`    <w:p><w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">[Chart] ${_escXml(chartTitle)}</w:t></w:r></w:p>`);

  if (labels.length > 0 && datasets.length > 0) {
    const colCount = 1 + datasets.length;
    const colW = Math.floor(contentWidth / colCount);
    const bd = `<w:tcBorders><w:top w:val="single" w:sz="4" w:color="CCCCCC"/><w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/><w:left w:val="single" w:sz="4" w:color="CCCCCC"/><w:right w:val="single" w:sz="4" w:color="CCCCCC"/></w:tcBorders>`;
    let tbl = `<w:tbl><w:tblPr><w:tblW w:w="${contentWidth}" w:type="dxa"/></w:tblPr>`;
    // Header
    tbl += '<w:tr>';
    tbl += `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${bd}<w:shd w:val="clear" w:fill="F1F5F9"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Label</w:t></w:r></w:p></w:tc>`;
    datasets.forEach(ds => {
      tbl += `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${bd}<w:shd w:val="clear" w:fill="F1F5F9"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${_escXml(ds.label || 'Value')}</w:t></w:r></w:p></w:tc>`;
    });
    tbl += '</w:tr>';
    // Data rows
    labels.forEach((lbl, i) => {
      tbl += '<w:tr>';
      tbl += `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${bd}</w:tcPr><w:p><w:r><w:t xml:space="preserve">${_escXml(lbl)}</w:t></w:r></w:p></w:tc>`;
      datasets.forEach(ds => {
        const val = (Array.isArray(ds.values) ? ds.values[i] : '') || '';
        tbl += `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${bd}</w:tcPr><w:p><w:r><w:t xml:space="preserve">${_escXml(String(val))}</w:t></w:r></w:p></w:tc>`;
      });
      tbl += '</w:tr>';
    });
    tbl += '</w:tbl><w:p/>';
    parts.push(tbl);
  }

  return parts.join('\n');
}

// ========== SVG Chart Generators (mirrors document-generator.js logic) ==========

function _normalizeDatasets(data, labels) {
  if (Array.isArray(data.datasets) && data.datasets.length > 0) {
    return data.datasets.map((ds, i) => ({
      label: ds.label || `Series ${i + 1}`,
      values: Array.isArray(ds.values) ? ds.values.map(Number) : [],
      color: ds.color || CHART_COLORS[i % CHART_COLORS.length]
    }));
  }
  if (Array.isArray(data.values)) {
    return [{ label: data.label || '', values: data.values.map(Number), color: data.color || CHART_COLORS[0] }];
  }
  return [{ label: '', values: labels.map(() => 0), color: CHART_COLORS[0] }];
}

function _niceMax(val) {
  if (val <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
  const normalized = val / magnitude;
  let nice;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

function _yAxisSvg(maxVal, plotH, pad, totalW) {
  const steps = 5;
  const stepVal = maxVal / steps;
  let gridLines = '';
  let yLabels = '';
  for (let i = 0; i <= steps; i++) {
    const val = stepVal * i;
    const y = pad.t + plotH - (val / maxVal) * plotH;
    gridLines += `<line x1="${pad.l}" y1="${y}" x2="${totalW - pad.r}" y2="${y}" stroke="#f1f5f9" stroke-width="1"/>`;
    const formatted = val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : val >= 1000 ? (val / 1000).toFixed(1) + 'K' : Math.round(val * 10) / 10;
    yLabels += `<text x="${pad.l - 8}" y="${y + 3}" text-anchor="end" font-size="9" fill="#94a3b8" font-family="Arial, sans-serif">${formatted}</text>`;
  }
  return { gridLines, yLabels };
}

/**
 * Build a complete SVG string for a chart, including optional title.
 */
function _buildChartSvg(chartType, labels, datasets, title) {
  let chartSvg = '';
  switch (chartType) {
    case 'bar':
      chartSvg = _svgBarChart(labels, datasets, false, false);
      break;
    case 'horizontal_bar':
      chartSvg = _svgHorizontalBarChart(labels, datasets);
      break;
    case 'stacked_bar':
      chartSvg = _svgBarChart(labels, datasets, true, false);
      break;
    case 'grouped_bar':
      chartSvg = _svgBarChart(labels, datasets, false, true);
      break;
    case 'line':
    case 'area':
      chartSvg = _svgLineChart(labels, datasets, chartType === 'area');
      break;
    case 'pie':
      chartSvg = _svgPieChart(labels, datasets, false);
      break;
    case 'donut':
      chartSvg = _svgPieChart(labels, datasets, true);
      break;
    case 'radar':
      chartSvg = _svgRadarChart(labels, datasets);
      break;
    default:
      chartSvg = _svgBarChart(labels, datasets, false, false);
  }

  // Wrap with background + title
  const isPie = chartType === 'pie' || chartType === 'donut';
  const isRadar = chartType === 'radar';
  const isHBar = chartType === 'horizontal_bar';
  const n = labels.length || 1;
  const baseW = isPie || isRadar ? 360 : 560;
  const baseH = isPie ? 320 : isRadar ? 320 : isHBar ? (40 + n * 36 + 40) : 300;

  const titleH = title ? 30 : 0;
  const legendH = (datasets.length > 1 || (datasets.length === 1 && datasets[0].label)) ? 28 : 0;
  const totalH = baseH + titleH + legendH + 20; // 20 for padding

  let fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${baseW}" height="${totalH}" viewBox="0 0 ${baseW} ${totalH}">`;
  fullSvg += `<rect width="${baseW}" height="${totalH}" fill="white" rx="4"/>`;

  // Title
  if (title) {
    fullSvg += `<text x="${baseW / 2}" y="22" text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b" font-family="Arial, sans-serif">${_escXml(title)}</text>`;
  }

  // Offset chart content
  fullSvg += `<g transform="translate(0, ${titleH})">`;
  fullSvg += chartSvg;
  fullSvg += '</g>';

  // Legend
  if (legendH > 0) {
    const legendY = titleH + baseH + 6;
    let lx = baseW / 2 - (datasets.length * 70) / 2;
    datasets.forEach((ds) => {
      fullSvg += `<rect x="${lx}" y="${legendY}" width="10" height="10" rx="2" fill="${ds.color}"/>`;
      fullSvg += `<text x="${lx + 14}" y="${legendY + 9}" font-size="9" fill="#475569" font-family="Arial, sans-serif">${_escXml(ds.label || '')}</text>`;
      lx += Math.max(70, (ds.label || '').length * 6 + 24);
    });
  }

  fullSvg += '</svg>';
  return fullSvg;
}

// ---- Bar Chart (vertical) ----
function _svgBarChart(labels, datasets, stacked, grouped) {
  const W = 560, H = 300, pad = { t: 20, r: 20, b: 60, l: 55 };
  const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
  const n = labels.length || 1;

  let maxVal = 0;
  if (stacked) {
    for (let i = 0; i < n; i++) {
      let sum = 0;
      datasets.forEach(ds => { sum += Math.abs(ds.values[i] || 0); });
      maxVal = Math.max(maxVal, sum);
    }
  } else {
    datasets.forEach(ds => ds.values.forEach(v => { maxVal = Math.max(maxVal, Math.abs(v)); }));
  }
  if (maxVal === 0) maxVal = 1;
  const niceMax = _niceMax(maxVal);

  const barGroupW = plotW / n;
  const dsCount = grouped ? datasets.length : 1;
  const barW = Math.min(Math.max(barGroupW * 0.7 / dsCount, 8), 50);
  const gap = (barGroupW - barW * dsCount) / 2;

  let bars = '';
  for (let i = 0; i < n; i++) {
    const gx = pad.l + i * barGroupW;
    if (stacked) {
      let yOffset = 0;
      datasets.forEach((ds) => {
        const val = ds.values[i] || 0;
        const barH = (val / niceMax) * plotH;
        const y = pad.t + plotH - yOffset - barH;
        bars += `<rect x="${gx + gap}" y="${y}" width="${barW}" height="${barH}" fill="${ds.color}" rx="2"/>`;
        yOffset += barH;
      });
    } else if (grouped) {
      datasets.forEach((ds, di) => {
        const val = ds.values[i] || 0;
        const barH = (val / niceMax) * plotH;
        const x = gx + gap + di * barW;
        const y = pad.t + plotH - barH;
        bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${ds.color}" rx="2"/>`;
      });
    } else {
      const ds = datasets[0] || { values: [], color: CHART_COLORS[0] };
      const val = ds.values[i] || 0;
      const barH = (val / niceMax) * plotH;
      const y = pad.t + plotH - barH;
      const color = datasets.length === 1 ? (CHART_COLORS[i % CHART_COLORS.length]) : ds.color;
      bars += `<rect x="${gx + gap}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="2"/>`;
    }
  }

  const { gridLines, yLabels } = _yAxisSvg(niceMax, plotH, pad, W);
  const xLabels = labels.map((l, i) => {
    const x = pad.l + i * barGroupW + barGroupW / 2;
    const truncated = String(l).length > 12 ? String(l).substring(0, 11) + '\u2026' : String(l);
    return `<text x="${x}" y="${H - pad.b + 16}" text-anchor="middle" font-size="9" fill="#64748b" font-family="Arial, sans-serif">${_escXml(truncated)}</text>`;
  }).join('');

  return `${gridLines}${yLabels}${bars}${xLabels}<line x1="${pad.l}" y1="${pad.t + plotH}" x2="${W - pad.r}" y2="${pad.t + plotH}" stroke="#cbd5e1" stroke-width="1"/>`;
}

// ---- Horizontal Bar Chart ----
function _svgHorizontalBarChart(labels, datasets) {
  const n = labels.length || 1;
  const barH = Math.min(28, 200 / n);
  const rowH = barH + 8;
  const W = 560, pad = { t: 20, r: 20, b: 20, l: 120 };
  const H = pad.t + n * rowH + pad.b;
  const plotW = W - pad.l - pad.r;

  const ds = datasets[0] || { values: [], color: CHART_COLORS[0] };
  let maxVal = 0;
  ds.values.forEach(v => { maxVal = Math.max(maxVal, Math.abs(v)); });
  if (maxVal === 0) maxVal = 1;
  const niceMax = _niceMax(maxVal);

  let bars = '';
  for (let i = 0; i < n; i++) {
    const val = ds.values[i] || 0;
    const barW = (val / niceMax) * plotW;
    const y = pad.t + i * rowH;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const truncLabel = String(labels[i]).length > 18 ? String(labels[i]).substring(0, 17) + '\u2026' : String(labels[i]);
    bars += `<text x="${pad.l - 8}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="9" fill="#475569" font-family="Arial, sans-serif">${_escXml(truncLabel)}</text>`;
    bars += `<rect x="${pad.l}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="3"/>`;
    bars += `<text x="${pad.l + barW + 6}" y="${y + barH / 2 + 4}" font-size="9" fill="#64748b" font-family="Arial, sans-serif">${val}</text>`;
  }

  return `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}" stroke="#cbd5e1" stroke-width="1"/>${bars}`;
}

// ---- Line / Area Chart ----
function _svgLineChart(labels, datasets, isArea) {
  const W = 560, H = 300, pad = { t: 20, r: 20, b: 60, l: 55 };
  const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
  const n = labels.length || 1;

  let maxVal = 0;
  datasets.forEach(ds => ds.values.forEach(v => { maxVal = Math.max(maxVal, Math.abs(v)); }));
  if (maxVal === 0) maxVal = 1;
  const niceMax = _niceMax(maxVal);

  const stepX = n > 1 ? plotW / (n - 1) : plotW;

  let paths = '';
  datasets.forEach((ds) => {
    const points = ds.values.map((v, i) => {
      const x = pad.l + (n > 1 ? i * stepX : plotW / 2);
      const y = pad.t + plotH - ((v || 0) / niceMax) * plotH;
      return `${x},${y}`;
    });

    if (isArea) {
      const firstX = pad.l;
      const lastX = pad.l + (n > 1 ? (n - 1) * stepX : plotW / 2);
      const baseline = pad.t + plotH;
      paths += `<polygon points="${firstX},${baseline} ${points.join(' ')} ${lastX},${baseline}" fill="${ds.color}" fill-opacity="0.15"/>`;
    }

    paths += `<polyline points="${points.join(' ')}" fill="none" stroke="${ds.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    ds.values.forEach((v, i) => {
      const x = pad.l + (n > 1 ? i * stepX : plotW / 2);
      const y = pad.t + plotH - ((v || 0) / niceMax) * plotH;
      paths += `<circle cx="${x}" cy="${y}" r="3.5" fill="white" stroke="${ds.color}" stroke-width="2"/>`;
    });
  });

  const { gridLines, yLabels } = _yAxisSvg(niceMax, plotH, pad, W);
  const xLabels = labels.map((l, i) => {
    const x = pad.l + (n > 1 ? i * stepX : plotW / 2);
    const truncated = String(l).length > 12 ? String(l).substring(0, 11) + '\u2026' : String(l);
    return `<text x="${x}" y="${H - pad.b + 16}" text-anchor="middle" font-size="9" fill="#64748b" font-family="Arial, sans-serif">${_escXml(truncated)}</text>`;
  }).join('');

  return `${gridLines}${yLabels}${paths}${xLabels}<line x1="${pad.l}" y1="${pad.t + plotH}" x2="${W - pad.r}" y2="${pad.t + plotH}" stroke="#cbd5e1" stroke-width="1"/>`;
}

// ---- Pie / Donut Chart ----
function _svgPieChart(labels, datasets, isDonut) {
  const W = 360, H = 300;
  const cx = W / 2, cy = H / 2 - 10, R = 110;
  const innerR = isDonut ? R * 0.55 : 0;

  const ds = datasets[0] || { values: [], color: CHART_COLORS[0] };
  const values = ds.values.map(v => Math.max(0, v || 0));
  const total = values.reduce((a, b) => a + b, 0) || 1;

  let slices = '';
  let angle = -90;
  values.forEach((val, i) => {
    const sliceAngle = (val / total) * 360;
    const startRad = (angle * Math.PI) / 180;
    const endRad = ((angle + sliceAngle) * Math.PI) / 180;
    const largeArc = sliceAngle > 180 ? 1 : 0;
    const color = CHART_COLORS[i % CHART_COLORS.length];

    const x1 = cx + R * Math.cos(startRad);
    const y1 = cy + R * Math.sin(startRad);
    const x2 = cx + R * Math.cos(endRad);
    const y2 = cy + R * Math.sin(endRad);

    if (isDonut) {
      const ix1 = cx + innerR * Math.cos(startRad);
      const iy1 = cy + innerR * Math.sin(startRad);
      const ix2 = cx + innerR * Math.cos(endRad);
      const iy2 = cy + innerR * Math.sin(endRad);
      slices += `<path d="M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z" fill="${color}"/>`;
    } else {
      slices += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}"/>`;
    }

    // Percentage label on slice
    const midAngle = angle + sliceAngle / 2;
    const midRad = (midAngle * Math.PI) / 180;
    const labelR = isDonut ? (R + innerR) / 2 : R * 0.65;
    const pct = ((val / total) * 100);
    if (pct >= 5) { // Only show label if slice is big enough
      const lx = cx + labelR * Math.cos(midRad);
      const ly = cy + labelR * Math.sin(midRad);
      slices += `<text x="${lx}" y="${ly + 3}" text-anchor="middle" font-size="9" font-weight="600" fill="white" font-family="Arial, sans-serif">${pct.toFixed(0)}%</text>`;
    }

    angle += sliceAngle;
  });

  return slices;
}

// ---- Radar Chart ----
function _svgRadarChart(labels, datasets) {
  const W = 360, H = 320;
  const cx = W / 2, cy = H / 2, R = 120;
  const n = labels.length || 3;

  let maxVal = 0;
  datasets.forEach(ds => ds.values.forEach(v => { maxVal = Math.max(maxVal, Math.abs(v)); }));
  if (maxVal === 0) maxVal = 1;
  const niceMax = _niceMax(maxVal);

  const angleStep = (2 * Math.PI) / n;
  const getPoint = (i, val) => {
    const a = i * angleStep - Math.PI / 2;
    const r = (val / niceMax) * R;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  // Grid rings
  let grid = '';
  for (let ring = 1; ring <= 4; ring++) {
    const ringR = (ring / 4) * R;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i * angleStep - Math.PI / 2;
      pts.push(`${cx + ringR * Math.cos(a)},${cy + ringR * Math.sin(a)}`);
    }
    grid += `<polygon points="${pts.join(' ')}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
  }

  // Axis lines + labels
  let axes = '';
  for (let i = 0; i < n; i++) {
    const a = i * angleStep - Math.PI / 2;
    const ex = cx + R * Math.cos(a);
    const ey = cy + R * Math.sin(a);
    axes += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="#e2e8f0" stroke-width="1"/>`;
    const lx = cx + (R + 14) * Math.cos(a);
    const ly = cy + (R + 14) * Math.sin(a);
    const anchor = Math.abs(lx - cx) < 5 ? 'middle' : lx > cx ? 'start' : 'end';
    const truncated = String(labels[i]).length > 10 ? String(labels[i]).substring(0, 9) + '\u2026' : String(labels[i]);
    axes += `<text x="${lx}" y="${ly + 3}" text-anchor="${anchor}" font-size="8.5" fill="#64748b" font-family="Arial, sans-serif">${_escXml(truncated)}</text>`;
  }

  // Data polygons
  let polys = '';
  datasets.forEach((ds) => {
    const pts = ds.values.map((v, i) => {
      const p = getPoint(i, v || 0);
      return `${p.x},${p.y}`;
    }).join(' ');
    polys += `<polygon points="${pts}" fill="${ds.color}" fill-opacity="0.2" stroke="${ds.color}" stroke-width="2"/>`;
    ds.values.forEach((v, i) => {
      const p = getPoint(i, v || 0);
      polys += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="white" stroke="${ds.color}" stroke-width="1.5"/>`;
    });
  });

  return `${grid}${axes}${polys}`;
}

// ========== SVG to PNG Conversion (via Canvas API) ==========

/**
 * Convert an SVG string to a base64-encoded PNG.
 * Uses an offscreen Image + Canvas approach (works in sidepanel/DOM context).
 * @param {string} svgString - Complete SVG markup
 * @returns {Promise<string|null>} Base64-encoded PNG data (without prefix), or null on failure
 */
async function _svgToPngBase64(svgString) {
  return new Promise((resolve) => {
    try {
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        try {
          // Use 2x resolution for crisp output
          const scale = 2;
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth * scale;
          canvas.height = img.naturalHeight * scale;
          const ctx = canvas.getContext('2d');
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);

          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          // Strip the data:image/png;base64, prefix
          const base64 = dataUrl.split(',')[1] || null;
          resolve(base64);
        } catch (e) {
          URL.revokeObjectURL(url);
          console.warn('[DocxBuilder] Canvas render error:', e);
          resolve(null);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.warn('[DocxBuilder] SVG image load failed');
        resolve(null);
      };

      img.src = url;
    } catch (e) {
      console.warn('[DocxBuilder] SVG to PNG conversion error:', e);
      resolve(null);
    }
  });
}

// ========== DOCX Boilerplate XMLs ==========

function _buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/>
    <w:rPr><w:color w:val="666666"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
</w:styles>`;
}

function _buildContentTypes(chartImages = []) {
  let extra = '';
  if (chartImages.length > 0) {
    extra = '\n  <Default Extension="png" ContentType="image/png"/>';
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>${extra}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;
}

function _buildRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;
}

function _buildDocumentRels(chartImages = []) {
  let imageRels = '';
  for (const img of chartImages) {
    imageRels += `\n  <Relationship Id="${img.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.filename}"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${imageRels}
</Relationships>`;
}

function _buildCoreProperties(title, author) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${_escXml(title || '')}</dc:title>
  <dc:creator>${_escXml(author || 'Crab-Agent')}</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function _escXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
