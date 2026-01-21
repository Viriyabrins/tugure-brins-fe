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

export default function DocumentClaim() {
  const [user, setUser] = useState(null);
  const [batches, setBatches] = useState([]);
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
    status: 'all',
    version: 'all',
    startDate: '',
    endDate: ''
  });

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
      const [batchData, docData, contractData] = await Promise.all([
        base44.entities.Batch.list(),
        base44.entities.Document.list(),
        base44.entities.MasterContract.list()
      ]);
      setBatches(batchData || []);
      setDocuments((docData || []).filter(d => d.claim_id));
      setContracts(contractData.filter(c => c.effective_status === 'Active') || []);
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
      setErrorMessage('Please select files');
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    try {
      const batch = batches.find(b => b.id === selectedBatch);
      
      for (const file of uploadFiles) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        const existingDocs = documents.filter(d => 
          d.batch_id === batch.batch_id && 
          d.document_name === file.name &&
          d.claim_id
        );
        const latestVersion = existingDocs.length > 0 
          ? Math.max(...existingDocs.map(d => d.version || 1))
          : 0;

        await base44.entities.Document.create({
          batch_id: batch.batch_id,
          claim_id: batch.batch_id,
          document_type: 'Claim Document',
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
        title: 'Claim Documents Uploaded',
        message: `${uploadFiles.length} claim documents uploaded for batch ${batch.batch_id}`,
        type: 'INFO',
        module: 'DOCUMENT',
        reference_id: batch.batch_id,
        target_role: 'TUGURE'
      });

      setSuccessMessage(`${uploadFiles.length} documents uploaded`);
      setShowUploadDialog(false);
      setSelectedBatch(null);
      setUploadFiles([]);
      loadData();
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMessage('Failed to upload');
    }
    setProcessing(false);
  };

  const filteredBatches = batches.filter(b => {
    if (filters.contract !== 'all' && b.contract_id !== filters.contract) return false;
    if (filters.batch && !b.batch_id.includes(filters.batch)) return false;
    if (filters.startDate && b.created_date < filters.startDate) return false;
    if (filters.endDate && b.created_date > filters.endDate) return false;
    
    const batchDocs = getBatchDocuments(b.batch_id);
    if (filters.status !== 'all' && !batchDocs.some(d => d.status === filters.status)) return false;
    if (filters.version !== 'all' && !batchDocs.some(d => d.version === parseInt(filters.version))) return false;
    
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Claim"
        subtitle="Upload claim documents per batch"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Document Claim' }
        ]}
        actions={
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Select value={filters.contract} onValueChange={(val) => setFilters({...filters, contract: val})}>
              <SelectTrigger><SelectValue placeholder="Contract" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_id}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input placeholder="Batch..." value={filters.batch} onChange={(e) => setFilters({...filters, batch: e.target.value})} />
            <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val})}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.version} onValueChange={(val) => setFilters({...filters, version: val})}>
              <SelectTrigger><SelectValue placeholder="Version" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="1">v1</SelectItem>
                <SelectItem value="2">v2</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} />
            <Input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setFilters({ contract: 'all', batch: '', status: 'all', version: 'all', startDate: '', endDate: '' })}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Batches */}
      <div className="grid gap-4">
        {filteredBatches.map(batch => {
          const batchDocs = getBatchDocuments(batch.batch_id);
          
          return (
            <Card key={batch.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Folder className="w-8 h-8 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">{batch.batch_id}</CardTitle>
                      <p className="text-sm text-gray-500">{batch.batch_month}/{batch.batch_year} • v{batch.version || 1}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{batchDocs.length} docs</Badge>
                    <Button size="sm" onClick={() => { setSelectedBatch(batch.id); setShowUploadDialog(true); }}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Docs
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {batchDocs.length > 0 && (
                <CardContent>
                  <div className="space-y-2">
                    {batchDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <File className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-sm">{doc.document_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <StatusBadge status={doc.status} />
                              <Badge variant="outline" className="text-xs">v{doc.version}</Badge>
                              <span className="text-xs text-gray-500">{doc.upload_date}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => window.open(doc.file_url, '_blank')}>
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
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Claim Documents</DialogTitle>
            <DialogDescription>{selectedBatch ? batches.find(b => b.id === selectedBatch)?.batch_id : ''}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert className="bg-blue-50 border-blue-200 mb-4">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Upload multiple files - any name/type
              </AlertDescription>
            </Alert>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setUploadFiles(Array.from(e.target.files))}
              className="w-full"
            />
            {uploadFiles.length > 0 && (
              <p className="text-sm text-green-600 mt-2">{uploadFiles.length} file(s) selected</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadDialog(false); setUploadFiles([]); }}>Cancel</Button>
            <Button onClick={handleBulkUpload} disabled={processing || uploadFiles.length === 0} className="bg-blue-600">
              {processing ? 'Uploading...' : `Upload ${uploadFiles.length} File(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}