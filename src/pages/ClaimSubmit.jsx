import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText, Upload, Send, CheckCircle2, AlertCircle, 
  Download, RefreshCw, Loader2, Eye, Plus, DollarSign, Clock
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ModernKPI from "@/components/dashboard/ModernKPI";

export default function ClaimSubmit() {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState([]);
  const [subrogations, setSubrogations] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [batches, setBatches] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showSubrogationDialog, setShowSubrogationDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationRemarks, setValidationRemarks] = useState([]);
  const [selectedClaim, setSelectedClaim] = useState('');
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [recoveryDate, setRecoveryDate] = useState('');
  const [subrogationRemarks, setSubrogationRemarks] = useState('');
  const [activeTab, setActiveTab] = useState('claims');
  const [uploadFile, setUploadFile] = useState(null);
  const [parsedClaims, setParsedClaims] = useState([]);
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    claimStatus: 'all',
    subrogationStatus: 'all'
  });

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const loadUser = async () => {
    try {
      const demoUserStr = localStorage.getItem('demo_user');
      if (demoUserStr) {
        setUser(JSON.parse(demoUserStr));
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [claimData, subrogationData, debtorData, batchData, contractData] = await Promise.all([
        base44.entities.Claim.list(),
        base44.entities.Subrogation.list(),
        base44.entities.Debtor.list(),
        base44.entities.Batch.list(),
        base44.entities.Contract.list()
      ]);
      setClaims(claimData || []);
      setSubrogations(subrogationData || []);
      setDebtors(debtorData || []);
      setBatches(batchData || []);
      setContracts(contractData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const downloadTemplate = () => {
    const sampleData = [
      'CERT-001,PT Maju Jaya,1234567890001,FK-001,2025-01,2025-01-15,500000000,375000000,1,2025-06-15,250000000,75,187500000,true,P-001,POL-001',
      'CERT-002,CV Berkah Abadi,1234567890002,FK-002,2025-01,2025-01-16,300000000,225000000,1,2025-06-16,150000000,75,112500000,true,P-002,POL-001'
    ];

    const headers = [
      'nomor_sertifikat', 'nama_tertanggung', 'no_ktp_npwp', 
      'no_fasilitas_kredit', 'bdo_premi', 'tanggal_realisasi_kredit', 'plafond',
      'max_coverage', 'kol_debitur', 'dol', 'nilai_klaim', 'share_tugure_percentage', 
      'share_tugure_amount', 'check_bdo_premi', 'nomor_peserta', 'policy_no'
    ];
    
    const csvContent = headers.join(',') + '\n' + sampleData.join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'claim_template.csv';
    a.click();
  };

  const handleFileUpload = async (file) => {
    if (!file || !selectedBatch) return;
    
    setProcessing(true);
    setErrorMessage('');
    setValidationRemarks([]);
    
    try {
      const batch = batches.find(b => b.id === selectedBatch);
      if (!batch) {
        setErrorMessage('Batch not found');
        setProcessing(false);
        return;
      }

      const batchDebtors = debtors.filter(d => d.batch_id === batch.batch_id);

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      const parsed = [];
      const validationErrors = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        const headers = lines[0].split(',').map(h => h.trim());
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim() || '';
        });
        
        const debtor = batchDebtors.find(d => d.nomor_peserta === row.nomor_peserta);
        
        let rowRemarks = [];
        if (!debtor) {
          rowRemarks.push('Debtor not found in batch');
        } else {
          if (debtor.status !== 'APPROVED') {
            rowRemarks.push('Debtor not approved');
          }
          if (parseFloat(row.nilai_klaim) > (debtor.plafon || 0)) {
            rowRemarks.push(`Exceeds plafond (${debtor.plafon})`);
          }
        }
        
        if (rowRemarks.length > 0) {
          validationErrors.push({ 
            row: i + 1, 
            participant: row.nomor_peserta, 
            issues: rowRemarks 
          });
        }

        parsed.push({
          policy_no: row.policy_no,
          nomor_sertifikat: row.nomor_sertifikat,
          nama_tertanggung: row.nama_tertanggung,
          no_ktp_npwp: row.no_ktp_npwp,
          no_fasilitas_kredit: row.no_fasilitas_kredit,
          bdo_premi: row.bdo_premi,
          tanggal_realisasi_kredit: row.tanggal_realisasi_kredit,
          plafond: parseFloat(row.plafond) || 0,
          max_coverage: parseFloat(row.max_coverage) || 0,
          kol_debitur: row.kol_debitur,
          dol: row.dol,
          nilai_klaim: parseFloat(row.nilai_klaim) || 0,
          share_tugure_percentage: parseFloat(row.share_tugure_percentage) || 0,
          share_tugure_amount: parseFloat(row.share_tugure_amount) || 0,
          check_bdo_premi: row.check_bdo_premi === 'true' || row.check_bdo_premi === true,
          validation_remarks: rowRemarks.join('; '),
          debtor_id: debtor?.id,
          contract_id: debtor?.contract_id,
          batch_id: debtor?.batch_id
        });
      }
      
      setParsedClaims(parsed);
      setValidationRemarks(validationErrors);
      
      if (validationErrors.length > 0) {
        setErrorMessage(`${validationErrors.length} validation issues found`);
      } else {
        setSuccessMessage(`Parsed ${parsed.length} claims - all validated`);
      }
    } catch (error) {
      console.error('Parse error:', error);
      setErrorMessage('Failed to parse file');
    }
    setProcessing(false);
  };

  const handleBulkUpload = async () => {
    if (parsedClaims.length === 0 || !selectedBatch) return;

    setProcessing(true);
    
    try {
      const batch = batches.find(b => b.id === selectedBatch);
      if (!batch) {
        setErrorMessage('Batch not found');
        setProcessing(false);
        return;
      }

      // Validate Nota payment
      const batchNotas = await base44.entities.Nota.filter({ 
        reference_id: batch.batch_id,
        nota_type: 'Batch'
      });

      const hasCompletedPayment = batchNotas.some(n => n.status === 'Paid');

      if (!hasCompletedPayment) {
        setErrorMessage(`❌ BLOCKED: Claim submission not allowed. Nota must be PAID first.`);
        
        await base44.entities.AuditLog.create({
          action: 'BLOCKED_CLAIM_SUBMISSION',
          module: 'CLAIM',
          entity_type: 'Batch',
          entity_id: batch.id,
          old_value: '{}',
          new_value: JSON.stringify({ blocked_reason: 'Nota not PAID' }),
          user_email: user?.email,
          user_role: user?.role,
          reason: 'Attempted claim submission before Nota payment'
        });

        setProcessing(false);
        return;
      }

      let uploaded = 0;
      
      for (const claim of parsedClaims) {
        if (claim.validation_remarks) continue;
        
        // AUTO-GENERATE claim_no: CLM-YYYY-MM-XXXXXX
        const now = new Date();
        const claimNo = `CLM-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(uploaded + 1).padStart(6, '0')}`;
        
        await base44.entities.Claim.create({
          claim_no: claimNo,
          policy_no: claim.policy_no,
          nomor_sertifikat: claim.nomor_sertifikat,
          nama_tertanggung: claim.nama_tertanggung,
          no_ktp_npwp: claim.no_ktp_npwp,
          no_fasilitas_kredit: claim.no_fasilitas_kredit,
          bdo_premi: claim.bdo_premi,
          tanggal_realisasi_kredit: claim.tanggal_realisasi_kredit,
          plafond: claim.plafond,
          max_coverage: claim.max_coverage,
          kol_debitur: claim.kol_debitur,
          dol: claim.dol,
          nilai_klaim: claim.nilai_klaim,
          share_tugure_percentage: claim.share_tugure_percentage,
          share_tugure_amount: claim.share_tugure_amount,
          check_bdo_premi: claim.check_bdo_premi,
          debtor_id: claim.debtor_id || '',
          contract_id: claim.contract_id || '',
          batch_id: batch.batch_id,
          status: 'Draft',
          version_no: 1
        });
        
        uploaded++;
      }
      
      setSuccessMessage(`✓ Uploaded ${uploaded} claims successfully`);
      setShowUploadDialog(false);
      setParsedClaims([]);
      setSelectedBatch('');
      loadData();
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMessage('Failed to upload claims');
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Claim Submission"
        subtitle="Submit reinsurance claims per batch"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Claim Submit' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button onClick={() => setShowUploadDialog(true)} className="bg-blue-600">
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </Button>
          </div>
        }
      />

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {validationRemarks.length > 0 && (
        <Card className="border-orange-300 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-700">Validation Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {validationRemarks.map((remark, idx) => (
                <Alert key={idx} className="bg-orange-100 border-orange-300">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    <strong>Row {remark.row} ({remark.participant}):</strong> {remark.issues.join(', ')}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
            <Button 
              className="mt-3 bg-orange-600"
              size="sm"
              onClick={() => setShowRevisionDialog(true)}
            >
              Re-upload Revised Only
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ModernKPI 
          title="Total Claims" 
          value={claims.length} 
          subtitle={`Rp ${(claims.reduce((s, c) => s + (c.nilai_klaim || 0), 0) / 1000000).toFixed(1)}M`}
          icon={FileText}
          color="blue"
        />
        <ModernKPI 
          title="Draft Claims" 
          value={claims.filter(c => c.status === 'Draft').length}
          subtitle="Pending check"
          icon={Clock}
          color="orange"
        />
        <ModernKPI 
          title="Total Subrogation" 
          value={subrogations.length}
          subtitle={`Rp ${(subrogations.reduce((s, sub) => s + (sub.recovery_amount || 0), 0) / 1000000).toFixed(1)}M`}
          icon={DollarSign}
          color="green"
        />
        <ModernKPI 
          title="Recovered" 
          value={subrogations.filter(s => s.status === 'Paid / Closed').length}
          subtitle="Completed"
          icon={CheckCircle2}
          color="purple"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select value={filters.contract} onValueChange={(val) => setFilters({...filters, contract: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Contract" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input placeholder="Batch ID..." value={filters.batch} onChange={(e) => setFilters({...filters, batch: e.target.value})} />
            <Select value={filters.claimStatus} onValueChange={(val) => setFilters({...filters, claimStatus: val})}>
              <SelectTrigger><SelectValue placeholder="Claim Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Claim Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Checked">Checked</SelectItem>
                <SelectItem value="Doc Verified">Doc Verified</SelectItem>
                <SelectItem value="Invoiced">Invoiced</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.subrogationStatus} onValueChange={(val) => setFilters({...filters, subrogationStatus: val})}>
              <SelectTrigger><SelectValue placeholder="Subrogation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subrogation</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Invoiced">Invoiced</SelectItem>
                <SelectItem value="Paid / Closed">Paid / Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setFilters({contract: 'all', batch: '', claimStatus: 'all', subrogationStatus: 'all'})}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="claims">
            <FileText className="w-4 h-4 mr-2" />
            Claims ({claims.length})
          </TabsTrigger>
          <TabsTrigger value="subrogation">
            <DollarSign className="w-4 h-4 mr-2" />
            Subrogation ({subrogations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="mt-4">
          <DataTable
            columns={[
              { header: 'Claim No', accessorKey: 'claim_no' },
              { header: 'Debtor', accessorKey: 'nama_tertanggung' },
              { header: 'Claim Amount', cell: (row) => `Rp ${(row.nilai_klaim || 0).toLocaleString('id-ID')}` },
              { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> }
            ]}
            data={claims.filter(c => {
              if (filters.contract !== 'all' && c.contract_id !== filters.contract) return false;
              if (filters.batch && !c.debtor_id) return false;
              if (filters.claimStatus !== 'all' && c.status !== filters.claimStatus) return false;
              return true;
            })}
            isLoading={loading}
            emptyMessage="No claims submitted"
          />
        </TabsContent>

        <TabsContent value="subrogation" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setShowSubrogationDialog(true)} className="bg-green-600">
              <Plus className="w-4 h-4 mr-2" />
              New Subrogation
            </Button>
          </div>
          <DataTable
            columns={[
              { header: 'Subrogation ID', accessorKey: 'subrogation_id' },
              { header: 'Claim ID', accessorKey: 'claim_id' },
              { header: 'Recovery Amount', cell: (row) => `Rp ${(row.recovery_amount || 0).toLocaleString()}` },
              { header: 'Recovery Date', accessorKey: 'recovery_date' },
              { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> }
            ]}
            data={subrogations.filter(s => {
              if (filters.subrogationStatus !== 'all' && s.status !== filters.subrogationStatus) return false;
              return true;
            })}
            isLoading={loading}
            emptyMessage="No subrogation records"
          />
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Claims</DialogTitle>
            <DialogDescription>Select batch and upload CSV file</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Batch *</Label>
              <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_id} ({b.batch_month}/{b.batch_year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Upload File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadFile(file);
                    handleFileUpload(file);
                  }
                }}
                disabled={!selectedBatch}
              />
            </div>
            {parsedClaims.length > 0 && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  Parsed {parsedClaims.length} claims
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadDialog(false);
              setParsedClaims([]);
              setSelectedBatch('');
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkUpload}
              disabled={processing || parsedClaims.length === 0}
              className="bg-blue-600"
            >
              {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : `Upload ${parsedClaims.length} Claims`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision Dialog */}
      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-upload Revised Claims</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Upload only revised rows that had issues
              </AlertDescription>
            </Alert>
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                  setShowRevisionDialog(false);
                }
              }}
              className="mt-4"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevisionDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subrogation Dialog */}
      <Dialog open={showSubrogationDialog} onOpenChange={setShowSubrogationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Subrogation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Claim</Label>
              <Select value={selectedClaim} onValueChange={setSelectedClaim}>
                <SelectTrigger>
                  <SelectValue placeholder="Select paid claim" />
                </SelectTrigger>
                <SelectContent>
                  {claims.filter(c => c.status === 'Paid').map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.claim_no} - {c.nama_tertanggung}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recovery Amount</Label>
              <Input type="number" value={recoveryAmount} onChange={(e) => setRecoveryAmount(e.target.value)} />
            </div>
            <div>
              <Label>Recovery Date</Label>
              <Input type="date" value={recoveryDate} onChange={(e) => setRecoveryDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubrogationDialog(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!selectedClaim || !recoveryAmount) return;
              const claim = claims.find(c => c.id === selectedClaim);
              await base44.entities.Subrogation.create({
                subrogation_id: `SUB-${Date.now()}`,
                claim_id: claim.claim_no,
                debtor_id: claim.debtor_id,
                recovery_amount: parseFloat(recoveryAmount),
                recovery_date: recoveryDate,
                status: 'Draft'
              });
              setSuccessMessage('Subrogation created');
              setShowSubrogationDialog(false);
              setSelectedClaim('');
              setRecoveryAmount('');
              setRecoveryDate('');
              loadData();
            }} disabled={!selectedClaim || !recoveryAmount}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}