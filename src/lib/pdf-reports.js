import { formatExpenseDate } from './format.js'

const INR_FORMATTER = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PALETTE = ['#00d5f2', '#087cff', '#00bfcb', '#8b78ff', '#ffad5c', '#f16ca6', '#61cf8c', '#b5a4ff', '#748397']

function inr(amount) {
  return `INR ${INR_FORMATTER.format(Number(amount) || 0)}`
}

function renderCategoryPie(rows) {
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 360
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const cx = 170
  const cy = 178
  const radius = 126
  if (total > 0) {
    let angle = -Math.PI / 2
    rows.forEach((row, index) => {
      const next = angle + (Number(row.amount) / total) * Math.PI * 2
      context.beginPath()
      context.moveTo(cx, cy)
      context.arc(cx, cy, radius, angle, next)
      context.closePath()
      context.fillStyle = PALETTE[index % PALETTE.length]
      context.fill()
      angle = next
    })
    context.beginPath()
    context.arc(cx, cy, 67, 0, Math.PI * 2)
    context.fillStyle = '#ffffff'
    context.fill()
  } else {
    context.beginPath()
    context.arc(cx, cy, radius, 0, Math.PI * 2)
    context.fillStyle = '#e9eef4'
    context.fill()
  }
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.font = '12px Arial'
  rows.slice(0, 7).forEach((row, index) => {
    const y = 48 + index * 40
    context.fillStyle = PALETTE[index % PALETTE.length]
    context.fillRect(320, y - 6, 11, 11)
    context.fillStyle = '#263544'
    const label = `${row.label || 'Uncategorized'} · ${Number(row.percentage || 0).toFixed(1)}%`
    context.fillText(label.slice(0, 25), 340, y)
  })
  return canvas.toDataURL('image/png')
}

function renderComparisonChart(rows) {
  const canvas = document.createElement('canvas')
  canvas.width = 1100
  canvas.height = 400
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const data = rows.slice(0, 31)
  const maxValue = Math.max(1, ...data.map((row) => Math.max(Number(row.expenses) || 0, Number(row.savings) || 0)))
  const left = 48
  const right = 18
  const top = 28
  const bottom = 68
  const chartWidth = canvas.width - left - right
  const chartHeight = canvas.height - top - bottom
  context.strokeStyle = '#e3eaf1'
  context.lineWidth = 1
  for (let line = 0; line <= 4; line += 1) {
    const y = top + (chartHeight * line) / 4
    context.beginPath()
    context.moveTo(left, y)
    context.lineTo(canvas.width - right, y)
    context.stroke()
  }
  const slotWidth = chartWidth / Math.max(data.length, 1)
  const barWidth = Math.max(3, Math.min(18, slotWidth * 0.31))
  data.forEach((row, index) => {
    const center = left + slotWidth * (index + 0.5)
    const expenseHeight = ((Number(row.expenses) || 0) / maxValue) * chartHeight
    const savingHeight = ((Number(row.savings) || 0) / maxValue) * chartHeight
    context.fillStyle = '#00a8c2'
    context.fillRect(center - barWidth - 1, top + chartHeight - expenseHeight, barWidth, expenseHeight)
    context.fillStyle = '#46ae71'
    context.fillRect(center + 1, top + chartHeight - savingHeight, barWidth, savingHeight)
    if (data.length <= 15 || index % Math.ceil(data.length / 15) === 0) {
      context.save()
      context.translate(center + 2, canvas.height - 24)
      context.rotate(-0.35)
      context.fillStyle = '#48596a'
      context.font = '10px Arial'
      context.textAlign = 'right'
      context.fillText(String(row.label || ''), 0, 0)
      context.restore()
    }
  })
  context.fillStyle = '#00a8c2'
  context.fillRect(420, 10, 12, 12)
  context.fillStyle = '#263544'
  context.font = '12px Arial'
  context.fillText('Expenses', 438, 20)
  context.fillStyle = '#46ae71'
  context.fillRect(520, 10, 12, 12)
  context.fillStyle = '#263544'
  context.fillText('Savings', 538, 20)
  return canvas.toDataURL('image/png')
}

