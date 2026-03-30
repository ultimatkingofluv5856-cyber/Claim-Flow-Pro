import { describe, expect, it } from 'vitest';
import { getTemplate } from '../../supabase/functions/send-notification/emailTemplates';

const baseData = {
  companyName: 'Irrigation Products International Pvt Ltd',
  companySubtitle: 'Claims Management System',
  supportEmail: 'projects@ipi-india.com',
  logoUrl: '/ipi-logo.jpg',
  appUrl: 'https://github-upload-ready-full-20260329.vercel.app',
  currency: '₹',
  claim_no: 'CLM-1004',
  employee_name: 'Adithya',
  project_site: '3000-Irri',
  submission_date: '2026-03-29T10:30:00.000Z',
  original_total: 960,
  reviewed_total: 900,
  deduction_total: 60,
  total: 900,
  approved_by: 'manager@example.com',
  rejected_by: 'manager@example.com',
  reason: 'Amount exceeds approved travel cap',
  items: [
    {
      category: 'Travel',
      projectCode: '3000-Irri',
      claimDate: '2026-03-19',
      description: 'Travel to site',
      amount: 960,
      totalAmount: 960,
      approvedAmount: 900,
      deductionAmount: 60,
      remarks: 'Cap applied',
    },
  ],
  attachments: [
    {
      name: 'receipt.jpg',
      url: 'https://example.com/receipt.jpg',
    },
  ],
};

describe('email templates', () => {
  it('renders approval emails with claim summary and line-item details', () => {
    const { html } = getTemplate('claim_approved', {
      ...baseData,
      status: 'Fully Approved',
    });

    expect(html).toContain('Claim Summary');
    expect(html).toContain('Original Total');
    expect(html).toContain('Deducted Total');
    expect(html).toContain('Final Settled Total');
    expect(html).toContain('Travel');
    expect(html).toContain('Travel to site');
  });

  it('renders rejection emails with stage and reason context', () => {
    const { html } = getTemplate('claim_rejected', {
      ...baseData,
      rejected_stage: 'Final Approval',
    });

    expect(html).toContain('Claim Summary');
    expect(html).toContain('Rejected At');
    expect(html).toContain('Final Approval');
    expect(html).toContain('Amount exceeds approved travel cap');
    expect(html).toContain('receipt.jpg');
  });

  it('renders final approval request emails with action buttons and reviewed totals', () => {
    const { html } = getTemplate('claim_submitted_manager', {
      ...baseData,
      manager_status: 'Pending Final Approval',
      admin_status: 'Verified',
      admin_remarks: 'Admin verified after deduction',
      total_amount: 900,
      approve_link: 'https://github-upload-ready-full-20260329.vercel.app/claim-action?claimId=C-1&role=manager&action=approve',
      reject_link: 'https://github-upload-ready-full-20260329.vercel.app/claim-action?claimId=C-1&role=manager&action=reject',
      review_link: 'https://github-upload-ready-full-20260329.vercel.app/claim-action?claimId=C-1&role=manager',
    });

    expect(html).toContain('Final Approval Required');
    expect(html).toContain('Approval Actions');
    expect(html).toContain('Approve Claim');
    expect(html).toContain('Reject Claim');
    expect(html).toContain('Admin Modification Note');
    expect(html).toContain('Final Total');
  });
});
