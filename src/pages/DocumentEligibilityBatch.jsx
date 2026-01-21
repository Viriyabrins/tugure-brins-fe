import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, RefreshCw, Eye, Folder, File,
  CheckCircle2, AlertCircle, Plus, Download, DollarSign, Clock
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import ModernKPI from "@/components/dashboard/ModernKPI";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";

export default function DocumentEligibilityBatch() {
  const [user, setUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    batchStatus: 'all',
    docStatus: 'all',
    version: 'all',
    startDate: '',
    endDate: ''
  });
  const [selectedDocs, setSelectedDocs] = useState([]);

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const loadUser = () => {
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
      const [batchData, debtorData, docData, contractData] = await Promise.all([
        base44.entities.Batch.list(),
        base44.entities.Debtor.list(),
        base44.entities.Document.list(),
        base44.entities.MasterContract.list()
      ]);
      setBatches(batchData || []);
      setDebtors(debtorData || []);
      setDocuments((docData || []).filter(d => !d.claim_id));
      
      const activeContracts = contractData.filter(c => c.effective_status === 'Active');
      setContracts(activeContracts || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const getBatchDocuments = (batchId) => {
    return documents.filter(d => d.batch_id === batchId);
  };

  const handleBulkUpload = async () => {
    if (!selectedBatch || uploadFiles.length === 0) {
      setErrorMessage('Please select files to upload');
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    try {
      const batch = batches.find(b => b.id === selectedBatch);
      
      for (const file of uploadFiles) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        // Check existing versions for this file name
        const existingDocs = documents.filter(d => 
          d.batch_id === batch.batch_id && 
          d.document_name === file.name &&
          !d.claim_id
        );
        const latestVersion = existingDocs.length > 0 
          ? Math.max(...existingDocs.map(d => d.version || 1))
          : 0;

        await base44.entities.Document.create({
          batch_id: batch.batch_id,
          document_type: 'General Document',
          document_name: file.name,
          file_url: file_url,
          upload_date: new Date().toISOString().split('T')[0],
          status: 'PENDING',
          version: latestVersion + 1,
          parent_document_id: existingDocs.length > 0 ? existingDocs[existingDocs.length - 1].id : null,
          uploaded_by: user?.email
        });
      }

      await base44.entities.Notification.create({
        title: 'Batch Documents Uploaded',
        message: `${uploadFiles.length} documents uploaded for batch ${batch.batch_id}`,
        type: 'INFO',
        module: 'DOCUMENT',
        reference_id: batch.batch_id,
        target_role: 'TUGURE'
      });

      setSuccessMessage(`${uploadFiles.length} documents uploaded successfully`);
      setShowUploadDialog(false);
      setSelectedBatch(null);
      setUploadFiles([]);
      loadData();
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMessage('Failed to upload documents');
    }
    setProcessing(false);
  };

  const handleDeleteDocs = async () => {
    if (selectedDocs.length === 0) return;
    if (!window.confirm(`Delete ${selectedDocs.length} document(s)?`)) return;

    setProcessing(true);
    try {
      for (const docId of selectedDocs) {
        await base44.entities.Document.delete(docId);
      }
      setSuccessMessage(`${selectedDocs.length} document(s) deleted`);
      setSelectedDocs([]);
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
      setErrorMessage('Failed to delete documents');
    }
    setProcessing(false);
  };

  const toggleDocSelection = (docId) => {
    setSelectedDocs(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const filteredBatches = batches.filter(b => {
    if (filters.contract !== 'all' && b.contract_id !== filters.contract) return false;
    if (filters.batch && !b.batch_id.toLowerCase().includes(filters.batch.toLowerCase())) return false;
    if (filters.batchStatus !== 'all' && b.status !== filters.batchStatus) return false;
    if (filters.startDate && b.created_date < filters.startDate) return false;
    if (filters.endDate && b.created_date > filters.endDate) return false;
    
    const batchDocs = getBatchDocuments(b.batch_id);
    if (filters.docStatus !== 'all') {
      const hasStatus = batchDocs.some(d => d.status === filters.docStatus);
      if (!hasStatus && batchDocs.length > 0) return false;
      if (batchDocs.length === 0 && filters.docStatus !== 'all') return false;
    }
    
    if (filters.version !== 'all') {
      const hasVersion = batchDocs.some(d => d.version === parseInt(filters.version));
      if (!hasVersion) return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Eligibility (Bordero)"
        subtitle="Bulk upload and manage debtor documents per batch"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Document Eligibility' }
        ]}
        actions={
          <div className="flex gap-2">
            {selectedDocs.length > 0 && (
              <Button variant="destructive" onClick={handleDeleteDocs} disabled={processing}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedDocs.length})
              </Button>
            )}
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
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

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ModernKPI 
          title="Total Batches" 
          value={filteredBatches.length} 
          subtitle={`${filteredBatches.reduce((sum, b) => sum + (b.total_records || 0), 0)} debtors`}
          icon={Folder} 
          color="blue" 
        />
        <ModernKPI 
          title="Total Documents" 
          value={documents.length}
          subtitle="All uploaded"
          icon={File} 
          color="green" 
        />
        <ModernKPI 
          title="Pending Verification" 
          value={documents.filter(d => d.status === 'PENDING').length}
          subtitle="Awaiting review"
          icon={AlertCircle} 
          color="orange" 
        />
        <ModernKPI 
          title="Verified" 
          value={documents.filter(d => d.status === 'VERIFIED').length}
          subtitle="Approved docs"
          icon={CheckCircle2} 
          color="purple" 
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-gray-600">Filter Documents</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Contract</label>
              <Select value={filters.contract} onValueChange={(val) => setFilters({...filters, contract: val})}>
                <SelectTrigger><SelectValue placeholder="All Contracts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contracts</SelectItem>
                  {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_id}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Batch ID</label>
              <Input placeholder="Search batch..." value={filters.batch} onChange={(e) => setFilters({...filters, batch: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Batch Status</label>
              <Select value={filters.batchStatus} onValueChange={(val) => setFilters({...filters, batchStatus: val})}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Uploaded">Uploaded</SelectItem>
                  <SelectItem value="Validated">Validated</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Doc Status</label>
              <Select value={filters.docStatus} onValueChange={(val) => setFilters({...filters, docStatus: val})}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="VERIFIED">Verified</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Start Date</label>
              <Input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">End Date</label>
              <Input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setFilters({ contract: 'all', batch: '', batchStatus: 'all', docStatus: 'all', version: 'all', startDate: '', endDate: '' })}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File Manager View */}
      <div className="grid gap-4">
        {filteredBatches.map(batch => {
          const batchDocs = getBatchDocuments(batch.batch_id);
          const debtor = debtors.find(d => d.batch_id === batch.batch_id);
          const docRemarks = debtor?.validation_remarks || '';
          
          return (
            <Card key={batch.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Folder className="w-8 h-8 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">{batch.batch_id}</CardTitle>
                      <p className="text-sm text-gray-500">
                        {batch.batch_month}/{batch.batch_year} • {batch.total_records || 0} debtors • v{batch.version || 1}
                      </p>
                      {docRemarks && (
                        <p className="text-xs text-orange-600 mt-1">⚠️ {docRemarks}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{batchDocs.length} docs</Badge>
                    <Button 
                      size="sm"
                      onClick={() => {
                        setSelectedBatch(batch.id);
                        setShowUploadDialog(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Docs
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {batchDocs.length > 0 && (
                <CardContent>
                  <div className="space-y-2">
                    {batchDocs.map((doc, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedDocs.includes(doc.id)}
                            onCheckedChange={() => toggleDocSelection(doc.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <File className="w-5 h-5 text-blue-600" />
                          <div
                            className="cursor-pointer flex-1"
                            onClick={() => {
                              setSelectedDocument({ 
                                ...doc, 
                                versions: batchDocs.filter(d => d.document_name === doc.document_name)
                              });
                              setShowViewDialog(true);
                            }}
                          >
                            <p className="font-medium text-sm">{doc.document_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <StatusBadge status={doc.status} />
                              <Badge variant="outline" className="text-xs">v{doc.version}</Badge>
                              <span className="text-xs text-gray-500">{doc.upload_date}</span>
                              {doc.remarks && (
                                <span className="text-xs text-orange-600">{doc.remarks}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          window.open(doc.file_url, '_blank');
                        }}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {filteredBatches.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-gray-500">
              No batches found matching filters
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Documents for Batch</DialogTitle>
            <DialogDescription>
              {selectedBatch ? batches.find(b => b.id === selectedBatch)?.batch_id : 'Select batch'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Upload multiple files at once. Files can be any name/type - no restrictions.
              </AlertDescription>
            </Alert>
            <div>
              <label className="text-sm font-medium">Select Files (multiple)</label>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setUploadFiles(Array.from(e.target.files))}
                className="w-full mt-1"
              />
              {uploadFiles.length > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  {uploadFiles.length} file(s) selected
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadDialog(false);
              setSelectedBatch(null);
              setUploadFiles([]);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkUpload}
              disabled={processing || !selectedBatch || uploadFiles.length === 0}
              className="bg-blue-600"
            >
              {processing ? 'Uploading...' : `Upload ${uploadFiles.length} File(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Document Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
            <DialogDescription>{selectedDocument?.document_name}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">File Name:</span>
                <span className="font-medium">{selectedDocument?.document_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Version:</span>
                <Badge>v{selectedDocument?.version}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status:</span>
                <StatusBadge status={selectedDocument?.status} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Uploaded By:</span>
                <span className="font-medium">{selectedDocument?.uploaded_by}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Upload Date:</span>
                <span className="font-medium">{selectedDocument?.upload_date}</span>
              </div>
            </div>

            {selectedDocument?.versions && selectedDocument.versions.length > 1 && (
              <div>
                <div className="text-sm font-medium mb-2">Version History:</div>
                <div className="space-y-2">
                  {selectedDocument.versions.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{doc.version}</Badge>
                        <span className="text-sm">{doc.upload_date}</span>
                        <StatusBadge status={doc.status} />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open(doc.file_url, '_blank')}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>Close</Button>
            <Button onClick={() => window.open(selectedDocument?.file_url, '_blank')}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}