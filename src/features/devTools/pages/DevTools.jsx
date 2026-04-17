import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle, Wrench, Database, HardDrive, RefreshCw } from 'lucide-react';
import { resetAllData, fetchDataCounts } from '../services/devToolsService';

export default function DevTools() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [counts, setCounts] = useState(null);
  const [countsLoading, setCountsLoading] = useState(true);

  const loadCounts = async () => {
    setCountsLoading(true);
    try {
      const data = await fetchDataCounts();
      setCounts(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load data counts');
    } finally {
      setCountsLoading(false);
    }
  };

  useEffect(() => {
    loadCounts();
  }, []);

  const handleReset = async () => {
    setShowConfirm(false);
    setConfirmText('');
    setLoading(true);
    try {
      const result = await resetAllData();
      setLastResult(result.data);
      toast.success(result.message);
      await loadCounts();
    } catch (err) {
      toast.error(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <Wrench className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Developer Tools</h1>
          <p className="text-sm text-gray-500">Development and testing utilities</p>
        </div>
      </div>

      {/* Warning */}
      <Alert className="border-amber-300 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          These tools are only available in non-production environments. Actions performed here are <strong>irreversible</strong>.
        </AlertDescription>
      </Alert>

      {/* Current Data Counts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Current Data
              </CardTitle>
              <CardDescription>
                Overview of all records currently in the database and S3 storage.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {counts && (
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-sm">
                    {counts.totalDb} DB records
                  </Badge>
                  <Badge variant="secondary" className="text-sm">
                    {counts.totalS3} S3 files
                  </Badge>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={loadCounts} disabled={countsLoading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${countsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {countsLoading && !counts ? (
            <p className="text-sm text-gray-500">Loading data counts...</p>
          ) : counts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Database Tables</p>
                <div className="space-y-1">
                  {Object.entries(counts.database).map(([table, count]) => (
                    <div key={table} className="flex justify-between text-sm py-1 px-2 rounded hover:bg-gray-50">
                      <span className="text-gray-600">{table}</span>
                      <span className={`font-mono ${count > 0 ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">S3 Storage</p>
                <div className="space-y-1">
                  {Object.entries(counts.s3).map(([prefix, count]) => (
                    <div key={prefix} className="flex justify-between text-sm py-1 px-2 rounded hover:bg-gray-50">
                      <span className="text-gray-600">{prefix}</span>
                      <span className={`font-mono ${count > 0 ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  SystemConfig, EmailTemplate, SlaRule, and NotificationSetting are preserved during reset.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-500">Failed to load counts.</p>
          )}
        </CardContent>
      </Card>

      {/* Reset Card */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" />
            Reset All Data
          </CardTitle>
          <CardDescription>
            Delete all data records from the database and remove uploaded files from S3 storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowConfirm(true)}
            disabled={loading || (counts && counts.totalDb === 0 && counts.totalS3 === 0)}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Reset All Data
                {counts && (counts.totalDb > 0 || counts.totalS3 > 0) && (
                  <span className="ml-2">({counts.totalDb + counts.totalS3} items)</span>
                )}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700">Last Reset Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Database</p>
                <div className="space-y-1">
                  {Object.entries(lastResult.database || {}).map(([table, count]) => (
                    <div key={table} className="flex justify-between text-sm">
                      <span className="text-gray-600">{table}</span>
                      <span className="font-mono text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">S3 Storage</p>
                <div className="space-y-1">
                  {Object.entries(lastResult.s3 || {}).map(([prefix, count]) => (
                    <div key={prefix} className="flex justify-between text-sm">
                      <span className="text-gray-600">{prefix}</span>
                      <span className="font-mono text-gray-900">{typeof count === 'number' ? count : count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all data records from the database and all uploaded files from S3 storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-gray-700">
              Type <span className="font-mono font-bold text-red-600">RESET</span> to confirm:
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET"
              className="mt-2"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={confirmText !== 'RESET'}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
