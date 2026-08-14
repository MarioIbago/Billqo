const fs = require('fs');
let code = fs.readFileSync('src/Dashboard.tsx', 'utf-8');

// We need to add the imports for the new components at the top.
const newImports = `
import { Header } from './components/Header';
import { PowerBIDashboard } from './components/PowerBIDashboard';
import { TransactionRegistry } from './components/TransactionRegistry';
import { BudgetManager } from './components/BudgetManager';
import { AiInsightsPanel } from './components/AiInsightsPanel';
import { UserSessionModal } from './components/UserSessionModal';
import { PromptViewerModal } from './components/PromptViewerModal';
import { AddTransactionModal } from './components/AddTransactionModal';
import { CostExplanationModal } from './components/CostExplanationModal';
`;

// Let's replace export function Dashboard with a new implementation.
const dashboardRegex = /export function Dashboard\(\) \{[\s\S]*$/;

const newDashboardCode = `export function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [connection, setConnection] = useState<GoogleConnection>();
  const [snapshot, setSnapshot] = useState<FinancialSnapshot>();
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [error, setError] = useState<string>();

  // New UI state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'registry' | 'insights' | 'budgets'>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCostGuideOpen, setIsCostGuideOpen] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        navigate('/auth', { replace: true });
      }
    });
  }, [navigate]);

  const loadData = useCallback(async (force = false) => {
    if (!user) return;
    try {
      const conn = await getConnection();
      setConnection(conn);
      if (conn.status === 'connected') {
        const snap = await getFinancialSnapshot(force);
        setSnapshot(snap);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    }
  }, [user]);

  useEffect(() => {
    if (authReady && user && !snapshot) {
      setLoadingConnection(true);
      loadData().finally(() => setLoadingConnection(false));
    }
  }, [authReady, user, loadData, snapshot]);

  const handleUpdateMonthlyTotal = async (total: number) => {
    if (!snapshot) return;
    const newPrefs = { ...snapshot.preferences, monthlyBudget: total };
    await savePreferences(newPrefs, snapshot.syncedAt);
    await loadData(true);
  };

  const handleUpdateBudget = async (category: Category, newAmount: number) => {
    if (!snapshot) return;
    await saveBudget({ categoryId: category.id, amount: newAmount, period: 'mensual', id: '' }, snapshot.syncedAt);
    await loadData(true);
  };
  
  const handleDeleteTransaction = async (id: string) => {
    if (!snapshot) return;
    await deleteTransaction(id, snapshot.syncedAt);
    await loadData(true);
  };

  if (!authReady) return <LoadingScreen message="Comprobando tu sesión…" />;
  if (!user) return null;
  if (!connection || (loadingConnection && !snapshot)) return <LoadingScreen message="Preparando tu conexión segura…" />;
  
  if (connection.status !== 'connected' || !snapshot) {
    return <GoogleStorageOnboarding connection={connection} busy={loadingConnection} error={error} onAuthorize={startGoogleAuthorization} onEnsure={ensureFinancialStorage} />;
  }

  const userProfile = {
    name: user.displayName || 'Usuario',
    email: user.email || '',
    avatar: user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || 'U'),
    preferences: {
      currency: snapshot.preferences.currency,
      monthlyTarget: snapshot.preferences.monthlyBudget
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-500 selection:text-white">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab as any}
        user={userProfile}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenPromptModal={() => setIsPromptModalOpen(true)}
        onOpenUserModal={() => setIsUserModalOpen(true)}
        onOpenCostGuide={() => setIsCostGuideOpen(true)}
        transactionCount={snapshot.transactions.length}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'dashboard' && (
          <PowerBIDashboard 
            transactions={snapshot.transactions} 
            budgets={snapshot.budgets} 
            user={userProfile} 
            onNavigateToInsights={() => setActiveTab('insights')} 
            onOpenAddModal={() => setIsAddModalOpen(true)} 
          />
        )}
        
        {activeTab === 'registry' && (
          <TransactionRegistry
            transactions={snapshot.transactions}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onDeleteAllData={async () => {
              if (window.confirm('¿Seguro que deseas eliminar todo?')) {
                await deleteAllTransactions();
                await loadData(true);
              }
            }}
          />
        )}

        {activeTab === 'insights' && (
          <AiInsightsPanel
            transactions={snapshot.transactions}
            budgets={snapshot.budgets}
          />
        )}

        {activeTab === 'budgets' && (
          <BudgetManager
            budgets={snapshot.budgets}
            transactions={snapshot.transactions}
            onUpdateBudget={(cat, amount) => handleUpdateBudget(cat as Category, amount)}
            monthlyBudgetTotal={snapshot.preferences.monthlyBudget}
            onUpdateMonthlyTotal={handleUpdateMonthlyTotal}
          />
        )}
      </main>

      {/* Modals */}
      {isAddModalOpen && (
        <AddTransactionModal 
          onClose={() => setIsAddModalOpen(false)}
          onSave={async (payload) => {
             await createTransaction(payload as any, snapshot.syncedAt);
             await loadData(true);
             setIsAddModalOpen(false);
          }}
          categories={snapshot.categories}
        />
      )}
      
      {isPromptModalOpen && <PromptViewerModal onClose={() => setIsPromptModalOpen(false)} />}
      
      {isUserModalOpen && <UserSessionModal user={userProfile} onClose={() => setIsUserModalOpen(false)} onSignOut={() => signOut(auth)} />}
      
      {isCostGuideOpen && <CostExplanationModal onClose={() => setIsCostGuideOpen(false)} />}
    </div>
  );
}
`;

if (code.includes('import { Header }')) {
  // already has imports
} else {
  // insert imports after the last import
  const importLines = code.match(/import .*?;/g) || [];
  const lastImport = importLines[importLines.length - 1];
  code = code.replace(lastImport, lastImport + '\n' + newImports);
}

code = code.replace(dashboardRegex, newDashboardCode);

fs.writeFileSync('src/Dashboard.tsx', code);
