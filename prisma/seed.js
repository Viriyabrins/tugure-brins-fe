import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contract = await prisma.contract.create({
    data: {
      contract_number: 'CTR-0001',
      contract_name: 'BRINS Core Coverage',
      credit_type: 'Individual',
      coverage_percentage: '70.5',
      premium_rate: '0.15',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-12-31')
    }
  });

  await prisma.masterContract.create({
    data: {
      contract_id: 'MC-1001',
      policy_no: 'POLICY-34',
      product_type: 'Treaty',
      credit_type: 'Individual',
      coverage_start_date: new Date('2025-01-01'),
      coverage_end_date: new Date('2025-12-31')
    }
  });

  await prisma.auditLog.create({
    data: {
      action: 'seed',
      module: 'SYSTEM',
      user_email: 'seed@brins.local'
    }
  });

  await prisma.batch.create({
    data: {
      batch_id: 'BATCH-1001',
      contract_id: contract.contract_number,
      total_records: 12,
      total_exposure: '1200000',
      total_premium: '75000',
      final_exposure_amount: '1180000',
      final_premium_amount: '74000'
    }
  });

  await prisma.bordero.create({
    data: {
      bordero_id: 'BORD-01',
      contract_id: contract.contract_number,
      batch_id: 'BATCH-1001',
      period: '2025-01'
    }
  });

  const debtor = await prisma.debtor.create({
    data: {
      batch_id: 'BATCH-1001',
      nomor_peserta: 'NP-301',
      nama_peserta: 'PT Bunga Raya'
    }
  });

  await prisma.document.create({
    data: {
      document_name: 'debtor-profile.pdf',
      debtor_id: debtor.id,
      batch_id: 'BATCH-1001',
      status: 'VERIFIED'
    }
  });

  const claim = await prisma.claim.create({
    data: {
      claim_no: 'CLM-001',
      nama_tertanggung: 'PT Bunga Raya',
      nilai_klaim: '25000000',
      batch_id: 'BATCH-1001'
    }
  });

  await prisma.nota.create({
    data: {
      nota_number: 'NOTA-01',
      nota_type: 'Batch',
      reference_id: 'BATCH-1001',
      contract_id: contract.contract_number,
      amount: '5000000'
    }
  });

  await prisma.debitCreditNote.create({
    data: {
      note_number: 'DN-001',
      note_type: 'Debit Note',
      original_nota_id: 'NOTA-01',
      batch_id: 'BATCH-1001',
      contract_id: contract.contract_number,
      adjustment_amount: '250000',
      reason_code: 'RC-001'
    }
  });

  const invoice = await prisma.invoice.create({
    data: {
      invoice_number: 'INV-1001',
      contract_id: contract.contract_number,
      total_amount: '5000000',
      outstanding_amount: '5000000'
    }
  });

  await prisma.paymentIntent.create({
    data: {
      intent_id: 'INT-001',
      invoice_id: invoice.invoice_number,
      planned_amount: '5000000',
      planned_date: new Date()
    }
  });

  await prisma.payment.create({
    data: {
      payment_ref: 'PAY-001',
      invoice_id: invoice.invoice_number,
      amount: '5000000',
      payment_date: new Date()
    }
  });

  await prisma.reconciliation.create({
    data: {
      recon_id: 'RECON-01',
      contract_id: contract.contract_number,
      period: '2025-01',
      total_invoiced: '5000000',
      total_paid: '5000000',
      difference: '0'
    }
  });

  await prisma.record.create({
    data: {
      batch_id: 'BATCH-1001',
      debtor_id: debtor.id
    }
  });

  await prisma.notificationSetting.create({
    data: {
      full_name: 'Seed Admin',
      user_email: 'admin@brins.local',
      user_role: 'ADMIN'
    }
  });

  await prisma.notification.create({
    data: {
      title: 'Welcome',
      message: 'Seed data loaded',
      target_role: 'ADMIN'
    }
  });

  await prisma.emailTemplate.create({
    data: {
      object_type: 'Batch',
      status_to: 'Validated',
      recipient_role: 'BRINS',
      email_subject: 'Batch validated',
      email_body: 'Batch {batch_id} has been validated.'
    }
  });

  await prisma.slaRule.create({
    data: {
      rule_name: 'Batch Review',
      entity_type: 'Batch',
      trigger_condition: 'STATUS_DURATION',
      recipient_role: 'ADMIN'
    }
  });

  await prisma.subrogation.create({
    data: {
      subrogation_id: 'SUB-001',
      claim_id: claim.claim_no,
      debtor_id: debtor.id,
      recovery_amount: '1000000',
      recovery_date: new Date()
    }
  });

  await prisma.systemConfig.create({
    data: {
      config_type: 'STATUS_REFERENCE',
      config_key: 'batch_status',
      config_value: 'Uploaded'
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
