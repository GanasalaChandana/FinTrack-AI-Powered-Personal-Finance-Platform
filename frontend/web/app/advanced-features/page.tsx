"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, X, Plus, 
  ArrowUpRight, ArrowDownRight, Building, Lock, Activity, 
  CreditCard, Zap, BarChart3, Loader2, ArrowLeft
} from 'lucide-react';
import { isAuthenticated as checkAuth, transactionsAPI } from '@/lib/api';

const CashFlowForecasting = ({ transactions }: { transactions: any[] }) => {
  const [timeframe, setTimeframe] = useState<'1month' | '3months' | '6months'>('3months');
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const currentMonthTxs = transactions.filter(t => t.date?.startsWith(currentMonth));
  const monthlyIncome = currentMonthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpenses = currentMonthTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate actual balance from all transactions
  const allIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const allExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const currentBalance = allIncome - allExpenses;
  const netCashFlow = monthlyIncome - monthlyExpenses;
  
  const forecast = [];
  let projectedBalance = currentBalance;
  const months = timeframe === '1month' ? 1 : timeframe === '3months' ? 3 : 6;
  
  for (let i = 0; i < months; i++) {
    projectedBalance += netCashFlow;
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + i + 1);
    forecast.push({ 
      month: futureDate.toLocaleDateString('en-US', { month: 'short' }), 
      balance: projectedBalance 
    });
  }
  
  const safeToSpend = Math.max(0, currentBalance - (monthlyExpenses * 0.5));
  const worstCase = forecast[forecast.length - 1]?.balance - (monthlyExpenses * 0.3) || 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
        </div>
        <p className="text-blue-100 mb-6">Predict your future balance based on actual spending patterns</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/20 backdrop-blur rounded-xl p-4">
            <div className="text-sm text-blue-100 mb-1">Current Balance</div>
            <div className="text-3xl font-bold">${currentBalance.toLocaleString()}</div>
            <div className="text-xs text-blue-200 mt-1">From {transactions.length} transactions</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-4">
            <div className="text-sm text-blue-100 mb-1">Monthly Net Flow</div>
            <div className="text-3xl font-bold flex items-center gap-2">
              {netCashFlow > 0 ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
              ${Math.abs(netCashFlow).toLocaleString()}
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-4">
            <div className="text-sm text-blue-100 mb-1">Projected ({months}mo)</div>
            <div className="text-3xl font-bold">${forecast[forecast.length - 1]?.balance.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['1month', '3months', '6months'] as const).map(tf => (
          <button 
            key={tf} 
            onClick={() => setTimeframe(tf)} 
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              timeframe === tf ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tf === '1month' ? '1 Month' : tf === '3months' ? '3 Months' : '6 Months'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-4">Balance Projection</h3>
        <div className="space-y-3">
          {forecast.map((month, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <div className="w-16 text-sm font-medium text-gray-600">{month.month}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-lg font-bold text-gray-900">${month.balance.toLocaleString()}</div>
                  <div className={`text-xs font-semibold ${month.balance > currentBalance ? 'text-green-600' : 'text-gray-600'}`}>
                    {month.balance > currentBalance ? '+' : ''}{((month.balance - currentBalance) / (currentBalance || 1) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all" 
                    style={{ width: `${Math.min(100, Math.max(0, (month.balance / ((currentBalance || 1) * 2)) * 100))}%` }} 
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <div className="font-bold text-green-900 mb-1">Safe to Spend</div>
              <div className="text-2xl font-bold text-green-700 mb-2">${safeToSpend.toLocaleString()}</div>
              <div className="text-sm text-green-800">You can safely spend this amount while maintaining a healthy buffer</div>
            </div>
          </div>
        </div>
        <div className={`${worstCase < 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border-2 rounded-xl p-4`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-6 h-6 ${worstCase < 0 ? 'text-red-600' : 'text-blue-600'} flex-shrink-0 mt-1`} />
            <div>
              <div className={`font-bold ${worstCase < 0 ? 'text-red-900' : 'text-blue-900'} mb-1`}>Worst Case Scenario</div>
              <div className={`text-2xl font-bold ${worstCase < 0 ? 'text-red-700' : 'text-blue-700'} mb-2`}>${worstCase.toLocaleString()}</div>
              <div className={`text-sm ${worstCase < 0 ? 'text-red-800' : 'text-blue-800'}`}>
                {worstCase < 0 ? '⚠️ Balance might go negative if expenses spike 30%' : 'Even with 30% expense spike, you stay positive'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {transactions.length === 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div>
              <div className="font-bold text-yellow-900 mb-1">No Transaction Data</div>
              <div className="text-sm text-yellow-800">Add transactions to your account to see accurate cash flow forecasts based on your real spending patterns.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InvestmentTracking = () => {
  const [accounts, setAccounts] = useState<any[]>([
    { id: 1, name: 'Example Brokerage', type: 'Brokerage', balance: 15420, change: 2.4, holdings: 8 },
    { id: 2, name: 'Example Crypto', type: 'Crypto', balance: 3250, change: -1.2, holdings: 4 },
    { id: 3, name: 'Example 401(k)', type: 'Retirement', balance: 45600, change: 1.8, holdings: 12 }
  ]);
  const [isAdding, setIsAdding] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', type: 'Brokerage', balance: 0, change: 0, holdings: 0 });

  const addAccount = () => {
    if (!newAccount.name || newAccount.balance <= 0) return;
    const account = { ...newAccount, id: Date.now() };
    setAccounts([...accounts, account]);
    setNewAccount({ name: '', type: 'Brokerage', balance: 0, change: 0, holdings: 0 });
    setIsAdding(false);
  };

  const deleteAccount = (id: number) => {
    setAccounts(accounts.filter(acc => acc.id !== id));
  };

  const totalInvestments = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const weightedChange = totalInvestments > 0 ? accounts.reduce((sum, acc) => sum + (acc.change * acc.balance), 0) / totalInvestments : 0;
  
  const calculateAllocation = () => {
    if (accounts.length === 0) return [];
    const stocksTotal = accounts.filter(a => a.type === 'Brokerage' || a.type === 'Retirement').reduce((sum, a) => sum + a.balance, 0);
    const cryptoTotal = accounts.filter(a => a.type === 'Crypto').reduce((sum, a) => sum + a.balance, 0);
    const cashTotal = accounts.filter(a => a.type === 'Savings' || a.type === 'Cash').reduce((sum, a) => sum + a.balance, 0);
    
    return [
      { name: 'Stocks & Retirement', value: totalInvestments > 0 ? (stocksTotal / totalInvestments * 100) : 0, color: 'bg-blue-500' },
      { name: 'Crypto', value: totalInvestments > 0 ? (cryptoTotal / totalInvestments * 100) : 0, color: 'bg-purple-500' },
      { name: 'Cash & Savings', value: totalInvestments > 0 ? (cashTotal / totalInvestments * 100) : 0, color: 'bg-gray-500' },
    ].filter(a => a.value > 0);
  };
  
  const assetAllocation = calculateAllocation();

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Investment Portfolio</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/20 backdrop-blur rounded-xl p-4">
            <div className="text-sm text-green-100 mb-1">Total Value</div>
            <div className="text-3xl font-bold">${totalInvestments.toLocaleString()}</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-4">
            <div className="text-sm text-green-100 mb-1">Today's Change</div>
            <div className="text-3xl font-bold flex items-center gap-2">
              {weightedChange >= 0 ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
              {weightedChange >= 0 ? '+' : ''}{weightedChange.toFixed(2)}%
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-4">
            <div className="text-sm text-green-100 mb-1">Total Accounts</div>
            <div className="text-3xl font-bold">{accounts.length}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Investment Accounts</h3>
          <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            <Plus className="w-4 h-4" />Add Account
          </button>
        </div>
        <div className="space-y-3">
          {accounts.map(account => (
            <div key={account.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Building className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">{account.name}</div>
                  <div className="text-sm text-gray-600">{account.type} • {account.holdings} holdings</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">${account.balance.toLocaleString()}</div>
                  <div className={`text-sm font-semibold flex items-center gap-1 justify-end ${account.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {account.change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {account.change >= 0 ? '+' : ''}{account.change}%
                  </div>
                </div>
                <button onClick={() => deleteAccount(account.id)} className="opacity-0 group-hover:opacity-100 transition p-2 hover:bg-red-50 rounded-lg">
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Investment Account</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input type="text" value={newAccount.name} onChange={(e) => setNewAccount({...newAccount, name: e.target.value})} placeholder="e.g., Robinhood, 401(k)" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select value={newAccount.type} onChange={(e) => setNewAccount({...newAccount, type: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                  <option value="Brokerage">Brokerage</option>
                  <option value="Retirement">Retirement (401k, IRA)</option>
                  <option value="Crypto">Crypto</option>
                  <option value="Savings">Savings</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Balance</label>
                <input type="number" value={newAccount.balance || ''} onChange={(e) => setNewAccount({...newAccount, balance: Number(e.target.value)})} placeholder="0" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Today's Change (%)</label>
                <input type="number" step="0.1" value={newAccount.change || ''} onChange={(e) => setNewAccount({...newAccount, change: Number(e.target.value)})} placeholder="0" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Holdings</label>
                <input type="number" value={newAccount.holdings || ''} onChange={(e) => setNewAccount({...newAccount, holdings: Number(e.target.value)})} placeholder="0" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsAdding(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold">Cancel</button>
              <button onClick={addAccount} className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">Add Account</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-4">Asset Allocation</h3>
        {assetAllocation.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Add investment accounts to see your asset allocation</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assetAllocation.map(asset => (
              <div key={asset.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">{asset.name}</span>
                  <span className="font-bold text-gray-900">{asset.value.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className={`${asset.color} h-3 rounded-full transition-all`} style={{ width: `${asset.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const DebtPayoffPlanner = () => {
  const [debts, setDebts] = useState<any[]>([
    { id: 1, name: 'Example Credit Card', balance: 3500, apr: 18.99, minPayment: 105 },
    { id: 2, name: 'Example Student Loan', balance: 15000, apr: 5.5, minPayment: 200 }
  ]);
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche'>('avalanche');
  const [extraPayment, setExtraPayment] = useState(200);
  const [isAdding, setIsAdding] = useState(false);
  const [newDebt, setNewDebt] = useState({ name: '', balance: 0, apr: 0, minPayment: 0 });

  const addDebt = () => {
    if (!newDebt.name || newDebt.balance <= 0) return;
    const debt = { ...newDebt, id: Date.now() };
    setDebts([...debts, debt]);
    setNewDebt({ name: '', balance: 0, apr: 0, minPayment: 0 });
    setIsAdding(false);
  };

  const deleteDebt = (id: number) => {
    setDebts(debts.filter(d => d.id !== id));
  };

  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinPayment = debts.reduce((sum, d) => sum + d.minPayment, 0);
  const weightedAPR = totalDebt > 0 ? debts.reduce((sum, d) => sum + (d.apr * d.balance), 0) / totalDebt : 0;
  const sortedDebts = [...debts].sort((a, b) => strategy === 'snowball' ? a.balance - b.balance : b.apr - a.apr);

  const calculatePayoff = () => {
    if (debts.length === 0) return { months: 0, totalInterest: 0 };
    const totalMonthlyPayment = totalMinPayment + extraPayment;
    let remainingDebts = [...sortedDebts];
    let months = 0;
    let totalInterest = 0;
    while (remainingDebts.length > 0 && months < 360) {
      months++;
      let availablePayment = totalMonthlyPayment;
      remainingDebts = remainingDebts.map(debt => {
        const monthlyInterest = (debt.balance * (debt.apr / 100)) / 12;
        totalInterest += monthlyInterest;
        const payment = Math.min(availablePayment, debt.balance + monthlyInterest);
        availablePayment -= payment;
        return { ...debt, balance: Math.max(0, debt.balance + monthlyInterest - payment) };
      }).filter(debt => debt.balance > 0);
    }
    return { months, totalInterest };
  };

  const { months: payoffMonths, totalInterest } = calculatePayoff();
  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + payoffMonths);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Debt Payoff Planner</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/20 backdrop-blur rounded-xl p-4">
            <div className="text-sm text-red-100 mb-1">Total Debt</div>
            <div className="text-3xl font-bold">${totalDebt.toLocaleString()}</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-4">
            <div className="text-sm text-red-100 mb-1">Avg. APR</div>
            <div className="text-3xl font-bold">{debts.length > 0 ? weightedAPR.toFixed(2) : '0.00'}%</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-4">
            <div className="text-sm text-red-100 mb-1">Payoff Date</div>
            <div className="text-xl font-bold">{debts.length > 0 ? payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}</div>
            <div className="text-xs text-red-100">{debts.length > 0 ? `${payoffMonths} months` : 'Add debts'}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-4">Payoff Strategy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button onClick={() => setStrategy('avalanche')} className={`p-4 rounded-xl border-2 transition text-left ${strategy === 'avalanche' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <div className="font-bold text-gray-900 mb-1">Avalanche Method</div>
            <div className="text-sm text-gray-600">Pay highest interest rate first - saves more money</div>
          </button>
          <button onClick={() => setStrategy('snowball')} className={`p-4 rounded-xl border-2 transition text-left ${strategy === 'snowball' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <div className="font-bold text-gray-900 mb-1">Snowball Method</div>
            <div className="text-sm text-gray-600">Pay smallest balance first - quick wins for motivation</div>
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Extra Monthly Payment</label>
          <div className="flex items-center gap-4">
            <input type="range" min="0" max="1000" step="50" value={extraPayment} onChange={(e) => setExtraPayment(Number(e.target.value))} className="flex-1" />
            <div className="text-xl font-bold text-gray-900 w-24">${extraPayment}</div>
          </div>
          <div className="text-sm text-gray-600 mt-2">Total Monthly Payment: ${(totalMinPayment + extraPayment).toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Your Debts {debts.length > 0 && '(in payoff order)'}</h3>
          <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
            <Plus className="w-4 h-4" />Add Debt
          </button>
        </div>
        <div className="space-y-3">
          {sortedDebts.map((debt, index) => (
            <div key={debt.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg group">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center font-bold text-red-600 flex-shrink-0">{index + 1}</div>
              <div className="flex-1">
                <div className="font-bold text-gray-900">{debt.name}</div>
                <div className="text-sm text-gray-600">{debt.apr}% APR • Min: ${debt.minPayment}/mo</div>
              </div>
              <div className="text-xl font-bold text-gray-900">${debt.balance.toLocaleString()}</div>
              <button onClick={() => deleteDebt(debt.id)} className="opacity-0 group-hover:opacity-100 transition p-2 hover:bg-red-50 rounded-lg">
                <X className="w-4 h-4 text-red-600" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Debt</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Debt Name</label>
                <input type="text" value={newDebt.name} onChange={(e) => setNewDebt({...newDebt, name: e.target.value})} placeholder="e.g., Credit Card, Student Loan" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Balance</label>
                <input type="number" value={newDebt.balance || ''} onChange={(e) => setNewDebt({...newDebt, balance: Number(e.target.value)})} placeholder="0" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">APR (%)</label>
                <input type="number" step="0.01" value={newDebt.apr || ''} onChange={(e) => setNewDebt({...newDebt, apr: Number(e.target.value)})} placeholder="0.00" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Payment</label>
                <input type="number" value={newDebt.minPayment || ''} onChange={(e) => setNewDebt({...newDebt, minPayment: Number(e.target.value)})} placeholder="0" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsAdding(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold">Cancel</button>
              <button onClick={addDebt} className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">Add Debt</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <Zap className="w-8 h-8 text-green-600 flex-shrink-0" />
          <div>
            <div className="font-bold text-green-900 text-lg mb-2">
              {debts.length > 0 ? 'Interest Saved with Extra Payments' : 'Track Your Debt Payoff Progress'}
            </div>
            {debts.length > 0 ? (
              <>
                <div className="text-3xl font-bold text-green-700 mb-2">${totalInterest.toLocaleString()}</div>
                <div className="text-sm text-green-800">By paying an extra ${extraPayment}/month, you'll save ${totalInterest.toLocaleString()} in interest and be debt-free in {payoffMonths} months!</div>
              </>
            ) : (
              <div className="text-sm text-green-800">Add your debts above to see how extra payments can help you become debt-free faster and save on interest.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PlaidBankConnection = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedBanks, setConnectedBanks] = useState<any[]>([
    { id: 1, name: 'Example Checking', last4: '4521', balance: 8450, synced: '2 hours ago' }
  ]);
  const [isAdding, setIsAdding] = useState(false);
  const [newBank, setNewBank] = useState({ name: '', last4: '', balance: 0 });
  const popularBanks = [
    { name: 'Chase', logo: '🏦' }, 
    { name: 'Bank of America', logo: '🏛️' }, 
    { name: 'Wells Fargo', logo: '🐴' }, 
    { name: 'Citi', logo: '🏢' }, 
    { name: 'Capital One', logo: '💳' }, 
    { name: 'US Bank', logo: '🇺🇸' }
  ];

  const addBank = () => {
    if (!newBank.name || !newBank.last4 || newBank.balance < 0) return;
    const bank = { ...newBank, id: Date.now(), synced: 'just now' };
    setConnectedBanks([...connectedBanks, bank]);
    setNewBank({ name: '', last4: '', balance: 0 });
    setIsAdding(false);
    setIsConnecting(false);
  };

  const deleteBank = (id: number) => {
    setConnectedBanks(connectedBanks.filter(b => b.id !== id));
  };

  const syncBank = (id: number) => {
    const updated = connectedBanks.map(b => b.id === id ? { ...b, synced: 'just now' } : b);
    setConnectedBanks(updated);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Bank Connections</h2>
        </div>
        <p className="text-blue-100 mb-4">Securely connect your bank accounts for automatic transaction imports</p>
        <div className="flex items-center gap-2 text-sm text-blue-100">
          <CheckCircle className="w-4 h-4" />
          <span>256-bit encryption • Bank-level security • Never stored</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Connected Accounts</h3>
          <div className="text-sm text-gray-600">{connectedBanks.length} accounts</div>
        </div>
        <div className="space-y-3">
          {connectedBanks.map(bank => (
            <div key={bank.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Building className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">{bank.name}</div>
                  <div className="text-sm text-gray-600">••••{bank.last4} • Last synced {bank.synced}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">${bank.balance.toLocaleString()}</div>
                  <button onClick={() => syncBank(bank.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1">Sync Now</button>
                </div>
                <button onClick={() => deleteBank(bank.id)} className="opacity-0 group-hover:opacity-100 transition p-2 hover:bg-red-50 rounded-lg">
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-4">Connect New Bank</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {popularBanks.map(bank => (
            <button key={bank.name} onClick={() => setIsConnecting(true)} className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition">
              <span className="text-3xl">{bank.logo}</span>
              <span className="font-medium text-gray-900 text-sm">{bank.name}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setIsConnecting(true)} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold">
          <Plus className="w-5 h-5" />Connect Bank Account
        </button>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <div className="font-semibold mb-1">Your credentials are never stored</div>
              <div className="text-blue-700">We use Plaid, a secure third-party service trusted by thousands of financial apps.</div>
            </div>
          </div>
        </div>
      </div>

      {isConnecting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Connect Bank Account</h3>
              <button onClick={() => { setIsConnecting(false); setIsAdding(false); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            {!isAdding ? (
              <>
                <div className="text-center py-8">
                  <Activity className="w-16 h-16 text-indigo-600 mx-auto mb-4 animate-pulse" />
                  <p className="text-gray-600 mb-4">In production, this would open Plaid Link</p>
                  <p className="text-sm text-gray-500 mb-6">Plaid securely connects to 12,000+ financial institutions</p>
                </div>
                <div className="space-y-3">
                  <button onClick={() => setIsAdding(true)} className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold">Add Account Manually (Demo)</button>
                  <button onClick={() => setIsConnecting(false)} className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold">Close</button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                    <input type="text" value={newBank.name} onChange={(e) => setNewBank({...newBank, name: e.target.value})} placeholder="e.g., Chase Checking" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last 4 Digits</label>
                    <input type="text" maxLength={4} value={newBank.last4} onChange={(e) => setNewBank({...newBank, last4: e.target.value.replace(/\D/g, '')})} placeholder="1234" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Balance</label>
                    <input type="number" value={newBank.balance || ''} onChange={(e) => setNewBank({...newBank, balance: Number(e.target.value)})} placeholder="0" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setIsAdding(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold">Back</button>
                  <button onClick={addBank} className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold">Add Account</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Component that uses searchParams - wrapped in Suspense
function AdvancedFeaturesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuth, setIsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const tabParam = searchParams?.get('tab') || 'forecast';
  const [activeTab, setActiveTab] = useState<'forecast' | 'investments' | 'debt' | 'plaid'>(tabParam as any || 'forecast');

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!checkAuth()) {
        router.replace("/login");
      } else {
        setIsAuth(true);
        setIsLoading(false);
      }
    }
  }, [router]);

  useEffect(() => {
    const loadData = async () => {
      if (isAuth) {
        try {
          const txs = await transactionsAPI.getAll();
          setTransactions(txs || []);
        } catch {
          setTransactions([]);
        }
      }
    };
    loadData();
  }, [isAuth]);

  const tabs = [
    { id: 'forecast' as const, label: 'Cash Flow', icon: TrendingUp },
    { id: 'investments' as const, label: 'Investments', icon: BarChart3 },
    { id: 'debt' as const, label: 'Debt Payoff', icon: CreditCard },
    { id: 'plaid' as const, label: 'Bank Connections', icon: Lock },
  ];

  if (isLoading || !isAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-16 w-16 animate-spin text-indigo-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push("/dashboard")} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition-colors">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">Advanced Features</h1>
                <p className="text-gray-600">Powerful tools for financial planning</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)} 
                  className={`flex items-center gap-2 px-6 py-4 font-semibold border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'forecast' && <CashFlowForecasting transactions={transactions} />}
        {activeTab === 'investments' && <InvestmentTracking />}
        {activeTab === 'debt' && <DebtPayoffPlanner />}
        {activeTab === 'plaid' && <PlaidBankConnection />}
      </main>
    </div>
  );
}

// Main page component with Suspense boundary
export default function AdvancedFeaturesPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-16 w-16 animate-spin text-indigo-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AdvancedFeaturesContent />
    </Suspense>
  );
}