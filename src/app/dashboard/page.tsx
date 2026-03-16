"use client";

import { motion } from "framer-motion";

export default function DashboardPage() {
  return (
    <div className="w-full min-h-screen p-3 sm:p-4 lg:p-6">
      <div className="w-full max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="mb-5 text-center">
          <h1 className="text-2xl md:text-3xl font-bold mb-1 bg-gradient-to-r from-light-blue via-neon-pink to-light-blue bg-clip-text text-transparent">
            [DASHBOARD]
          </h1>
          <p className="text-xs md:text-sm text-white/70">
            Real-time analytics for Nexus AI platform usage and revenue.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button className="px-2.5 py-1 rounded-lg bg-neon-pink/20 border border-neon-pink/40 text-neon-pink font-semibold text-[11px]">
            [PLATFORM_OVERVIEW]
          </button>
          <button className="px-2.5 py-1 rounded-lg border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20 transition-all text-[11px]">
            [MY_ACTIVITY]
          </button>
        </div>

        {/* KPI Row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4">
          {[
            { label: "TOTAL USERS", value: "649", change: "+0 today" },
            { label: "TOTAL REVENUE", value: "$501.58", sub: "(USDC)" },
            { label: "AGENT MESSAGES", value: "7096", sub: "($304.50)" },
            { label: "TOTAL QUESTS", value: "236", sub: "($63.50)" },
            { label: "X402 TXS", value: "1315", sub: "($105.05)" },
          ].map((kpi, index) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              whileHover={{ scale: 1.01 }}
              className="p-3 rounded-lg border border-neon-pink/20 bg-black/40 backdrop-blur-sm"
              style={{ boxShadow: "0 0 20px rgba(255, 123, 198, 0.1)" }}
            >
              <p className="text-[11px] text-white/60 mb-0.5">{kpi.label}</p>
              <p className="text-base md:text-lg font-bold text-neon-pink mb-0.5">{kpi.value}</p>
              {kpi.change && <p className="text-[11px] text-light-blue">{kpi.change}</p>}
              {kpi.sub && <p className="text-[11px] text-white/50">{kpi.sub}</p>}
            </motion.div>
          ))}
        </div>

        {/* KPI Row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: "BASE REVENUE", value: "$330.45" },
            { label: "SOLANA REVENUE", value: "$171.13" },
            { label: "NEW_USERS_7", value: "0" },
            { label: "AVG FEE", value: "$0.05" },
          ].map((kpi, index) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.05 }}
              className="p-3.5 rounded-lg border border-light-blue/20 bg-black/40 backdrop-blur-sm"
              style={{ boxShadow: "0 0 20px rgba(163, 216, 244, 0.1)" }}
            >
              <p className="text-[11px] text-white/60 mb-0.5">{kpi.label}</p>
              <p className="text-sm md:text-base font-bold text-light-blue">{kpi.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts row - horizontal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            whileHover={{ scale: 1.005 }}
            className="p-4 rounded-lg border border-neon-pink/20 bg-black/40 backdrop-blur-sm"
            style={{ boxShadow: "0 0 20px rgba(255, 123, 198, 0.1)" }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-semibold text-neon-pink">REVENUE_TREND</h3>
              <span className="text-xs text-white/60">30_DAY_VIEW</span>
            </div>
            <div className="h-32 flex items-end justify-between gap-0.5 bg-gradient-to-t from-black via-black/60 to-transparent rounded-b-lg border-t border-white/5">
              {Array.from({ length: 30 }).map((_, i) => {
                const height =
                  i === 15 ? 100 : i === 16 ? 95 : i < 10 ? Math.random() * 30 + 10 : Math.random() * 20 + 5;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t min-w-0"
                    style={{
                      height: `${height}%`,
                      background:
                        i === 15 || i === 16
                          ? "linear-gradient(to top, rgba(255, 123, 198, 0.95), rgba(255, 123, 198, 0.4))"
                          : "linear-gradient(to top, rgba(255, 123, 198, 0.5), rgba(255, 123, 198, 0.2))",
                      minHeight: "3px",
                    }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-white/40">
              <span>Nov 18</span>
              <span>Dec 17</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            whileHover={{ scale: 1.005 }}
            className="p-4 rounded-lg border border-light-blue/20 bg-black/40 backdrop-blur-sm"
            style={{ boxShadow: "0 0 20px rgba(163, 216, 244, 0.1)" }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-semibold text-light-blue">SERVICE_USAGE</h3>
              <span className="text-xs text-white/60">PROTOCOL_ACTIVITY</span>
            </div>
            <div className="h-32 flex items-end justify-between gap-0.5">
              {Array.from({ length: 30 }).map((_, i) => {
                const chatHeight = Math.random() * 40 + 20;
                const mixerHeight = Math.random() * 30 + 15;
                const swapHeight = Math.random() * 20 + 10;
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end gap-0.5 min-w-0">
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${chatHeight}%`,
                        background: "rgba(255, 123, 198, 0.6)",
                        minHeight: "2px",
                      }}
                    />
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${mixerHeight}%`,
                        background: "rgba(163, 216, 244, 0.6)",
                        minHeight: "2px",
                      }}
                    />
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${swapHeight}%`,
                        background: "rgba(163, 216, 244, 0.4)",
                        minHeight: "2px",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-white/40">
              <span>Nov 18</span>
              <span>Dec 17</span>
            </div>
            <div className="flex gap-2 mt-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded bg-neon-pink/60" />
                <span className="text-white/60">CHAT</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded bg-light-blue/60" />
                <span className="text-white/60">QUEST</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded bg-light-blue/40" />
                <span className="text-white/60">x402</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          whileHover={{ scale: 1.003 }}
          className="p-4 rounded-lg border border-neon-pink/20 bg-black/40 backdrop-blur-sm"
          style={{ boxShadow: "0 0 20px rgba(255, 123, 198, 0.1)" }}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-semibold text-neon-pink">[RECENT_TRANSACTIONS]</h3>
            <span className="text-[11px] text-light-blue bg-light-blue/10 px-2.5 py-0.5 rounded">LIVE_FEED</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] table-fixed min-w-[600px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-2 py-2 text-white/60 font-semibold">TYPE</th>
                  <th className="text-left px-2 py-2 text-white/60 font-semibold">AMOUNT</th>
                  <th className="text-left px-2 py-2 text-white/60 font-semibold">CHAIN</th>
                  <th className="text-left px-2 py-2 text-white/60 font-semibold">STATUS</th>
                  <th className="text-left px-2 py-2 text-white/60 font-semibold">TIME</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { type: "NEXUS AI", amount: "$0.05", chain: "solana", status: "completed", time: "07/02/2026 23:41:29" },
                  { type: "NEXUS AI", amount: "$0.05", chain: "solana", status: "completed", time: "07/02/2026 22:47:11" },
                  { type: "NEXUS AI", amount: "$0.05", chain: "solana", status: "completed", time: "07/02/2026 21:03:52" },
                  { type: "NEXUS AI", amount: "$0.05", chain: "solana", status: "completed", time: "07/02/2026 18:32:04" },
                  { type: "NEXUS AI", amount: "$0.05", chain: "solana", status: "completed", time: "07/02/2026 16:18:37" },
                  { type: "NEXUS AI", amount: "$0.05", chain: "solana", status: "completed", time: "06/02/2026 21:15:33" },
                  { type: "NEXUS AI", amount: "$0.05", chain: "solana", status: "completed", time: "06/02/2026 19:04:21" },
                  { type: "NEXUS AI", amount: "$0.05", chain: "solana", status: "completed", time: "06/02/2026 17:22:49" },
                ].map((tx, index) => (
                  <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-2 py-2 text-white/80">{tx.type}</td>
                    <td className="px-2 py-2 text-neon-pink">{tx.amount}</td>
                    <td className="px-2 py-2 text-white/70">{tx.chain}</td>
                    <td className="px-2 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-neon-pink/20 text-neon-pink border border-neon-pink/40">
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-white/60">{tx.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
