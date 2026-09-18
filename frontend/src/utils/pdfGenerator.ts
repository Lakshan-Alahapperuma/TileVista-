import { jsPDF } from 'jspdf';
import { formatCurrency } from './index';

export interface PDFOrderData {
  orderReference: string;
  customerName: string;
  phone: string;
  email?: string;
  createdAt: string;
  status: string;
  approvalType?: string;
  totalAmount: number;
  items: {
    name: string;
    sku?: string;
    osposItemId?: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
}

/**
 * Downloads a crisp, professionally formatted A4 PDF file for the quotation reference using jsPDF.
 */
export function downloadQuotationPDF(data: PDFOrderData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isApproved = data.status === 'approved';
  const statusLabel = isApproved ? 'APPROVED (Stock Reserved)' : 'PENDING ADMIN APPROVAL';

  // 1. Branding Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 26, 26);
  doc.text('ALAHAPPERUMA TRADE CENTER', 15, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(140, 122, 107);
  doc.text('TileVista Showroom Quotation & Order Reference', 15, 26);

  // Reference Box (Right side)
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('SHOWROOM REFERENCE ID', 145, 18);

  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(220, 38, 38);
  doc.text(data.orderReference, 145, 25);

  // Horizontal divider
  doc.setDrawColor(26, 26, 26);
  doc.setLineWidth(0.5);
  doc.line(15, 30, 195, 30);

  // 2. Info Boxes
  let y = 38;

  // Box 1: Customer Details
  doc.setFillColor(249, 249, 247);
  doc.setDrawColor(220, 220, 220);
  doc.rect(15, y, 85, 32, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(140, 122, 107);
  doc.text('CUSTOMER INFORMATION', 19, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Name:', 19, y + 13);
  doc.text('Phone:', 19, y + 20);
  doc.text('Email:', 19, y + 27);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 26);
  doc.text(data.customerName, 35, y + 13);
  doc.text(data.phone, 35, y + 20);
  doc.text(data.email || 'N/A', 35, y + 27);

  // Box 2: Order & Status Details
  doc.setFillColor(249, 249, 247);
  doc.rect(110, y, 85, 32, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(140, 122, 107);
  doc.text('ORDER & STATUS SUMMARY', 114, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Date:', 114, y + 13);
  doc.text('Status:', 114, y + 20);
  doc.text('Pickup:', 114, y + 27);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 26);
  doc.text(new Date(data.createdAt).toLocaleDateString(), 130, y + 13);

  if (isApproved) {
    doc.setTextColor(4, 120, 87);
  } else {
    doc.setTextColor(217, 119, 6);
  }
  doc.text(statusLabel, 130, y + 20);

  doc.setTextColor(26, 26, 26);
  doc.text('Matara Showroom Counter', 130, y + 27);

  y += 42;

  // 3. Products Table Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(140, 122, 107);
  doc.text('SELECTED PRODUCTS & QUANTITIES', 15, y);

  y += 4;
  doc.setFillColor(26, 26, 26);
  doc.rect(15, y, 180, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Product Name', 18, y + 5);
  doc.text('Item SKU', 90, y + 5);
  doc.text('Qty', 130, y + 5);
  doc.text('Unit Price', 150, y + 5);
  doc.text('Subtotal', 175, y + 5);

  y += 7;

  // Table Body Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  data.items.forEach((item, index) => {
    const bg = index % 2 === 0 ? 255 : 249;
    doc.setFillColor(bg, bg, bg);
    doc.rect(15, y, 180, 8, 'F');

    doc.setTextColor(26, 26, 26);
    const truncatedName = item.name.length > 35 ? item.name.substring(0, 32) + '...' : item.name;
    doc.text(truncatedName, 18, y + 5.5);

    doc.setFont('courier', 'normal');
    doc.text(item.sku || `ITEM-${item.osposItemId}`, 90, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.text(`${item.quantity} pcs`, 130, y + 5.5);
    doc.text(formatCurrency(item.unitPrice), 150, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(item.subtotal), 175, y + 5.5);

    y += 8;
  });

  // Total Summary Box
  y += 6;
  doc.setFillColor(243, 239, 233);
  doc.setDrawColor(212, 197, 185);
  doc.rect(120, y, 75, 16, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(140, 122, 107);
  doc.text('TOTAL QUOTATION AMOUNT', 124, y + 6);

  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 26, 26);
  doc.text(formatCurrency(data.totalAmount), 124, y + 12);

  y += 24;

  // 4. Instructions Card (Auto-wrapping text)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const line1 = doc.splitTextToSize(
    `Present this reference (${data.orderReference}) at the Alahapperuma Trade Center showroom in Matara to inspect physical stock and complete your purchase.`,
    170
  );
  const line2 = doc.splitTextToSize(
    `Reserved items are held for up to 5 days under TileVista inventory reservation rules. Showroom purchase completion is finalized at the Matara POS counter.`,
    170
  );

  const allInstructionLines = [...line1, ...line2];
  const lineHeight = 4.5;
  const boxHeight = 10 + allInstructionLines.length * lineHeight + 2;

  doc.setFillColor(253, 251, 247);
  doc.setDrawColor(212, 197, 185);
  doc.rect(15, y, 180, boxHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(26, 26, 26);
  doc.text('Important Showroom Instructions:', 19, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);

  let textY = y + 11;
  allInstructionLines.forEach((line) => {
    doc.text(line, 19, textY);
    textY += lineHeight;
  });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text('Alahapperuma Trade Center • Matara, Sri Lanka • TileVista Showroom OS', 105, 285, { align: 'center' });

  // Save / Download PDF file
  doc.save(`Quotation_${data.orderReference}.pdf`);
}
