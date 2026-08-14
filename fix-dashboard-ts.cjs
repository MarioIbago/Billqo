const fs = require('fs');
let code = fs.readFileSync('src/Dashboard.tsx', 'utf-8');

const monthBoundsDef = `
function monthBounds(): { startDate: string; endDate: string } {
  const now = new Date();
  const startDate = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}-01\`;
  const endDate = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}-\${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}\`;
  return { startDate, endDate };
}
`;

if (!code.includes('function monthBounds')) {
  code += '\n' + monthBoundsDef;
}

code = code.replace(
  /const loadData = useCallback\(async \(force = false\) => \{[\s\S]*?\}, \[user\]\);/m,
  "  const loadData = useCallback(async (force = false) => {\n" +
  "    if (!user) return;\n" +
  "    try {\n" +
  "      const conn = await getConnection();\n" +
  "      setConnection(conn);\n" +
  "      if (conn.status === 'connected') {\n" +
  "        const snap = force ? await syncFinancialSnapshot() : await getFinancialSnapshot();\n" +
  "        setSnapshot(snap);\n" +
  "      }\n" +
  "    } catch (e) {\n" +
  "      console.error(e);\n" +
  "      setError(e instanceof Error ? e.message : 'Error al cargar datos');\n" +
  "    }\n" +
  "  }, [user]);"
);

code = code.replace(
  /const handleUpdateBudget = async \(category: Category, newAmount: number\) => \{[\s\S]*?await loadData\(true\);\s*\};/m,
  "  const handleUpdateBudget = async (category: Category, newAmount: number) => {\n" +
  "    if (!snapshot) return;\n" +
  "    const existing = snapshot.budgets.find(b => b.categoryId === category.id);\n" +
  "    const range = monthBounds();\n" +
  "    await saveBudget(existing?.id || 'new', { categoryId: category.id, amount: newAmount, period: 'Mensual', ...range, active: true }, snapshot.syncedAt);\n" +
  "    await loadData(true);\n" +
  "  };"
);

if (!code.includes('syncFinancialSnapshot')) {
  code = code.replace('getFinancialSnapshot,', 'getFinancialSnapshot,\n  syncFinancialSnapshot,');
}

fs.writeFileSync('src/Dashboard.tsx', code);
