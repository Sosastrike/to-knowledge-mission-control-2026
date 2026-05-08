#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

function pdfEscape(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function createPdfBytes(title, markdown) {
  const rawLines = markdown
    .replace(/\r/g, '')
    .split('\n')
    .flatMap((line) => {
      if (line.length <= 96) return [line]
      const chunks = []
      let cursor = 0
      while (cursor < line.length) {
        chunks.push(line.slice(cursor, cursor + 96))
        cursor += 96
      }
      return chunks
    })

  const lines = [title, '', ...rawLines]
  const pageLines = 64
  const pages = []
  for (let index = 0; index < lines.length; index += pageLines) {
    pages.push(lines.slice(index, index + pageLines))
  }
  if (pages.length === 0) pages.push([title])

  const objects = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')

  const pageRefs = []
  for (let i = 0; i < pages.length; i += 1) {
    const pageObj = 3 + i * 2
    pageRefs.push(`${pageObj} 0 R`)
  }
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${pageRefs.join(' ')}] >>`)

  for (let i = 0; i < pages.length; i += 1) {
    const pageObj = 3 + i * 2
    const contentObj = pageObj + 1
    const page = pages[i]
    const operations = ['BT', '/F1 10 Tf', '50 780 Td']
    page.forEach((line, lineIndex) => {
      if (lineIndex > 0) operations.push('0 -12 Td')
      operations.push(`(${pdfEscape(line)}) Tj`)
    })
    operations.push('ET')
    const stream = operations.join('\n')

    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentObj} 0 R >>`)
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`)
  }

  const fontObj = 3 + pages.length * 2
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  const offsets = [0]
  let pdf = '%PDF-1.4\n'
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf, 'utf8')
}

function run() {
  const input = process.argv[2]
  if (!input) {
    console.error('usage: node scripts/render-report-pdf.mjs <input.md> [output.pdf]')
    process.exit(1)
  }

  const inputPath = path.resolve(process.cwd(), input)
  if (!fs.existsSync(inputPath)) {
    console.error(`input_not_found: ${input}`)
    process.exit(1)
  }

  const markdown = fs.readFileSync(inputPath, 'utf8')
  const outputArg = process.argv[3]
  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : inputPath.replace(/\.md$/i, '.pdf')
  const title = path.basename(inputPath).replace(/\.md$/i, '')

  fs.writeFileSync(outputPath, createPdfBytes(title, markdown), { mode: 0o600 })
  console.log(JSON.stringify({ ok: true, input: inputPath, output: outputPath }))
}

run()