export async function downloadReportPdf({
  title,
  periodLabel,
  generatedAt,
  totals,
  categoryRows,
  trendRows,
  transactions,
}) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableModule.default
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = document.internal.pageSize.getWidth()
  const categoryChart = renderCategoryPie(categoryRows)
  const trendsChart = renderComparisonChart(trendRows)

  document.setFillColor(8, 13, 22)
  document.rect(0, 0, pageWidth, 38, 'F')
  document.setTextColor(0, 213, 242)
  document.setFont('helvetica', 'bold')
  document.setFontSize(12)
  document.text('MAGPET', 15, 14)
  document.setTextColor(255, 255, 255)
  document.setFontSize(21)
  document.text(title, 15, 25)
  document.setTextColor(218, 230, 241)
  document.setFont('helvetica', 'normal')
  document.setFontSize(9)
  document.text(`Period: ${periodLabel}`, 15, 33)
  document.text(`Generated: ${generatedAt}`, pageWidth - 15, 16, { align: 'right' })

  const metricY = 46
  const metricWidth = (pageWidth - 36) / 4
  const metrics = [
    ['Total expenses', inr(totals.expenseCents / 100)],
    ['Total savings', inr(totals.savingCents / 100)],
    ['Expense transactions', String(totals.expenseCount)],
    ['Saving transactions', String(totals.savingCount)],
  ]
  metrics.forEach(([label, value], index) => {
    const x = 15 + index * (metricWidth + 2)
    document.setDrawColor(218, 226, 235)
    document.setFillColor(248, 250, 252)
    document.roundedRect(x, metricY, metricWidth, 20, 2, 2, 'FD')
    document.setTextColor(89, 105, 121)
    document.setFontSize(8)
    document.text(label, x + 4, metricY + 7)
    document.setTextColor(26, 42, 58)
    document.setFont('helvetica', 'bold')
    document.setFontSize(12)
    document.text(value, x + 4, metricY + 15)
    document.setFont('helvetica', 'normal')
  })

  document.setTextColor(26, 42, 58)
  document.setFont('helvetica', 'bold')
  document.setFontSize(12)
  document.text('Category-wise expense analysis', 15, 76)
  if (categoryChart) document.addImage(categoryChart, 'PNG', 15, 81, 115, 82)
  autoTable(document, {
    startY: 81,
    margin: { left: 137, right: 15 },
    head: [['Category', 'Expense total', 'Transactions', 'Share']],
    body: categoryRows.length
      ? categoryRows.map((row) => [row.label || 'Uncategorized', inr(row.amount), String(row.count), `${Number(row.percentage || 0).toFixed(1)}%`])
      : [['No category expenses for this period.', '', '', '']],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [11, 112, 130], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    tableWidth: 'auto',
  })

  document.addPage()
  document.setTextColor(26, 42, 58)
  document.setFont('helvetica', 'bold')
  document.setFontSize(15)
  document.text('Expense and savings comparison', 15, 18)
  document.setFont('helvetica', 'normal')
  document.setFontSize(9)
  document.setTextColor(89, 105, 121)
  document.text('Monthly, daily, or custom-period trend totals. Expenses and savings are shown separately.', 15, 25)
  if (trendsChart) document.addImage(trendsChart, 'PNG', 15, 31, pageWidth - 30, 85)
  document.setTextColor(26, 42, 58)
  document.setFont('helvetica', 'bold')
  document.setFontSize(12)
  document.text('Expense and savings summary', 15, 127)
  autoTable(document, {
    startY: 132,
    margin: { left: 15, right: 15 },
    head: [['Type', 'Total amount', 'Transaction count']],
    body: [
      ['Expenses', inr(totals.expenseCents / 100), String(totals.expenseCount)],
      ['Savings', inr(totals.savingCents / 100), String(totals.savingCount)],
    ],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [11, 112, 130], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 249, 252] },
  })

  document.addPage()
  document.setTextColor(26, 42, 58)
  document.setFont('helvetica', 'bold')
  document.setFontSize(15)
  document.text('Transaction details', 15, 18)
  document.setFont('helvetica', 'normal')
  document.setFontSize(9)
  document.setTextColor(89, 105, 121)
  document.text(`${transactions.length.toLocaleString('en-IN')} records · ${periodLabel}`, 15, 25)
  autoTable(document, {
    startY: 31,
    margin: { top: 12, left: 12, right: 12, bottom: 16 },
    head: [['Date', 'Name / Source', 'Category', 'Type', 'Payment', 'Amount', 'Description']],
    body: transactions.map((transaction) => [
      formatExpenseDate(transaction.transactionDate),
      transaction.name || '',
      transaction.categoryLabel || 'Uncategorized',
      transaction.type === 'expense' ? 'Expense' : 'Saving',
      transaction.payment_mode || '—',
      `${transaction.type === 'saving' ? '+' : '−'}${inr(transaction.amount)}`,
      transaction.description || '—',
    ]),
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [11, 112, 130], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    columnStyles: { 5: { halign: 'right' } },
    didDrawPage: () => {
      document.setFont('helvetica', 'normal')
      document.setFontSize(8)
      document.setTextColor(100, 112, 124)
      document.text(`MagPET · ${periodLabel}`, 12, document.internal.pageSize.getHeight() - 6)
    },
  })

  const pageCount = document.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page)
    document.setFont('helvetica', 'normal')
    document.setFontSize(8)
    document.setTextColor(100, 112, 124)
    document.text(`Page ${page} of ${pageCount}`, pageWidth - 12, document.internal.pageSize.getHeight() - 6, { align: 'right' })
  }
  const safeTitle = title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')
  document.save(`MagPET_${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
