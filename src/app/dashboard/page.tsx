"use client";

import { motion } from "framer-motion";

type Tx = {
  type: string;
  amount: string;
  chain: string;
  status: string;
  time: string;
};

function pad(num: number): string {
  return num.toString().padStart(2, "0");
}

function formatDateTime(date: Date, hour: number, minute: number, second: number): string {
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const hh = pad(hour);
  const mm = pad(minute);
  const ss = pad(second);
  return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
}

function generateTransactions(): Tx[] {
  const result: Tx[] = [];
  const countsPerDay = [7, 3, 5, 20]; // nombre de transactions par jour, de façon irrégulière

  // Du 18 mars 2026 au 6 février 2026 inclus (en date locale, pas UTC)
  let current = new Date(2026, 2, 18, 23, 59, 59); // mois 2 = mars
  const end = new Date(2026, 1, 6, 0, 0, 0); // mois 1 = février
  let dayIndex = 0;

  while (current >= end) {
    const count = countsPerDay[dayIndex % countsPerDay.length];

    for (let i = 0; i < count; i++) {
      // On répartit les heures sur la journée, minutes/secondes légèrement aléatoires
      const baseHour = 23 - Math.floor((i * 20) / Math.max(count, 1));
      const minute = (7 * i + dayIndex * 3) % 60;
      const second = (13 * i + dayIndex * 11) % 60;

      const time = formatDateTime(
        current,
        Math.max(0, Math.min(23, baseHour)),
        minute,
        second
      );

      result.push({
        type: "NEXUS AI",
        amount: "$0.05",
        chain: "solana",
        status: "completed",
        time,
      });
    }

    // Jour précédent
    current = new Date(current.getTime() - 24 * 60 * 60 * 1000);
    dayIndex++;
  }

  return result;
}

const RECENT_TX: Tx[] = generateTransactions();

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
            { label: "TOTAL USERS", value: "649", change: "+7 today" },
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
            { label: "NEW USERS", value: "7" },
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
                // Courbe encore un peu plus basse mais avec une activité claire.
                const isBigSpike = i === 14 || i === 15;
                const isMediumSpike = i === 13 || i === 16 || i === 10 || i === 20;

                let base =
                  32 + // niveau moyen plus bas
                  (Math.sin((i / 30) * Math.PI * 2) + 1) * 10; // ondulation douce

                if (isMediumSpike) base += 8;
                if (isBigSpike) base += 15;

                const height = Math.max(16, Math.min(70, base));

                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t min-w-0"
                    style={{
                      height: `${height}%`,
                      background:
                        isBigSpike || isMediumSpike
                          ? "linear-gradient(to top, rgba(255, 123, 198, 0.85), rgba(255, 123, 198, 0.4))"
                          : "linear-gradient(to top, rgba(255, 123, 198, 0.55), rgba(255, 123, 198, 0.22))",
                      minHeight: "3px",
                    }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-white/40">
              <span>Feb 18</span>
              <span>Mar 18</span>
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
                // Motifs déterministes pour éviter un rendu trop uniforme :
                // - cycles hebdomadaires
                // - pics marqués certains jours
                const dayOfWeek = i % 7;
                const isSpikeDay = i === 5 || i === 12 || i === 18 || i === 24;

                const chatBase =
                  dayOfWeek === 5 || dayOfWeek === 6 ? 70 : 35 + dayOfWeek * 5;
                const mixerBase =
                  dayOfWeek === 1 || dayOfWeek === 2 ? 55 : 25 + ((6 - dayOfWeek) * 4);
                const swapBase = 15 + (dayOfWeek * 3);

                const chatHeight = Math.min(100, chatBase + (isSpikeDay ? 20 : 0));
                const mixerHeight = Math.min(90, mixerBase + (isSpikeDay ? 10 : 0));
                const swapHeight = Math.min(70, swapBase + (isSpikeDay ? 5 : 0));

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
              <span>Feb 18</span>
              <span>Mar 18</span>
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
                {RECENT_TX.map((tx, index) => (
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
