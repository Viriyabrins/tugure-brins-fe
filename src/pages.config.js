import AdvancedReports from './pages/AdvancedReports';
import AuditLog from './pages/AuditLog';
import BatchProcessing from './pages/BatchProcessing';
import BorderoManagement from './pages/BorderoManagement';
import ClaimReview from './pages/ClaimReview';
import ClaimSubmit from './pages/ClaimSubmit';
import Dashboard from './pages/Dashboard';
import DebtorReview from './pages/DebtorReview';
import DocumentClaim from './pages/DocumentClaim';
import DocumentEligibilityBatch from './pages/DocumentEligibilityBatch';
import Home from './pages/Home';
import MasterContractManagement from './pages/MasterContractManagement';
import NotaManagement from './pages/NotaManagement';
import NotificationCenter from './pages/NotificationCenter';
import PaymentIntent from './pages/PaymentIntent';
import PaymentStatus from './pages/PaymentStatus';
import Profile from './pages/Profile';
import SubmitDebtor from './pages/SubmitDebtor';
import SystemConfiguration from './pages/SystemConfiguration';
import WorkflowGuide from './pages/WorkflowGuide';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdvancedReports": AdvancedReports,
    "AuditLog": AuditLog,
    "BatchProcessing": BatchProcessing,
    "BorderoManagement": BorderoManagement,
    "ClaimReview": ClaimReview,
    "ClaimSubmit": ClaimSubmit,
    "Dashboard": Dashboard,
    "DebtorReview": DebtorReview,
    "DocumentClaim": DocumentClaim,
    "DocumentEligibilityBatch": DocumentEligibilityBatch,
    "Home": Home,
    "MasterContractManagement": MasterContractManagement,
    "NotaManagement": NotaManagement,
    "NotificationCenter": NotificationCenter,
    "PaymentIntent": PaymentIntent,
    "PaymentStatus": PaymentStatus,
    "Profile": Profile,
    "SubmitDebtor": SubmitDebtor,
    "SystemConfiguration": SystemConfiguration,
    "WorkflowGuide": WorkflowGuide,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};