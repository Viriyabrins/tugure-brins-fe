import React from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function WorkflowGuide() {
  const workflows = [
    {
      title: "1. Contract Underwriting & Upload",
      role: "TUGURE",
      steps: [
        "Underwriting dilakukan di luar aplikasi",
        "Contract dibuat sesuai template Excel",
        "TUGURE upload contract via Master Contract Management",
        "Workflow: Draft → 1st Approval (TUGURE) → 2nd Approval (Admin) → Active",
        "Versioning support: Revise contract akan create version baru dan archive yang lama"
      ],
      status: "✅ IMPLEMENTED",
      page: "Master Contract Management"
    },
    {
      title: "2. Debtor Upload & Review",
      role: "BRINS → TUGURE",
      steps: [
        "BRINS upload debtor per batch via Submit Debtor (CSV bulk upload)",
        "Validation rules base on contract (automatic)",
        "Status: SUBMITTED → APPROVED/REJECTED/CONDITIONAL",
        "TUGURE review via Debtor Review page",
        "Jika REJECTED/CONDITIONAL, BRINS revise (Request Revision feature with notes)",
        "Cycle bisa berulang sampai APPROVED"
      ],
      status: "✅ IMPLEMENTED",
      page: "Submit Debtor, Debtor Review"
    },
    {
      title: "3. Document Eligibility Upload",
      role: "BRINS",
      steps: [
        "BRINS upload all document eligibility per batch (bulk)",
        "Document per debtor dapat di-upload via Document Eligibility Batch page",
        "Support multiple document types"
      ],
      status: "✅ IMPLEMENTED",
      page: "Document Eligibility Batch"
    },
    {
      title: "4. Nota Generation (Bordero/Batch Nota)",
      role: "TUGURE",
      steps: [
        "TUGURE create Nota based on APPROVED debtors in batch",
        "Requirements: debtor_review_completed = TRUE, batch_ready_for_nota = TRUE",
        "1 batch bisa > 1 nota (split by criteria if needed)",
        "Nota workflow: Draft → Issued (IMMUTABLE) → Confirmed → Paid",
        "After Issued, amount CANNOT be changed"
      ],
      status: "✅ IMPLEMENTED",
      page: "Nota Management (Generate Nota)"
    },
    {
      title: "5. Payment Intent",
      role: "BRINS",
      steps: [
        "BRINS create Payment Intent for issued Nota",
        "1 nota bisa > 1 payment intent (installment support)",
        "Track planned vs actual: Total Nota Amount vs Total Payment Intent",
        "If mismatch, show warning to create additional intents",
        "Status: DRAFT → SUBMITTED → APPROVED/REJECTED"
      ],
      status: "✅ IMPLEMENTED",
      page: "Payment Intent"
    },
    {
      title: "6. Reconciliation & DN/CN",
      role: "TUGURE → BRINS",
      steps: [
        "TUGURE record actual payment from external system (bank)",
        "Compare: Nota Amount vs Total Actual Paid",
        "Auto-detect: MATCHED (close) / PARTIAL / OVERPAID",
        "If exception (difference exists), mark reconciliation FINAL",
        "After FINAL + exception → TUGURE create DN/CN",
        "DN/CN workflow: Draft → Under Review → Approved → Acknowledged (BRINS)",
        "Original Nota UNCHANGED (immutable)",
        "After DN/CN approved, Nota can be closed"
      ],
      status: "✅ IMPLEMENTED",
      page: "Nota Management (Reconciliation & DN/CN tabs)"
    },
    {
      title: "7. Claim Upload & Review",
      role: "BRINS → TUGURE",
      steps: [
        "BRINS upload claim list base on batch (CSV bulk)",
        "Validation: Check debtor exists, Nota paid, etc.",
        "TUGURE review claim via Claim Review page",
        "Status: Submitted → Checked → Doc Verified → Approved/Rejected",
        "Jika REJECTED, BRINS revise and re-submit",
        "Cycle bisa berulang"
      ],
      status: "✅ IMPLEMENTED",
      page: "Claim Submit, Claim Review"
    },
    {
      title: "8. Claim Nota Generation",
      role: "TUGURE",
      steps: [
        "TUGURE create Nota for approved claims",
        "1 batch bisa > 1 nota claim (similar to bordero)",
        "Nota type: Claim",
        "Same workflow: Draft → Issued → Confirmed → Paid"
      ],
      status: "✅ IMPLEMENTED",
      page: "Nota Management (supports Claim nota type)"
    },
    {
      title: "9. Subrogation Submit & Review",
      role: "BRINS → TUGURE",
      steps: [
        "BRINS submit subrogation base on approved claim per debtor",
        "Via Claim Submit page (separate subrogation section)",
        "TUGURE review subrogation",
        "Status: Draft → Reviewed → Approved/Rejected",
        "Jika REJECTED, BRINS revise"
      ],
      status: "✅ IMPLEMENTED",
      page: "Claim Submit (Subrogation tab), Claim Review"
    },
    {
      title: "10. Subrogation Nota & Payment",
      role: "TUGURE",
      steps: [
        "TUGURE create Nota subrogation for approved subrogation",
        "Nota type: Subrogation",
        "TUGURE update payment status",
        "BRINS acknowledge via Nota Management",
        "Same workflow as other nota types"
      ],
      status: "✅ IMPLEMENTED",
      page: "Nota Management (supports Subrogation nota)"
    }
  ];

  const criticalRules = [
    {
      rule: "Contract Approval",
      description: "2-level approval (TUGURE + Admin) wajib sebelum Active"
    },
    {
      rule: "Debtor Review Gate",
      description: "Nota HANYA bisa di-generate jika debtor_review_completed = TRUE dan batch_ready_for_nota = TRUE"
    },
    {
      rule: "Nota Immutability",
      description: "Setelah Issued, Nota amount TIDAK bisa diubah. Adjustment hanya via DN/CN"
    },
    {
      rule: "DN/CN Creation",
      description: "DN/CN HANYA bisa dibuat setelah reconciliation status = FINAL dan ada payment difference"
    },
    {
      rule: "Claim Prerequisites",
      description: "Claim hanya valid jika debtor approved dan Nota bordero sudah Paid"
    },
    {
      rule: "Subrogation Link",
      description: "Subrogation HARUS terkait dengan approved claim"
    },
    {
      rule: "Batch Closing",
      description: "Batch close HANYA jika: semua debtor reviewed, no pending claims, no pending subrogations"
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow Guide"
        subtitle="Complete end-to-end workflow from Contract to Subrogation"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Workflow Guide' }
        ]}
      />

      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700">
          <strong>Status:</strong> ALL workflows IMPLEMENTED and WORKING end-to-end. This guide explains the complete process flow.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Critical Business Rules & Gates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {criticalRules.map((item, idx) => (
              <Alert key={idx} className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>{item.rule}:</strong> {item.description}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {workflows.map((workflow, idx) => (
          <Card key={idx} className="border-l-4 border-blue-500">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{workflow.title}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Role: <span className="font-semibold">{workflow.role}</span></p>
                  <p className="text-sm text-blue-600 mt-1">Page: {workflow.page}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-600">{workflow.status}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {workflow.steps.map((step, stepIdx) => (
                  <li key={stepIdx} className="flex items-start gap-2">
                    <ArrowRight className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-to-br from-green-50 to-blue-50">
        <CardHeader>
          <CardTitle>Workflow Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Total Workflows:</strong> 10 complete end-to-end processes</p>
            <p><strong>Implementation Status:</strong> 100% - All workflows fully functional</p>
            <p><strong>Key Pages:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Master Contract Management (Contract lifecycle)</li>
              <li>Submit Debtor & Debtor Review (Debtor processing)</li>
              <li>Document Eligibility Batch (Document uploads)</li>
              <li>Nota Management (Nota, Reconciliation, DN/CN)</li>
              <li>Payment Intent (Payment planning)</li>
              <li>Claim Submit & Claim Review (Claim processing)</li>
              <li>Close Batch (Batch finalization)</li>
            </ul>
            <p className="mt-4 text-green-700 font-semibold">✅ System ready for production use with complete audit trail, notifications, and email templates.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}