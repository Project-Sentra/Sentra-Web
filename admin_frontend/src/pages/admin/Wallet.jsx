/**
 * Wallet.jsx - User Wallet and Payment History
 * ============================================
 * Displays current wallet balance and transaction history.
 * Allows users to top up their wallet using Stripe.
 */

import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import lprService from "../../services/lprService";

export default function Wallet() {
  const [wallet, setWallet] = useState({ balance: 0 });
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchWalletData() {
    try {
      setLoading(true);
      // Fetch user's own wallet balance (as admin)
      const walletData = await lprService.getWallet();
      setWallet(walletData);
      
      // Fetch all payments for admin view
      const paymentsData = await lprService.getPayments(true);
      setPayments(paymentsData);
    } catch (err) {
      console.error("Failed to fetch wallet data", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWalletData();
  }, []);

  return (
    <div className="flex h-screen bg-sentraBlack text-white overflow-hidden">
      <Sidebar facilityName="System Administration" />

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Payments & Wallets</h1>
          <p className="text-gray-400 text-sm mt-1">Monitor system-wide transactions and user balances</p>
        </header>

        <div className="grid grid-cols-1 gap-8">
          {/* Transaction History */}
          <div className="w-full">
            <div className="bg-[#171717] border border-[#232323] rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-[#232323]">
                <h3 className="text-xl font-semibold">Transaction History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-[#232323]">
                      <th className="px-6 py-4 font-medium">User</th>
                      <th className="px-6 py-4 font-medium">Description</th>
                      <th className="px-6 py-4 font-medium">Method</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232323]">
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-10 text-center text-gray-500 animate-pulse">
                          Loading transactions...
                        </td>
                      </tr>
                    ) : payments.length > 0 ? (
                      payments.map((p) => (
                        <tr key={p.id} className="hover:bg-[#1f1f1f] transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-sentraYellow">
                              {p.users?.full_name || "System User"}
                            </p>
                            <p className="text-[10px] text-gray-500">{p.users?.email || "N/A"}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium">{p.description}</p>
                            {p.transaction_ref && (
                              <p className="text-[10px] text-gray-600 mt-0.5 font-mono">{p.transaction_ref}</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-gray-400 uppercase">{p.payment_method}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-400">
                              {new Date(p.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-[10px] text-gray-600">
                              {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`font-bold ${p.payment_status === 'completed' ? 'text-white' : 'text-gray-500'}`}>
                              LKR {p.amount.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                          No transactions yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
