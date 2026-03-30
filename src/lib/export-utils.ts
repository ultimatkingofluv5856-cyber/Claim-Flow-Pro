// ============= CSV/Excel Export Utility =============

export function exportToCSV(data: any[], filename: string, columns: { key: string; label: string }[]) {
  if (!data.length) return;

  const header = columns.map(c => `"${c.label}"`).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key] ?? '';
      // Escape quotes and wrap in quotes
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export function exportToHTML(htmlContent: string, filename: string) {
  const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${filename}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
  th { background: #f5f5f5; font-weight: bold; }
  .text-right { text-align: right; }
  h2 { color: #2563eb; margin-bottom: 10px; }
  .summary { margin-bottom: 20px; }
  @media print { body { padding: 0; } }
</style>
</head><body>${htmlContent}</body></html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
  downloadBlob(blob, `${filename}.html`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Format date for exports
export function formatExportDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Export claims data
export function exportClaimsCSV(claims: any[]) {
  exportToCSV(claims.map(c => ({
    claimId: c.claimId,
    date: formatExportDate(c.date),
    submittedBy: c.submittedBy,
    site: c.site,
    withBill: (c.totalWithBill ?? 0).toFixed(2),
    withoutBill: (c.totalWithoutBill ?? 0).toFixed(2),
    total: (c.amount ?? 0).toFixed(2),
    status: c.status,
  })), 'claims-report', [
    { key: 'claimId', label: 'Claim ID' },
    { key: 'date', label: 'Date' },
    { key: 'submittedBy', label: 'Submitted By' },
    { key: 'site', label: 'Site' },
    { key: 'withBill', label: 'With Bill (₹)' },
    { key: 'withoutBill', label: 'Without Bill (₹)' },
    { key: 'total', label: 'Total (₹)' },
    { key: 'status', label: 'Status' },
  ]);
}

// Export transactions data
export function exportTransactionsCSV(transactions: any[]) {
  exportToCSV(transactions.map(t => ({
    date: formatExportDate(t.createdAt),
    email: t.email,
    type: t.type,
    credit: t.credit?.toFixed(2) || '0.00',
    debit: t.debit?.toFixed(2) || '0.00',
    balance: t.balanceAfter?.toFixed(2) || '0.00',
    description: t.description || '',
    claimId: t.claimId || '',
  })), 'transactions-report', [
    { key: 'date', label: 'Date' },
    { key: 'email', label: 'User Email' },
    { key: 'type', label: 'Type' },
    { key: 'credit', label: 'Credit (₹)' },
    { key: 'debit', label: 'Debit (₹)' },
    { key: 'balance', label: 'Balance After (₹)' },
    { key: 'description', label: 'Description' },
    { key: 'claimId', label: 'Claim ID' },
  ]);
}

// Export voucher as printable HTML
export function exportVoucherHTML(voucher: any) {
  const expenseRows = (voucher.expenses || []).map((e: any) =>
    `<tr>
      <td>${e.category}</td>
      <td>${e.description || ''}</td>
      <td class="text-right">₹${(e.amountWithBill ?? 0).toFixed(2)}</td>
      <td class="text-right">₹${(e.amountWithoutBill ?? 0).toFixed(2)}</td>
      <td class="text-right"><strong>₹${(e.amount ?? 0).toFixed(2)}</strong></td>
    </tr>`
  ).join('');

  const html = `
    <h2>PAYMENT VOUCHER</h2>
    <div class="summary">
      <p><strong>Voucher No:</strong> ${voucher.claimId}</p>
      <p><strong>Date:</strong> ${formatExportDate(voucher.date)}</p>
      <p><strong>Paid To:</strong> ${voucher.submittedBy}</p>
      <p><strong>Site:</strong> ${voucher.site}</p>
    </div>
    <table>
      <thead><tr><th>Category</th><th>Description</th><th class="text-right">With Bill</th><th class="text-right">Without Bill</th><th class="text-right">Total</th></tr></thead>
      <tbody>
        ${expenseRows}
        <tr style="font-weight:bold;background:#f5f5f5">
          <td colspan="2" class="text-right">TOTAL</td>
          <td class="text-right">₹${(voucher.totalWithBill ?? 0).toFixed(2)}</td>
          <td class="text-right">₹${(voucher.totalWithoutBill ?? 0).toFixed(2)}</td>
          <td class="text-right">₹${(voucher.amount ?? 0).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:40px;margin-top:60px;text-align:center;font-size:13px">
      <div style="border-top:1px solid #333;padding-top:8px">Prepared By</div>
      <div style="border-top:1px solid #333;padding-top:8px">Checked By</div>
      <div style="border-top:1px solid #333;padding-top:8px">Approved By</div>
    </div>`;

  exportToHTML(html, `voucher-${voucher.claimId}`);
}

// Export balances data
export function exportBalancesCSV(balances: any[]) {
  exportToCSV(balances.map(b => ({
    name: b.name,
    email: b.email,
    role: b.role,
    initialAdvance: b.initialAdvance?.toFixed(2) || '0.00',
    totalClaimed: b.totalClaimAmount?.toFixed(2) || '0.00',
    pending: b.pendingClaims?.toFixed(2) || '0.00',
    approved: b.approvedClaims?.toFixed(2) || '0.00',
    balance: b.currentBalance?.toFixed(2) || '0.00',
  })), 'user-balances', [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'initialAdvance', label: 'Initial Advance (₹)' },
    { key: 'totalClaimed', label: 'Total Claimed (₹)' },
    { key: 'pending', label: 'Pending (₹)' },
    { key: 'approved', label: 'Approved (₹)' },
    { key: 'balance', label: 'Current Balance (₹)' },
  ]);
}
