import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AddTransactionModal } from './components/AddTransactionModal';
import { CrystalWorkspace, type CrystalView } from './components/CrystalWorkspace';
import {
  createTransaction,
  deleteAllTransactions,
  deleteFinancialData,
  deleteTransaction,
  disconnectGoogle,
  ensureFinancialStorage,
  getConnection,
  getFinancialSnapshot,
  patchTransaction,
  saveBudget,
  savePreferences,
  startGoogleAuthorization,
  type TransactionPayload,
} from './lib/api';
import { auth } from './lib/firebase';
import type { FinancialSnapshot, GoogleConnection, Transaction } from './types';

function clientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function monthBounds(): { startDate: string; endDate: string } {
  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
  return { startDate, endDate };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No pudimos completar la operacion. Intentalo de nuevo.';
}

function googleCallbackMessage(result: string | null): string | undefined {
  if (result === 'reauthorization_required') {
    return 'La autorizacion de Google no se completo o expiro. Vuelve a conectar Google Sheets.';
  }
  if (result === 'configuration_error') {
    return 'No pudimos completar la conexion con Google por una configuracion del servicio. Intentalo mas tarde.';
  }
  if (result === 'error') {
    return 'No pudimos completar la conexion con Google. Vuelve a intentarlo.';
  }
  return undefined;
}

function LoadingScreen({ message }: { message: string }) {
  return <main className="crystal-status-screen"><LoaderCircle className="crystal-status-loader crystal-spin" size={28} aria-hidden="true" /><p>{message}</p></main>;
}

function StorageGateScreen({ connection, message, onConnect, onRetry }: { connection: GoogleConnection; message?: string; onConnect: () => void; onRetry: () => void }) {
  const reconnecting = connection.status === 'reauth_required' || connection.status === 'file_missing';
  const title = connection.status === 'file_missing'
    ? 'Tu archivo de finanzas ya no esta disponible'
    : connection.status === 'reauth_required'
      ? 'Hay que volver a autorizar Google'
      : 'Conecta tu Google Sheet';
  const detail = message ?? (connection.status === 'file_missing'
    ? 'Podemos crear un archivo nuevo en tu Google Drive y continuar desde ahi.'
    : connection.status === 'reauth_required'
      ? 'La autorizacion expiro o fue revocada. Tus datos no se borraron; vuelve a conceder el acceso.'
      : 'Billqo creara “Billqo - Mis Finanzas” dentro de tu Google Drive. Solo tu seras dueno del archivo.');
  return (
    <main className="crystal-status-screen crystal-status-error">
      <div className="crystal-status-icon" aria-hidden="true"><FileSpreadsheet size={22} /></div>
      <h1>{title}</h1>
      <p>{detail}</p>
      <button type="button" className="crystal-primary-button crystal-status-retry" onClick={onConnect}>{reconnecting ? 'Volver a conectar Google' : 'Conectar Google'}</button>
      <button type="button" className="crystal-button crystal-button-ghost crystal-status-retry" onClick={onRetry}>Comprobar conexion</button>
      <small>Firebase solo gestiona tu identidad. Tus movimientos se guardan en tu Google Sheet privado.</small>
    </main>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [snapshot, setSnapshot] = useState<FinancialSnapshot>();
  const [connection, setConnection] = useState<GoogleConnection>({ status: 'not_connected' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [oauthResultMessage, setOauthResultMessage] = useState<string>();
  const [activeView, setActiveView] = useState<CrystalView>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction>();

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser);
    setAuthReady(true);
    if (!nextUser) navigate('/auth', { replace: true });
  }), [navigate]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(undefined);
    try {
      const currentConnection = await getConnection();
      setConnection(currentConnection);

      if (!['authorized', 'provisioning', 'connected'].includes(currentConnection.status)) {
        setSnapshot(undefined);
        return;
      }

      const verifiedConnection = await ensureFinancialStorage();
      setConnection(verifiedConnection);
      if (verifiedConnection.status !== 'connected') {
        setSnapshot(undefined);
        return;
      }

      setSnapshot(await getFinancialSnapshot());
    } catch (caught) {
      setError(errorMessage(caught));
      setSnapshot(undefined);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authReady && user) void refresh();
  }, [authReady, user, refresh]);

  useEffect(() => {
    const result = new URLSearchParams(location.search).get('google');
    if (!result) return;
    setOauthResultMessage(googleCallbackMessage(result));
    navigate('/app', { replace: true });
  }, [location.search, navigate]);

  const connectGoogle = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setOauthResultMessage(undefined);
    try {
      if (connection.status === 'file_missing') await disconnectGoogle();
      const { authorizationUrl } = await startGoogleAuthorization();
      window.location.assign(authorizationUrl);
    } catch (caught) {
      setError(errorMessage(caught));
      setLoading(false);
    }
  }, [connection.status]);

  const openCreate = () => {
    setEditingTransaction(undefined);
    setIsModalOpen(true);
  };

  const openEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(undefined);
  };

  const saveTransaction = async (payload: TransactionPayload) => {
    if (editingTransaction) await patchTransaction(editingTransaction.id, editingTransaction.updatedAt, payload);
    else await createTransaction(payload, clientId());
    await refresh();
    closeModal();
  };

  const updateBudget = async (categoryId: string, amount: number) => {
    if (!snapshot) return;
    const category = snapshot.categories.find((item) => item.id === categoryId);
    if (!category) throw new Error('La categoria seleccionada ya no esta disponible.');
    const existing = snapshot.budgets.find((item) => item.categoryId === categoryId);
    const { startDate, endDate } = monthBounds();
    await saveBudget(existing?.id ?? clientId(), {
      categoryId,
      amount,
      period: 'Mensual',
      startDate,
      endDate,
      active: true,
    }, existing?.updatedAt);
    await refresh();
  };

  const updatePreferences = async (preferences: Partial<Pick<FinancialSnapshot['preferences'], 'currency' | 'dateFormat' | 'timezone' | 'monthlyBudget'>>) => {
    if (!snapshot) return;
    await savePreferences(preferences, snapshot.preferences.updatedAt ?? '');
    await refresh();
  };

  const removeTransaction = async (transaction: Transaction) => {
    if (!window.confirm(`Eliminar “${transaction.description}”?`)) return;
    await deleteTransaction(transaction.id, transaction.updatedAt);
    await refresh();
  };

  const removeAllTransactions = async () => {
    if (!window.confirm('Se archivaran todos tus movimientos. Esta accion no se puede deshacer desde la interfaz.')) return;
    await deleteAllTransactions();
    await refresh();
  };

  const removeFinancialData = async () => {
    if (!window.confirm('Esto borrara permanentemente movimientos, presupuestos y recurrentes de tu Google Sheet. No se puede deshacer. ¿Continuar?')) return;
    setLoading(true);
    setError(undefined);
    try {
      await deleteFinancialData();
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      await disconnectGoogle();
      setSnapshot(undefined);
      setConnection({ status: 'not_connected' });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const profile = useMemo(() => ({
    id: user?.uid ?? '',
    name: user?.displayName || user?.email?.split('@')[0] || 'Usuario',
    email: user?.email ?? '',
    avatar: user?.photoURL ?? '',
  }), [user]);

  if (!authReady) return <LoadingScreen message="Comprobando tu sesion..." />;
  if (!user) return null;
  if (loading && !snapshot) return <LoadingScreen message="Conectando con Google Sheets..." />;
  if (!snapshot || connection.status !== 'connected') {
    return <StorageGateScreen connection={connection} message={error ?? oauthResultMessage} onConnect={() => void connectGoogle()} onRetry={() => void refresh()} />;
  }

  return (
    <>
      <CrystalWorkspace
        snapshot={snapshot}
        connection={connection}
        user={profile}
        activeView={activeView}
        onViewChange={setActiveView}
        onOpenAdd={openCreate}
        onEditTransaction={openEdit}
        onDeleteTransaction={(transaction) => void removeTransaction(transaction)}
        onDeleteAllTransactions={() => void removeAllTransactions()}
        onDeleteFinancialData={() => void removeFinancialData()}
        onSaveBudget={(categoryId, amount) => updateBudget(categoryId, amount)}
        onSavePreferences={updatePreferences}
        onRefresh={() => refresh()}
        onReconnect={() => void connectGoogle()}
        onDisconnect={() => void disconnect()}
        onSignOut={() => void signOut(auth)}
        busy={loading}
      />
      {isModalOpen && (
        <AddTransactionModal
          transaction={editingTransaction}
          categories={snapshot.categories}
          onClose={closeModal}
          onSave={saveTransaction}
        />
      )}
    </>
  );
}
